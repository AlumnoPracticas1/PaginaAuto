import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import { pyHealth, pyFetch } from './python.js';

import notesRouter from './routes/notes.js';
import previewsRouter from './routes/previews.js';
import reportRouter from './routes/report.js';
import chatRouter from './routes/chat.js';
import summaryRouter from './routes/summary.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', async (_req, res) => {
  let db = false;
  try { await pool.query('SELECT 1'); db = true; } catch {}
  const py = await pyHealth();
  res.json({ ok: db, db, python: py });
});

app.use('/notes', notesRouter);
app.use('/previews', previewsRouter);
app.use('/report', reportRouter);
app.use('/chat', chatRouter);
app.use('/summary', summaryRouter);

app.get('/notifications', async (_req, res) => {
  const rows = await pool.query(
    `SELECT id, priority, status, message, file, line, created_at
     FROM previews
     WHERE priority = 'urgent' AND status = 'pending'
     ORDER BY created_at DESC LIMIT 20`
  );
  res.json(rows[0]);
});

app.post('/inspect', async (_req, res, next) => {
  try {
    const r = await pyFetch('/inspect', { method: 'POST', body: '{}' });
    res.json({ ok: true, message: r?.message || 'Inspección iniciada', detail: r });
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message, detail: err.data });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API http://localhost:${PORT}`));
