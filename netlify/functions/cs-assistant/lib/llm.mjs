// OpenRouter client: ordered fallback across free models, streamed.

const BASE = 'https://openrouter.ai/api/v1';

// Chat models in priority order. Override with OPENROUTER_CHAT_MODELS (comma-separated).
// Super-VL leads because it answers a grounded prompt in ~3–7 s; Ultra is the
// strongest but measured 17–46 s for a full answer on the free tier, which can
// overrun a serverless time budget, so it is the first fallback.
export const CHAT_MODELS = (process.env.OPENROUTER_CHAT_MODELS || [
  'nvidia/nemotron-3.5-super-vl:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'baidu/ernie-5.5-flash-preview:free',
  'particle-ai/particle-1:free',
].join(',')).split(',').map((s) => s.trim()).filter(Boolean);

// Per-model request tweaks, measured against the grounded prompt:
// - Nemotron chat models spend the whole token budget "thinking" unless reasoning is off.
// - ERNIE rejects any attempt to disable/limit reasoning, so it gets headroom instead.
function modelOptions(model, maxTokens) {
  if (model.startsWith('nvidia/')) return { reasoning: { enabled: false }, max_tokens: maxTokens };
  if (model.startsWith('baidu/')) return { max_tokens: maxTokens + 4000 };
  return { reasoning: { effort: 'low', exclude: true }, max_tokens: maxTokens + 1500 };
}
// How long a model may stay silent before we try the next one.
function firstTokenWindow(model, i) {
  if (model.startsWith('baidu/')) return 15000; // reasons before answering
  if (model.includes('ultra')) return 9000;
  return i === 0 ? +(process.env.CS_PRIMARY_TTFT_MS || 7000) : 6000;
}

export const RERANK_MODEL = process.env.OPENROUTER_RERANK_MODEL || 'nvidia/nemotron-3.5-rerank-8b:free';
export const EMBED_MODELS = ['nvidia/nemotron-3.5-embed-1b:free', 'nvidia/nemotron-3.5-embed-8b:free'];

function headers() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.SITE_URL || 'https://counselling.collegesimplified.in',
    'X-Title': 'College Simplified Counsellor',
  };
}

async function postJson(path, body, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: ctrl.signal });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(j.error?.message || `HTTP ${res.status}`);
    return j;
  } finally { clearTimeout(t); }
}

export async function rerank(query, documents) {
  const j = await postJson('/rerank', { model: RERANK_MODEL, query, documents }, 4000);
  return (j.results || []).map((r) => ({ index: r.index, score: r.relevance_score })).sort((a, b) => b.score - a.score);
}

export async function embed(input) {
  for (const model of EMBED_MODELS) {
    try {
      const j = await postJson('/embeddings', { model, input }, 4000);
      return j.data.map((d) => d.embedding);
    } catch { /* next */ }
  }
  return null;
}

/**
 * Stream a chat completion, falling back through CHAT_MODELS.
 * A model is abandoned if it errors or produces no visible text within its
 * first-token window; once text starts flowing we commit to that model.
 * Resolves { model, text } or throws if every model failed.
 */
export async function streamChat({ messages, onDelta, deadline, maxTokens = 1400 }) {
  const errors = [];
  for (let i = 0; i < CHAT_MODELS.length; i++) {
    const model = CHAT_MODELS[i];
    const remaining = deadline - Date.now();
    if (remaining < 2500) { errors.push(`${model}: skipped (time budget)`); break; }
    const ttft = Math.min(firstTokenWindow(model, i), remaining - 1500);
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(new Error('first-token timeout')), ttft);
    let text = '';
    try {
      const res = await fetch(BASE + '/chat/completions', {
        method: 'POST', headers: headers(), signal: ctrl.signal,
        body: JSON.stringify({ model, messages, stream: true, temperature: 0.3, ...modelOptions(model, maxTokens) }),
      });
      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body.slice(0, 160)}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let committed = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let j; try { j = JSON.parse(data); } catch { continue; }
          if (j.error) throw new Error(j.error.message || 'stream error');
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) {
            if (!committed) {
              committed = true;
              clearTimeout(timer);
              // Hard stop for the whole answer so the function never overruns.
              timer = setTimeout(() => ctrl.abort(new Error('answer time budget')), Math.max(3000, deadline - Date.now()));
            }
            text += delta;
            onDelta(delta, model);
          }
        }
      }
      clearTimeout(timer);
      if (text.trim()) return { model, text };
      errors.push(`${model}: empty response`);
    } catch (e) {
      clearTimeout(timer);
      if (text.trim()) return { model, text, truncated: true };
      errors.push(`${model}: ${e?.message || e}`);
    }
  }
  const err = new Error('All models failed');
  err.details = errors;
  throw err;
}
