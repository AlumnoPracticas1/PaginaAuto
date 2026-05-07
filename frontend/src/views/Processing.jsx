import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import PreviewCard from '../components/PreviewCard.jsx';

export default function Processing({ onChange }) {
  const [items, setItems] = useState([]);
  const load = async () => setItems(await api.previews('processing'));
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  const handle = () => { load(); onChange?.(); };
  return (
    <>
      <h2 className="view-title">⏳ Procesando</h2>
      {items.length === 0 && <div className="muted">Nada en proceso.</div>}
      {items.map(p => <PreviewCard key={p.id} p={p} onChange={handle} />)}
    </>
  );
}
