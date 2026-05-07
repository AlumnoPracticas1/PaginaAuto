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

// Mapeo APP_NAME (el que envía cliente-escucha en extra.app) -> carpeta en disco.
// Permite editar la página que está escuchando aunque el error no traiga `file`.
let APP_ROOTS = {
  avantservice: 'C:/Users/Lenovo/Desktop/HAM/avantservice',
  'pagina web': 'C:/Users/Lenovo/Desktop/HAM/Pagina web',
};
try {
  if (process.env.APP_ROOTS_JSON) {
    APP_ROOTS = { ...APP_ROOTS, ...JSON.parse(process.env.APP_ROOTS_JSON) };
  }
} catch {}

function appRootFor(app) {
  if (!app) return null;
  const key = String(app).toLowerCase().trim();
  const p = APP_ROOTS[key];
  return p ? path.resolve(p) : null;
}

function safeResolve(source, rel) {
  if (!rel) return null;
  const root = rootFor(source);
  const full = path.resolve(root, rel);
  if (!full.startsWith(root)) return null;
  return full;
}

// Resuelve el archivo objetivo de una preview.
// 1) Si trae `file` -> safeResolve clásico (PHP_ROOT / JS_ROOT).
// 2) Si no -> usa extra.app + extra.page_path para apuntar al archivo
//    real de la web cliente que está escuchando.
function resolvePreviewTarget(p) {
  if (p.file) {
    const t = safeResolve(p.source, p.file);
    if (t) return { target: t, mode: 'file' };
  }
  let extra = p.extra;
  if (typeof extra === 'string') { try { extra = JSON.parse(extra); } catch { extra = {}; } }
  extra = extra || {};
  const root = appRootFor(extra.app);
  if (!root) return { target: null, mode: null, reason: `app desconocida: ${extra.app || '(none)'}` };
  let rel = String(extra.page_path || '').replace(/^[\/\\]+/, '');
  if (!rel || rel.endsWith('/') || rel.endsWith('\\')) rel = path.join(rel, 'index.html');
  const full = path.resolve(root, rel);
  if (!full.startsWith(root)) return { target: null, mode: null, reason: 'ruta fuera del root de la app' };
  return { target: full, mode: 'app', appRoot: root };
}

// --- Modo auto global (persistido en tabla settings k=autoMode) ---
async function ensureSettings() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS settings (
    k VARCHAR(64) PRIMARY KEY,
    v TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
}
async function getAutoMode() {
  await ensureSettings();
  const [[row]] = await pool.execute('SELECT v FROM settings WHERE k = ?', ['autoMode']);
  return row?.v || 'priority'; // 'priority' | 'always' | 'never'
}
async function setAutoMode(mode) {
  await ensureSettings();
  await pool.execute(
    'INSERT INTO settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)',
    ['autoMode', mode]
  );
}

r.get('/auto-mode', async (_req, res) => {
  res.json({ mode: await getAutoMode() });
});
r.post('/auto-mode', async (req, res) => {
  const m = String(req.body?.mode || '').trim();
  if (!['priority', 'always', 'never'].includes(m)) {
    return res.status(400).json({ error: 'mode debe ser priority|always|never' });
  }
  await setAutoMode(m);
  res.json({ ok: true, mode: m });
});

// Lista plana de TODOS los IDs (con estado y mensaje corto).
r.get('/ids', async (req, res) => {
  const status = req.query.status;
  let sql = 'SELECT id, status, priority, source, file, LEFT(message,120) AS message, created_at FROM previews';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.execute(sql, params);
  res.json({ count: rows.length, ids: rows });
});

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

  const { target, reason } = resolvePreviewTarget(p);
  if (!target) return res.status(400).json({ error: `ruta inválida: ${reason || 'sin app/file'}` });

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
    // Override por petición: body.auto = true|false (gana sobre el modo global).
    // Modo global (settings.autoMode):
    //   'priority' -> auto solo si priority es low/medium (default)
    //   'always'   -> auto siempre que haya target + fixedCode
    //   'never'    -> nunca auto, siempre pending
    const reqAuto = (req.body && typeof req.body.auto === 'boolean') ? req.body.auto : null;
    const mode = await getAutoMode();
    let autoEligible;
    if (reqAuto !== null) autoEligible = reqAuto;
    else if (mode === 'always') autoEligible = true;
    else if (mode === 'never')  autoEligible = false;
    else                        autoEligible = (p.priority === 'low' || p.priority === 'medium');

    const resolved = fixedCode ? resolvePreviewTarget(p) : { target: null };
    const target = resolved.target;
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
      if (!autoEligible) appliedReason = `requiere revisión manual (mode=${reqAuto !== null ? 'override-off' : mode}, priority=${p.priority})`;
      else if (!target)  appliedReason = `no se pudo resolver archivo destino (${resolved.reason || 'sin file ni app conocida'})`;
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
