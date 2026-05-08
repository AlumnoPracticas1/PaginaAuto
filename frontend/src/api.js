// En desarrollo Vite proxy redirige /api/* -> :4000.
// En producción (Vercel) define VITE_API_BASE con la URL pública del backend Railway.
const BASE = import.meta.env.VITE_API_BASE || '/api';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch { data = txt; }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  health:        ()        => req('GET', '/health'),
  previews:      (status)  => req('GET', `/previews${status ? `?status=${status}` : ''}`),
  preview:       (id)      => req('GET', `/previews/${id}`),
  approve:       (id)      => req('POST', `/previews/${id}/approve`),
  reject:        (id)      => req('POST', `/previews/${id}/reject`),
  resolveIgnored:(id)      => req('POST', `/previews/${id}/resolve`),
  notes:         ()        => req('GET', '/notes'),
  addNote:       (date, text) => req('POST', '/notes', { date, text }),
  delNote:       (id)      => req('DELETE', `/notes/${id}`),
  summary:       ()        => req('GET', '/summary/weekly'),
  notifications: ()        => req('GET', '/notifications'),
  chat:          (msg)     => req('POST', '/chat', { message: msg }),
  chatHistory:   ()        => req('GET', '/chat/history'),
  report:        (err)     => req('POST', '/report', err),
  inspect:       ()        => req('POST', '/inspect'),
};
