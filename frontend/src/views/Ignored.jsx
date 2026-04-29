import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import PreviewCard from '../components/PreviewCard.jsx';

export default function Ignored({ onChange }) {
  const [items, setItems] = useState([]);
  const load = async () => setItems(await api.previews('ignored'));
  useEffect(() => { load(); }, []);
  const handle = () => { load(); onChange?.(); };
  return (
    <>
      <h2 className="view-title">🗑️ Ignorados</h2>
      {items.length === 0 && <div className="muted">Nada ignorado.</div>}
      {items.map(p => <PreviewCard key={p.id} p={p} onChange={handle} />)}
    </>
  );
}
