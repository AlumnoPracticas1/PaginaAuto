import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import Inbox from './views/Inbox.jsx';
import Urgent from './views/Urgent.jsx';
import Ignored from './views/Ignored.jsx';
import Processing from './views/Processing.jsx';
import Calendar from './views/Calendar.jsx';
import Summary from './views/Summary.jsx';
import Settings from './views/Settings.jsx';
import Live from './views/Live.jsx';
import Chat from './views/Chat.jsx';

const VIEWS = [
  { id: 'live',     label: '👁️ Ahora mismo' },
  { id: 'inbox',    label: '📥 Bandeja' },
  { id: 'urgent',   label: '🚨 Urgentes' },
  { id: 'calendar', label: '🗓️ Calendario' },
  { id: 'summary',  label: '📊 Resumen semanal' },
  { id: 'processing', label: '⏳ Procesando' },
  { id: 'ignored',  label: '🗑️ Ignorados' },
  { id: 'chat',     label: '💬 Chat IAs' },
  { id: 'settings', label: '⚙️ Configuración' },
];

export default function App() {
  const [view, setView] = useState('inbox');
  const [counts, setCounts] = useState({ pending: 0, urgent: 0, ignored: 0, processing: 0 });

  async function refreshCounts() {
    try {
      const [pending, urgent, ignored, processing] = await Promise.all([
        api.previews('pending'), api.previews('pending'), api.previews('ignored'), api.previews('processing'),
      ]);
      setCounts({
        pending: pending.length,
        urgent: urgent.filter(p => p.priority === 'urgent').length,
        ignored: ignored.length,
        processing: processing.length,
      });
    } catch {}
  }

  useEffect(() => {
    refreshCounts();
    const t = setInterval(refreshCounts, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="app">
      <nav className="side">
        <h1 className="brand">
          <span className="brand-logo" aria-hidden="true">A</span>
          <span className="brand-name">AvantDefw1</span>
        </h1>
        {VIEWS.map(v => (
          <div key={v.id}
               className={`nav-btn ${view === v.id ? 'active' : ''}`}
               onClick={() => setView(v.id)}>
            <span>{v.label}</span>
            {v.id === 'inbox'   && counts.pending > 0 && <span className="count">{counts.pending}</span>}
            {v.id === 'urgent'  && counts.urgent  > 0 && <span className="count urgent">{counts.urgent}</span>}
            {v.id === 'ignored' && counts.ignored > 0 && <span className="count">{counts.ignored}</span>}
            {v.id === 'processing' && counts.processing > 0 && <span className="count">{counts.processing}</span>}
          </div>
        ))}
      </nav>
      <main className="main">
        {view === 'live'     && <Live />}
        {view === 'inbox'    && <Inbox onChange={refreshCounts} />}
        {view === 'urgent'   && <Urgent onChange={refreshCounts} />}
        {view === 'calendar' && <Calendar />}
        {view === 'summary'  && <Summary />}
        {view === 'ignored'  && <Ignored onChange={refreshCounts} />}
        {view === 'processing' && <Processing onChange={refreshCounts} />}
        {view === 'chat'     && <Chat />}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  );
}
