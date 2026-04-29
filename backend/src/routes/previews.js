import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../db.js';
import { pyFetch } from '../python.js';

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
  let sql = 'SELECT id, source, status, priority, file, line, message, created_at FROM previews';
  const params = [];
  if (status) { sql += ' WHERE status = ?'; params.push(status); }
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
r.post('/:id/resolve', async (req, res, next) => {
  try {
    const [[p]] = await pool.execute('SELECT * FROM previews WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'no encontrado' });
    if (p.status !== 'ignored') return res.status(400).json({ error: `estado: ${p.status}` });

    const result = await pyFetch('/report', {
      method: 'POST',
      body: JSON.stringify({
        source: p.source, message: p.message,
        file: p.file, line: p.line, stack: p.stack,
      }),
    });
    // refrescar en DB
    if (result?.preview_id) {
      await pool.execute(
        `UPDATE previews SET status = 'pending', diagnosis = ?, fixed = ?, diff = ?, validation = ?
         WHERE id = ?`,
        [result.diagnosis || null, result.fixed || null, result.diff || null, result.validation || null, p.id]
      );
    }
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

export default r;
