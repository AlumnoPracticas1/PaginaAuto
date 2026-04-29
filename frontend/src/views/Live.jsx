import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Live() {
  const [items, setItems] = useState([]);
  const [inspecting, setInspecting] = useState(false);
  const [inspectMsg, setInspectMsg] = useState(null);

  async function tick() {
    try { setItems(await api.previews()); } catch {}
  }
  useEffect(() => { tick(); const t = setInterval(tick, 5000); return () => clearInterval(t); }, []);

  async function runInspection() {
    setInspecting(true);
    setInspectMsg(null);
    try {
      const r = await api.inspect();
      setInspectMsg({ ok: true, text: r?.message || 'Inspección lanzada correctamente.' });
      tick();
    } catch (e) {
      setInspectMsg({ ok: false, text: e.message });
    } finally {
      setInspecting(false);
    }
  }

  return (
    <>
      <h2 className="view-title">👁️ Ahora mismo</h2>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="muted">Actualiza cada 5s</div>
        <button className="btn primary" onClick={runInspection} disabled={inspecting}>
          {inspecting ? 'Inspeccionando…' : '🔍 Realizar inspección'}
        </button>
      </div>
      {inspectMsg && (
        <div className="card" style={{ borderColor: inspectMsg.ok ? '#27ae60' : '#c0392b' }}>
          {inspectMsg.text}
        </div>
      )}
      {items.slice(0, 15).map(p => (
        <div key={p.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{p.message}</strong>
              <div className="muted">{p.file}{p.line ? `:${p.line}` : ''}</div>
            </div>
            <div className="row">
              <span className={`badge ${p.priority}`}>{p.priority}</span>
              <span className={`badge ${p.status}`}>{p.status}</span>
              <span className="muted">{p.created_at}</span>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
