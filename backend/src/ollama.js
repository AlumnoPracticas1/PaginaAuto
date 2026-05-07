// Cliente minimal para Ollama local (http://localhost:11434).
// Modelo por defecto: qwen2.5:3b. Configurable vía env OLLAMA_MODEL / OLLAMA_URL.

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

export async function ollamaChat({ messages, system, model = OLLAMA_MODEL, temperature = 0.2, timeoutMs = 60000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body = {
      model,
      stream: false,
      options: { temperature },
      messages: system
        ? [{ role: 'system', content: system }, ...messages]
        : messages,
    };
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`Ollama HTTP ${r.status}: ${t.slice(0, 200)}`);
    }
    const j = await r.json();
    return j?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

// Conversación de 2 mensajes: REPORTER analiza el error y FIXER propone arreglo.
export async function repairConversation({ message, file, line, stack, source, deployer, catalogCode, catalogInfo }) {
  const errBlock = [
    `Mensaje: ${message || '(sin mensaje)'}`,
    file ? `Archivo: ${file}${line ? ':' + line : ''}` : null,
    source ? `Tipo: ${source}` : null,
    deployer ? `Plataforma: ${deployer}` : null,
    catalogCode ? `Código catálogo: ${catalogCode}` : null,
    catalogInfo?.cause ? `Causa conocida: ${catalogInfo.cause}` : null,
    catalogInfo?.solution ? `Solución sugerida: ${catalogInfo.solution}` : null,
    stack ? `Stack:\n${String(stack).slice(0, 1500)}` : null,
  ].filter(Boolean).join('\n');

  // PASO 1 — REPORTER: explica claramente qué error es y por qué ocurre.
  const reporterPrompt = `Eres REPORTER, un analista de errores web.
Recibes un error y debes describirlo en 3-5 líneas, en español, sin código.
Explica:
1. Qué falló exactamente.
2. Causa más probable.
3. En qué fichero/línea se produce.
Sé conciso y técnico.`;

  const reporterReply = await ollamaChat({
    system: reporterPrompt,
    messages: [{ role: 'user', content: `Analiza este error:\n\n${errBlock}` }],
    temperature: 0.1,
  });

  // PASO 2 — FIXER: lee el análisis y propone el código corregido.
  const fixerPrompt = `Eres FIXER, un programador senior. Recibes el análisis de un error de REPORTER
y propones la corrección. Responde EXCLUSIVAMENTE en este formato:

EXPLICACIÓN: una línea diciendo qué cambias.
SNIPPET:
\`\`\`<lenguaje>
<código corregido o el bloque que reemplaza al original>
\`\`\`

Sé directo, sin preámbulos. Si no puedes inferir el código original, propón una pieza mínima reproducible.`;

  const fixerReply = await ollamaChat({
    system: fixerPrompt,
    messages: [
      { role: 'user', content: `Error original:\n${errBlock}\n\nAnálisis de REPORTER:\n${reporterReply}\n\nPropón la corrección.` },
    ],
    temperature: 0.2,
  });

  // Extrae el bloque de código si lo hay.
  const codeMatch = fixerReply.match(/```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/);
  const fixedCode = codeMatch ? codeMatch[1].trim() : null;

  return {
    model: OLLAMA_MODEL,
    conversation: [
      { role: 'reporter', content: reporterReply },
      { role: 'fixer', content: fixerReply },
    ],
    fixedCode,
  };
}

export async function ollamaHealth() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}
