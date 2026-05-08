// Cliente del servicio github-app (intermediario que crea ramas + PRs en
// repos cliente). Si GITHUB_PROXY_URL no está definido, isEnabled() devuelve
// false y el flujo cae al modo "escribir en disco local" de toda la vida.
//
// Mapeo APP_REPOS_JSON: relaciona el extra.app que envía cliente-escucha con
// un { owner, repo, branch }. Ejemplo:
//   APP_REPOS_JSON={"avantservice":{"owner":"AlumnoPracticas1","repo":"avantservice","branch":"main"}}

const PROXY_URL = (process.env.GITHUB_PROXY_URL || '').replace(/\/$/, '');
const INTERNAL_TOKEN = process.env.GITHUB_PROXY_INTERNAL_TOKEN || '';

let APP_REPOS = {
  avantservice: { owner: 'AlumnoPracticas1', repo: 'avantservice', branch: 'main' },
};
try {
  if (process.env.APP_REPOS_JSON) {
    APP_REPOS = { ...APP_REPOS, ...JSON.parse(process.env.APP_REPOS_JSON) };
  }
} catch (e) {
  console.warn('[github-proxy] APP_REPOS_JSON inválido:', e.message);
}

export function isEnabled() {
  return !!PROXY_URL;
}

export function repoForApp(appName) {
  if (!appName) return null;
  const key = String(appName).toLowerCase().trim();
  return APP_REPOS[key] || null;
}

export async function ghProxyHealth() {
  if (!PROXY_URL) return { ok: false, reason: 'GITHUB_PROXY_URL no configurado' };
  try {
    const r = await fetch(`${PROXY_URL}/health`, { signal: AbortSignal.timeout(3000) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, ...j };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// files: [{ path, content }] — contenido COMPLETO post-parche del archivo
// priority: 'urgent'|'high'|'medium'|'low'
export async function ghProxyPropose({ owner, repo, baseBranch, files, message, priority, previewId }) {
  if (!PROXY_URL) throw new Error('github-proxy no habilitado (falta GITHUB_PROXY_URL)');
  const headers = { 'Content-Type': 'application/json' };
  if (INTERNAL_TOKEN) headers['X-Internal-Token'] = INTERNAL_TOKEN;
  const r = await fetch(`${PROXY_URL}/propose`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ owner, repo, baseBranch, files, message, priority, previewId }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
