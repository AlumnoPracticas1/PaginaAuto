import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import PreviewCard from '../components/PreviewCard.jsx';

export default function Urgent({ onChange }) {
  const [items, setItems] = useState([]);
  const load = async () => {
    const all = await api.previews('pending');
    setItems(all.filter(p => p.priority === 'urgent'));
  };
  useEffect(() => { load(); }, []);
  const handle = () => { load(); onChange?.(); };
  return (
    <>
      <h2 className="view-title">🚨 Urgentes</h2>
      {items.length === 0 && <div className="muted">Sin urgencias.</div>}
      {items.map(p => <PreviewCard key={p.id} p={p} onChange={handle} />)}
    </>
  );
}
