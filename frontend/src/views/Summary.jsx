import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Summary() {
  const [data, setData] = useState(null);
  useEffect(() => { api.summary().then(setData).catch(() => setData({ totals: {}, rows: [] })); }, []);
  if (!data) return <div className="muted">Cargando…</div>;
  const t = data.totals || {};
  const cards = [
    ['Total', t.total], ['Pendientes', t.pending], ['Aplicadas', t.applied],
    ['Ignoradas', t.ignored], ['Rechazadas', t.rejected], ['Urgentes', t.urgent],
  ];
  return (
    <>
      <h2 className="view-title">📊 Resumen semanal</h2>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {cards.map(([l, v]) => (
          <div key={l} className="card" style={{ textAlign: 'center' }}>
            <div className="muted">{l}</div>
            <div style={{ fontSize: 28, fontWeight: 'bold' }}>{v ?? 0}</div>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 24 }}>Desglose por día</h3>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th align="left">Día</th><th align="left">Estado</th>
            <th align="left">Prioridad</th><th align="right">N</th>
          </tr></thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid #252b3a' }}>
                <td>{r.day}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td><span className={`badge ${r.priority}`}>{r.priority}</span></td>
                <td align="right">{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
