import { Router } from 'express';
import { pool } from '../db.js';
import { pyFetch } from '../python.js';

const r = Router();

/**
 * Recibe un error (mismo contrato que main.py /report) y:
 *  1) llama al pipeline IA en Python (FastAPI) que devuelve diagnóstico, fix, diff, validación, prioridad
 *  2) guarda el preview resultante en MySQL
 */
r.post('/', async (req, res, next) => {
  try {
    const err = req.body || {};
    if (!err.source || !err.message) {
      return res.status(400).json({ error: 'source y message requeridos' });
    }

    const py = await pyFetch('/report', { method: 'POST', body: JSON.stringify(err) });
    const pid = py.preview_id;
    if (!pid) return res.status(502).json({ error: 'pipeline sin preview_id', py });

    const full = await pyFetch(`/previews/${pid}`).catch(() => null);

    await pool.execute(
      `INSERT INTO previews
         (id, source, status, priority, file, line, message, stack,
          diagnosis, original, fixed, diff, validation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
          status = VALUES(status), priority = VALUES(priority),
          diagnosis = VALUES(diagnosis), fixed = VALUES(fixed),
          diff = VALUES(diff), validation = VALUES(validation)`,
      [
        pid, err.source, py.status || 'pending', py.priority || 'medium',
        err.file || null, err.line || null, err.message, err.stack || null,
        full?.diagnosis || null, full?.original || null, full?.fixed || null,
        full?.diff || null, full?.validation || null,
      ]
    );

    res.json({ preview_id: pid, priority: py.priority, status: py.status });
  } catch (e) { next(e); }
});

export default r;
