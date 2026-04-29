import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function Chat() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { api.chatHistory().then(setMsgs).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send() {
    const m = text.trim();
    if (!m) return;
    setMsgs(x => [...x, { role: 'user', content: m, id: Date.now() }]);
    setText(''); setBusy(true);
    try {
      const { reply } = await api.chat(m);
      setMsgs(x => [...x, { role: 'assistant', content: reply, id: Date.now() + 1 }]);
    } catch (e) {
      setMsgs(x => [...x, { role: 'assistant', content: `Error: ${e.message}`, id: Date.now() + 1 }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <h2 className="view-title">💬 Chat con IAs</h2>
      <div className="card" style={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 6 }}>
          {msgs.map(m => (
            <div key={m.id} className={`chat-msg ${m.role}`} style={{ whiteSpace: 'pre-wrap' }}>
              {m.content}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input style={{ flex: 1 }} value={text}
                 placeholder="Pregunta o instrucción…"
                 onChange={e => setText(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && !busy && send()} />
          <button className="btn primary" disabled={busy} onClick={send}>
            {busy ? '…' : 'Enviar'}
          </button>
        </div>
      </div>
    </>
  );
}
