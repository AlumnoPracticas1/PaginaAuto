import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import PreviewCard from '../components/PreviewCard.jsx';

export default function Inbox({ onChange }) {
  const [items, setItems] = useState([]);

  async function load() {
    setItems(await api.previews('pending'));
  }
  useEffect(() => { load(); }, []);

  const handleChange = () => { load(); onChange?.(); };

  return (
    <>
      <h2 className="view-title">Bandeja</h2>
      {items.length === 0 && <div className="muted">No hay previews pendientes.</div>}
      {items.map(p => <PreviewCard key={p.id} p={p} onChange={handleChange} />)}
    </>
  );
}
