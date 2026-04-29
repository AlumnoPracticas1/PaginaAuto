import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const _z = Number(localStorage.getItem('ui.zoom'));
if (_z && _z > 0) document.body.style.zoom = _z;
document.documentElement.dataset.theme = localStorage.getItem('ui.theme') || 'dark';

createRoot(document.getElementById('root')).render(<App />);
