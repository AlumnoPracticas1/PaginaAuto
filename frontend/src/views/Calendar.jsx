import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

function ymd(d) { return d.toISOString().slice(0, 10); }

export default function Calendar() {
  const [notes, setNotes] = useState([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [date, setDate] = useState(ymd(new Date()));
  const [text, setText] = useState('');

  const load = async () => setNotes(await api.notes());
  useEffect(() => { load(); }, []);

  async function add() {
    if (!text.trim()) return;
    await api.addNote(date, text.trim());
    setText('');
    load();
  }
  async function del(id) { await api.delNote(id); load(); }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const today = ymd(new Date());
  const byDate = notes.reduce((m, n) => { (m[n.date] = m[n.date] || []).push(n); return m; }, {});

  return (
    <>
      <h2 className="view-title">🗓️ Calendario</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => setCursor(new Date(year, month - 1, 1))}>◀</button>
        <strong>{cursor.toLocaleString('es', { month: 'long', year: 'numeric' })}</strong>
        <button className="btn" onClick={() => setCursor(new Date(year, month + 1, 1))}>▶</button>
      </div>

      <div className="calendar">
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} className="muted" style={{ textAlign: 'center' }}>{d}</div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const k = ymd(c);
          return (
            <div key={i} className={`cal-cell ${k === today ? 'today' : ''}`} onClick={() => setDate(k)}>
              <div className="d">{c.getDate()}</div>
              {(byDate[k] || []).map(n => (
                <div key={n.id} className="cal-note" title={n.text}
                     onClick={(e) => { e.stopPropagation(); if (confirm('Eliminar nota?')) del(n.id); }}>
                  {n.text.slice(0, 20)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Nueva nota</h3>
        <div className="row">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input style={{ flex: 1 }} value={text} placeholder="Texto"
                 onChange={e => setText(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && add()} />
          <button className="btn primary" onClick={add}>Añadir</button>
        </div>
      </div>
    </>
  );
}
