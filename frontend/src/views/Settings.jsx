import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function applyZoom(z) {
  document.body.style.zoom = z;
  localStorage.setItem('ui.zoom', String(z));
}
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('ui.theme', t);
}

export default function Settings() {
  const [h, setH] = useState(null);
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('ui.zoom')) || 1);
  const [theme, setTheme] = useState(() => localStorage.getItem('ui.theme') || 'dark');

  useEffect(() => { api.health().then(setH).catch(e => setH({ ok: false, error: e.message })); }, []);

  function onZoom(v) {
    const z = Math.max(0.7, Math.min(1.5, Number(v)));
    setZoom(z);
    applyZoom(z);
  }
  function onTheme(t) {
    setTheme(t);
    applyTheme(t);
  }
  function resetZoom() { onZoom(1); }

  return (
    <>
      <h2 className="view-title">⚙️ Configuración</h2>

      <div className="card">
        <h3>Apariencia</h3>
        <div className="row" style={{ gap: 16, marginBottom: 12 }}>
          <label>Tema:</label>
          <button
            className={`btn ${theme === 'dark' ? 'primary' : ''}`}
            onClick={() => onTheme('dark')}>Oscuro</button>
          <button
            className={`btn ${theme === 'light' ? 'primary' : ''}`}
            onClick={() => onTheme('light')}>Claro</button>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <label>Tamaño de página: {Math.round(zoom * 100)}%</label>
          <input
            type="range" min="0.7" max="1.5" step="0.05"
            value={zoom} onChange={e => onZoom(e.target.value)} />
          <button className="btn" onClick={resetZoom}>Restablecer</button>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          El zoom reflowa el contenido (no recorta ni deja huecos).
        </div>
      </div>

      <div className="card">
        <h3>Estado del sistema</h3>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(h, null, 2)}</pre>
      </div>
      <div className="card">
        <h3>Variables</h3>
        <div className="muted">
          Backend: <code>PAGINAAUTO/backend/.env</code><br/>
          Pipeline IA (Python): variable <code>PYTHON_API</code> apunta a <code>main.py</code> (uvicorn).<br/>
          BD: MySQL en WAMP (ver <code>schema.sql</code>).
        </div>
      </div>
    </>
  );
}
