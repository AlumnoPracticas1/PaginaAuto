import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../db.js';
import { pyFetch } from '../python.js';
import { repairConversation } from '../ollama.js';

const r = Router();

const PHP_ROOT = path.resolve(process.env.PHP_CODE_ROOT || 'C:/wamp64/www/backendstore');
const JS_ROOT  = path.resolve(process.env.JS_CODE_ROOT  || 'C:/Users/Lenovo/Desktop/HAM/Pagina web');
const rootFor = s => (s === 'js' ? JS_ROOT : PHP_ROOT);

function safeResolve(source, rel) {
  if (!rel) return null;
  const root = rootFor(source);
  const full = path.resolve(root, rel);
  if (!full.startsWith(root)) return null;
  return full;
}

r.get('/', async (req, res) => {
  const status = req.query.status;
  let sql = 'SELECT id, source, status, priority, file, line, message, extra, deployer, catalog_code, created_at FROM previews';
  const params = [];
  if (status) {
    const list = status.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length === 1) { sql += ' WHERE status = ?'; params.push(list[0]); }
    else if (list.length > 1) {
      sql += ` WHERE status IN (${list.map(() => '?').join(',')})`;
      params.push(...list);
    }
  }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const [rows] = await pool.execute(sql, params);
  res.json(rows);
});

r.get('/:id', async (req, res) => {
  const [[row]] = await pool.execute('SELECT * FROM previews WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'no encontrado' });
  res.json(row);
});

r.post('/:id/approve', async (req, res) => {
  const [[p]] = await pool.execute('SELECT * FROM previews WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'no encontrado' });
  if (p.status !== 'pending') return res.status(400).json({ error: `estado actual: ${p.status}` });

  const target = safeResolve(p.source, p.file);
  if (!target) return res.status(400).json({ error: 'ruta inválida' });

  let backup = null;
  if (fs.existsSync(target)) {
    backup = `${target}.${Date.now()}.bak`;
    fs.copyFileSync(target, backup);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, p.fixed ?? '', 'utf8');

  await pool.execute(
    'UPDATE previews SET status = ?, backup_path = ? WHERE id = ?',
    ['applied', backup, p.id]
  );
  res.json({ ok: true, backup });
});

r.post('/:id/reject', async (req, res) => {
  await pool.execute('UPDATE previews SET status = ? WHERE id = ?', ['rejected', req.params.id]);
  res.json({ ok: true });
});

// Resolver una preview "ignored" -> vuelve a pasar por el pipeline IA (Python)
// Marca processing y responde 202 inmediato; el pipeline corre en background
// para que sobreviva a recargas del navegador.
r.post('/:id/resolve', async (req, res, next) => {
  try {
    const [[p]] = await pool.execute('SELECT * FROM previews WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'no encontrado' });
    if (p.status === 'processing') return res.status(202).json({ ok: true, already: true });
    if (p.status !== 'ignored') return res.status(400).json({ error: `estado: ${p.status}` });

    await pool.execute('UPDATE previews SET status = ? WHERE id = ?', ['processing', p.id]);
    res.status(202).json({ ok: true, status: 'processing' });

    (async () => {
      try {
        const result = await pyFetch('/report', {
          method: 'POST',
          body: JSON.stringify({
            source: p.source, message: p.message,
            file: p.file, line: p.line, stack: p.stack,
          }),
        });
        await pool.execute(
          `UPDATE previews SET status = 'pending', diagnosis = ?, fixed = ?, diff = ?, validation = ?
           WHERE id = ?`,
          [result?.diagnosis || null, result?.fixed || null, result?.diff || null, result?.validation || null, p.id]
        );
      } catch (err) {
        console.error('[resolve background]', p.id, err.message);
        await pool.execute('UPDATE previews SET status = ? WHERE id = ?', ['ignored', p.id]).catch(() => {});
      }
    })();
  } catch (e) { next(e); }
});

// Genera reparación con Ollama (REPORTER + FIXER) y la guarda.
// Auto-aplica si la prioridad es 'low' o 'medium' Y el fichero resuelve a un root conocido.
// Si es 'high'/'urgent' deja el fix como pending para revisión manual (Aprobar / Rechazar).
r.post('/:id/repair', async (req, res, next) => {
  try {
    const [[p]] = await pool.execute('SELECT * FROM previews WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'no encontrado' });

    // Recupera info de catálogo si existe (mejora el prompt)
    let catalogInfo = null;
    if (p.catalog_code) {
      const [[c]] = await pool.execute(
        'SELECT cause, solution FROM error_catalog WHERE code = ? AND platform = ? LIMIT 1',
        [p.catalog_code, p.deployer || '']
      );
      catalogInfo = c || null;
    }

    let convo;
    try {
      convo = await repairConversation({
        message: p.message, file: p.file, line: p.line, stack: p.stack,
        source: p.source, deployer: p.deployer, catalogCode: p.catalog_code, catalogInfo,
      });
    } catch (e) {
      return res.status(503).json({ error: 'Ollama no disponible', detail: e.message });
    }

    const diagnosis = convo.conversation[0].content;
    const fixerOutput = convo.conversation[1].content;
    const fixedCode = convo.fixedCode;

    // Decisión de auto-aplicado.
    const autoEligible = (p.priority === 'low' || p.priority === 'medium');
    const target = fixedCode ? safeResolve(p.source, p.file) : null;
    const canAutoApply = autoEligible && !!target && !!fixedCode;

    let backup = null;
    let applied = false;
    let appliedReason = null;

    if (canAutoApply) {
      try {
        if (fs.existsSync(target)) {
          backup = `${target}.${Date.now()}.bak`;
          fs.copyFileSync(target, backup);
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, fixedCode, 'utf8');
        applied = true;
        appliedReason = `auto (priority=${p.priority})`;
      } catch (e) {
        appliedReason = `auto-apply failed: ${e.message}`;
      }
    } else {
      if (!autoEligible) appliedReason = `requiere revisión manual (priority=${p.priority})`;
      else if (!target)  appliedReason = 'archivo fuera de raíz permitida (PHP_CODE_ROOT/JS_CODE_ROOT)';
      else if (!fixedCode) appliedReason = 'la IA no devolvió un bloque de código aplicable';
    }

    await pool.execute(
      `UPDATE previews SET
         diagnosis = ?, fixed = ?, status = ?, backup_path = COALESCE(?, backup_path)
       WHERE id = ?`,
      [
        diagnosis,
        fixedCode || fixerOutput,
        applied ? 'applied' : 'pending',
        backup,
        p.id,
      ]
    );

    res.json({
      ok: true,
      model: convo.model,
      conversation: convo.conversation,
      fixedCode,
      applied,
      backup,
      reason: appliedReason,
      priority: p.priority,
    });
  } catch (e) { next(e); }
});

export default r;
