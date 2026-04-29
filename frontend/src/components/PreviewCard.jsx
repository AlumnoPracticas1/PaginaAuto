import React, { useState } from 'react';
import { api } from '../api.js';

function colorizeDiff(diff) {
  return (diff || '').split('\n').map((l, i) => {
    const cls = l.startsWith('+') && !l.startsWith('+++') ? 'add'
              : l.startsWith('-') && !l.startsWith('---') ? 'del' : '';
    return <div key={i} className={cls}>{l || ' '}</div>;
  });
}

export default function PreviewCard({ p, onChange }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!open && !full) {
      const data = await api.preview(p.id);
      setFull(data);
    }
    setOpen(o => !o);
  }

  async function act(fn) {
    setBusy(true);
    try { await fn(); onChange?.(); }
    catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h3>{p.message}</h3>
          <div className="muted">{p.file}{p.line ? `:${p.line}` : ''} · {p.source}</div>
        </div>
        <div className="row">
          <span className={`badge ${p.priority}`}>{p.priority}</span>
          <span className={`badge ${p.status}`}>{p.status}</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={toggle}>{open ? 'Ocultar' : 'Ver detalle'}</button>
        {p.status === 'pending' && (
          <>
            <button className="btn primary" disabled={busy}
                    onClick={() => act(() => api.approve(p.id))}>Aprobar</button>
            <button className="btn danger" disabled={busy}
                    onClick={() => act(() => api.reject(p.id))}>Rechazar</button>
          </>
        )}
        {p.status === 'ignored' && (
          <button className="btn primary" disabled={busy}
                  onClick={() => act(() => api.resolveIgnored(p.id))}>Resolver ahora</button>
        )}
      </div>

      {open && full && (
        <div style={{ marginTop: 12 }}>
          {full.diagnosis && (
            <>
              <div className="muted">Diagnóstico</div>
              <div style={{ whiteSpace: 'pre-wrap', margin: '4px 0 10px' }}>{full.diagnosis}</div>
            </>
          )}
          {full.validation && (
            <>
              <div className="muted">Validación</div>
              <div style={{ whiteSpace: 'pre-wrap', margin: '4px 0 10px' }}>{full.validation}</div>
            </>
          )}
          {full.diff && (
            <>
              <div className="muted">Diff propuesto</div>
              <pre className="diff">{colorizeDiff(full.diff)}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
