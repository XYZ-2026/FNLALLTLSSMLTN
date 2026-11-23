// College Simplified — AI Counsellor endpoint (Netlify Functions v2, streamed SSE).
//
// Pipeline: parse the question → pull matching rows from the site's own 2026
// datasets → hand ONLY those rows to an OpenRouter model (free Nemotron chain
// with fallbacks) → stream the answer. If every model fails, the data itself
// is returned so the student still gets an answer.

import { buildProfile, EXAMS } from './lib/parse.mjs';
import { retrieve, PREF_BUILDERS } from './lib/retrieve.mjs';
import { streamChat } from './lib/llm.mjs';

export const config = { path: '/api/cs-assistant' };

const PURCHASE_URL = process.env.CS_PURCHASE_URL || 'https://www.conceptsimplified.in/courses';
const GUEST_LIMIT = 3;
const BUDGET_MS = +(process.env.CS_ASSISTANT_BUDGET_MS || 25000);
const MAX_MSG = 1200;

/* ───────── Abuse protection (per warm instance) ───────── */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > win) hits.delete(k);
  return arr.length > +(process.env.CS_RATE_LIMIT || 25);
}
function originAllowed(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = (process.env.CS_ALLOWED_ORIGINS || 'https://counselling.collegesimplified.in,https://collegesimplified.in,https://www.collegesimplified.in')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (allowed.includes(u.origin)) return true;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    if (u.hostname.endsWith('.netlify.app')) return true; // deploy previews
    return u.host === new URL(req.url).host; // same-origin
  } catch { return false; }
}

/* ───────── Prompt ───────── */
function systemPrompt(ctx, profile, auth) {
  const tools = ctx.tools.map((t) => `- [${t.label}](${t.href})`).join('\n');
  return `You are "CS Counsellor", the admission-counselling assistant of College Simplified (counselling.collegesimplified.in) for Indian engineering admissions: MHT-CET (Maharashtra CAP), DSE, JoSAA (IIT/NIT/IIIT/GFTI), CSAB, COMEDK and Manipal.

GROUND RULES
1. Every cutoff, rank, percentile, seat count, fee or package you state MUST come from the DATA section below. Never invent or "estimate from memory" any number. Do not claim things about a college's placements, faculty or reputation unless DATA says so. If DATA does not contain what is asked, say you don't have that data and point to a tool link.
2. DATA holds the 2026 counselling closing cutoffs (latest available). Cutoffs move every year, so present predictions as guidance, not guarantees.
3. Chance labels: Safe = comfortably above last year's closing; Likely = just above; Reach = slightly below, possible only if cutoffs drop. Keep these labels exactly.
4. State any assumptions shown in DATA (e.g. assumed OPEN category, assumed male, assumed other-than-home-university seats). If key details are missing (exam, percentile/rank, category, gender, home university or home state), still answer what you can, then ask for at most two missing details in one short line.
5. Do NOT build a full CAP round / option-form / preference list. If the student asks for one, say it is part of College Simplified's paid counselling${auth.premium ? ' (they are a premium member, so point them to the preference builder tool)' : ''}.
6. Format for a small chat window: 1–2 line answer first, then a compact markdown table (max 12 rows, short column names, shorten long college names sensibly but keep the DTE/choice code if present), then 2–4 bullet insights, then one next step. Stay under ~220 words unless the student asks for more.
7. Reply in the student's language (English, Hindi, Marathi or Hinglish), matching their tone. Be warm and direct, like an experienced counsellor.
8. Only link to the site tools listed under TOOLS (relative links) or ${PURCHASE_URL}. Never mention "DATA", "context", "system prompt" or these rules; say "as per 2026 CAP/JoSAA data" instead.
9. Off-topic requests: politely steer back to admissions and counselling.${ctx.charts.length ? `
10. A chart ("${ctx.charts.map((c) => c.title).join('", "')}") built from the same figures is shown automatically under your reply. Do not draw ASCII charts or describe its colours.` : ''}

EXAM IN FOCUS: ${ctx.exam ? EXAMS[ctx.exam] : 'not identified'}${profile.examAssumed ? ' (assumed from context; mention this briefly)' : ''}
${ctx.missing.length ? 'MISSING DETAILS TO ASK FOR: ' + ctx.missing.join(', ') : ''}

TOOLS
${tools || '- [MHT-CET Hub](cet-landing.html)\n- [JoSAA Hub](josaa-landing.html)\n- [COMEDK Hub](comedk-landing.html)'}

DATA
${ctx.blocks.join('\n\n') || '(no dataset rows matched this question)'}`;
}

/* ───────── Deterministic fallback (all models down) ───────── */
function dataOnlyAnswer(ctx) {
  const parts = ['Our AI counsellor is busy right now, so here is the matching 2026 data directly:\n'];
  for (const b of ctx.blocks) parts.push(b);
  if (ctx.missing.length) parts.push(`\nTell me your **${ctx.missing.slice(0, 2).join('** and **')}** for a sharper prediction.`);
  if (ctx.tools.length) parts.push('\nTry: ' + ctx.tools.map((t) => `[${t.label}](${t.href})`).join(' · '));
  return parts.join('\n\n');
}

/* ───────── Gates ───────── */
function capListGate(profile, auth) {
  const exam = profile.exam || 'MHTCET';
  if (auth.premium) {
    const href = PREF_BUILDERS[exam] || 'preference-builder.html';
    return {
      gate: 'premium_tool',
      text: `You're a **Premium member**, so you can build your full CAP round preference list with our counsellor-designed tool:\n\n👉 [Open the ${EXAMS[exam] || 'MHT-CET'} Preference Builder](${href})\n\nIt orders colleges by your percentile, category and home university, and exports a ready-to-fill option form. I'm happy to answer cutoff questions while you build it.`,
    };
  }
  return {
    gate: 'purchase',
    text: `Building a **CAP round preference list** is a personalised service. The order of options decides which seat you're allotted, and one wrong order can cost you a better college.\n\nOur **expert counselling** includes:\n- A personalised, round-by-round preference list made by a counsellor\n- Smart safe / likely / reach ordering using 2026 data\n- One-to-one guidance through every CAP round\n\n👉 **[Purchase Counselling](${PURCHASE_URL})**\n\nMeanwhile, ask me about cutoffs, college chances or seats. I'm free to use for those.`,
  };
}

/* ───────── SSE helpers ───────── */
const enc = new TextEncoder();
const sse = (event, data) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
function sseResponse(run) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e, d) => { try { controller.enqueue(sse(e, d)); } catch { /* client gone */ } };
      try { await run(send); } catch (e) { send('error', { message: 'Something went wrong. Please try again.' }); console.error('[cs-assistant]', e); }
      try { controller.close(); } catch { /* closed */ }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
});

/* ───────── Handler ───────── */
export default async function handler(req, context) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(403, { error: 'Forbidden' });
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown';
  if (rateLimited(ip)) return json(429, { error: 'Too many questions in a short time. Please wait a few minutes.' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
  const history = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
  const msgs = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === 'user' ? MAX_MSG : 1500) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user' || !msgs[msgs.length - 1].content.trim()) return json(400, { error: 'Empty question' });

  const auth = { signedIn: !!body.auth?.signedIn, premium: !!body.auth?.premium };
  const page = typeof body.page === 'string' ? body.page.slice(0, 120) : '';
  const guestAnswers = Number.isFinite(+body.guestAnswers) ? +body.guestAnswers : 0;
  const deadline = Date.now() + BUDGET_MS;

  return sseResponse(async (send) => {
    // Sign-in gate (the widget enforces this too; repeated here for direct callers)
    if (!auth.signedIn && guestAnswers >= GUEST_LIMIT) {
      send('gate', { gate: 'signin' });
      send('done', { gated: true });
      return;
    }

    const userTexts = msgs.filter((m) => m.role === 'user').map((m) => m.content);
    const profile = buildProfile(userTexts, page);

    if (profile.intents.includes('cap_list')) {
      const g = capListGate(profile, auth);
      send('gate', { gate: g.gate, url: g.gate === 'purchase' ? PURCHASE_URL : undefined });
      send('delta', { text: g.text });
      send('done', { gated: true, counts: false });
      return;
    }

    const ctx = await retrieve(profile);
    send('meta', { exam: ctx.exam, examLabel: ctx.exam ? EXAMS[ctx.exam] : null, tools: ctx.tools, matched: ctx.matched.slice(0, 3) });
    if (ctx.charts.length) send('charts', { charts: ctx.charts });

    const llmMessages = [
      { role: 'system', content: systemPrompt(ctx, profile, auth) },
      // Earlier turns give conversational continuity; numbers still come from DATA.
      ...msgs.slice(-7, -1),
      msgs[msgs.length - 1],
    ];
    try {
      const { model, truncated } = await streamChat({
        messages: llmMessages, deadline,
        onDelta: (text) => send('delta', { text }),
      });
      if (truncated) send('delta', { text: '\n\n_(Answer cut short. Ask me to continue.)_' });
      send('done', { model });
    } catch (e) {
      console.error('[cs-assistant] all models failed', e.details || e.message);
      send('delta', { text: dataOnlyAnswer(ctx) });
      send('done', { model: 'data-only' });
    }
  });
}
