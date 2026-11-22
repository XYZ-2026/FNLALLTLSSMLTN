// College-name resolution: aliases → IDF token match → trigram → Nemotron rerank/embed.

import { rerank, embed } from './llm.mjs';

// Common short names students use → regex on the official dataset name.
const ALIASES = [
  [/\bcoep\b/i, /COEP/i], [/\bvjti\b/i, /Veermata Jijabai/i], [/\bpict\b/i, /Pune Institute of Computer Technology/i],
  [/\bspit\b/i, /Sardar Patel Institute of Technology/i], [/\bspce\b/i, /Sardar Patel College of Engineering/i],
  [/\b(djsce|dj\s*sanghvi|djs)\b/i, /Dwarkadas J\.? Sanghvi/i], [/\b(kjsce|kj\s*somaiya|somaiya)\b/i, /Somaiya/i],
  [/\btsec\b|thadomal/i, /Thadomal Shahani/i], [/\bvesit\b/i, /Vivekanand Education Society/i],
  [/\b(crce|fr\.?\s*crce|agnel)\b/i, /Conceicao Rodrigues|Agnel/i], [/\b(vit\s*pune|vit\b(?!\s*vellore))/i, /^Vishwakarma Institute of Technology/i],
  [/\bviit\b/i, /Vishwakarma Institute of Information/i], [/\bpccoe\b/i, /Pimpri Chinchwad College of Engineering/i],
  [/\b(mit\s*wpu|wpu)\b/i, /MIT.*World Peace/i], [/\bmitaoe|mit\s*academy/i, /MIT Academy of Engineering/i],
  [/\bcummins\b/i, /Cummins/i], [/\b(wce|walchand\s*sangli|walchand\s*college)\b/i, /Walchand College of Engineering/i],
  [/\b(wit|walchand\s*solapur)\b/i, /Walchand Institute of Technology/i], [/\bycce\b/i, /Yeshwantrao Chavan/i],
  [/\b(rcoem|ramdeo\s*baba|rbu)\b/i, /Ramdeo Baba/i], [/\b(sggs|sggsie)/i, /Shri Guru Gobind Singhji/i],
  [/\baissms\b/i, /AISSMS|All India Shri Shivaji/i], [/\b(bvcoe|bharati\s*vidyapeeth)\b/i, /Bharati Vidyapeeth/i],
  [/\b(dy\s*patil|dyp|dypcoe)\b/i, /D\.?\s*Y\.?\s*Patil/i], [/\bsinhgad\b/i, /Sinhgad|Sinhagad/i], [/\bict\b/i, /Institute of Chemical Technology/i],
  [/\bdbatu\b|lonere/i, /Babasaheb Ambedkar Technological University/i], [/\bkk\s*wagh\b/i, /K\.?\s*K\.?\s*Wagh/i],
  [/\brait\b/i, /Ramrao Adik/i], [/\bait\s*pune|army\s*institute/i, /Army Institute of Technology/i], [/\bgcoea?\b/i, /Government College of Engineering/i],
  [/\bgcek|gce\s*karad/i, /Government College of Engineering,\s*Karad/i], [/\bpvg\b/i, /PVG/i], [/\bjspm\b/i, /JSPM|Jayawantrao Sawant/i],
  [/\bvnit\b/i, /Visvesvaraya National Institute/i], [/\bnitk\b|surathkal/i, /Surathkal/i], [/\b(nit\s*)?trichy\b/i, /Tiruchirappalli/i],
  [/\bmnnit\b/i, /Motilal Nehru/i], [/\bmnit\b/i, /Malaviya National/i], [/\bsvnit\b/i, /Sardar Vallabhbhai National/i],
  [/\biiitm\b|abv/i, /Atal Bihari Vajpayee/i], [/\bpec\b/i, /Punjab Engineering College/i], [/\bdtu\b/i, /Delhi Technological/i],
  [/\b(iit\s*)?bombay\b/i, /Indian Institute of Technology Bombay/i], [/\biit\s*(kgp|kharagpur)\b/i, /Kharagpur/i],
  [/\b(iit\s*)?bhu\b/i, /\(BHU\)|Banaras/i], [/\bism\b|dhanbad/i, /Dhanbad/i],
  [/\b(rvce|rv\s*college)\b/i, /R\.?\s*V\.?\s*College/i], [/\b(bmsce|bms\s*college)\b/i, /B\.?\s*M\.?\s*S\.?\s*College of Engineering/i],
  [/\bbmsit\b/i, /BMS Institute of Technology/i], [/\b(msrit|ramaiah)\b/i, /Ramaiah/i], [/\bdsce\b|dayananda\s*sagar/i, /Dayananda Sagar/i],
  [/\b(pes|pesu)\b/i, /\bPES\b/i], [/\bnmit\b/i, /Nitte Meenakshi/i], [/\bsit\s*tumkur|siddaganga/i, /Siddaganga/i],
  [/\bmit\s*manipal|manipal\s*campus/i, /Manipal/i], [/\bmit\s*bengaluru|mit\s*blr/i, /Bengaluru/i], [/\bsmit\b/i, /SMIT|Sikkim/i],
];

const STOP = new Set(('college colleges institute institutes engineering engg technology tech of the and for in at a an to my me i is are what whats which ' +
  'cutoff cutoffs cut off closing opening rank ranks percentile marks seat seats branch category round can get will chance chances ' +
  'about tell please kya hai ka ki ke me mein mera meri give show list all with from than more less best top good fees fee placement ' +
  'package cse cs it computer mechanical mech civil electrical entc ece science information data ai ml open obc sc st ews sebc girl boy ' +
  'university mhtcet mht cet josaa jee nit nits iiit gfti csab comedk dse diploma year 2026 2025 last previous do does did get got gets ' +
  'from have has had want need score scored admission which where how much many also only just any some other ' +
  'all india quota state home maharashtra karnataka pradesh tamil nadu bengal west uttar madhya andhra').split(' '));

// Remove "from <place>" / "I live in <place>" phrases: they describe the student, not a college.
export function stripHomePhrases(text) {
  return String(text).replace(/\b(i\s*am\s*)?(from|belong(ing)?\s*to|live\s*in|living\s*in|staying\s*in|resident\s*of|domicile\s*(of|is)?|home\s*(state|town|district|university)\s*(is|:)?)\s+[a-z.]+(\s+[a-z.]+)?/gi, ' ');
}

// Everyday words that are never part of a college name (guards the typo path).
const COMMON_WORDS = new Set(('have having want wants need needs score scored scoring admission admissions possible eligible option options ' +
  'should would could which where there their they them this that these those know tell help please thanks thank okay yes no not ' +
  'percent percentage girl girls boys male female home state quota general category caste reserved choice choices filling form prefer ' +
  'preference preferences expected predict prediction suggest suggestion compare comparison better between under within around about ' +
  'maharashtra karnataka india indian round rounds final first second third fourth mains main advanced exam result results details hostel').split(' '));

const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);

function trigrams(s) {
  const t = ' ' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
  const g = new Set();
  for (let i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3));
  return g;
}
function trigramSim(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.max(1, Math.min(a.size, b.size));
}

const indexCache = new Map(); // keyed by list content; callers rebuild name arrays per request
function buildIndex(names) {
  const docs = names.map((n) => ({ name: n, toks: new Set(tokenize(n)), tri: trigrams(n) }));
  const df = new Map();
  for (const d of docs) for (const t of d.toks) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;
  const idf = (t) => Math.log(1 + N / (df.get(t) || N * 10));
  return { docs, idf, df };
}

/**
 * Resolve college mentions in `text` against `names` (unique dataset names).
 * Returns up to `max` names, best first. Uses Nemotron rerank/embed only when
 * the cheap matchers are unsure.
 */
export async function matchColleges(rawText, names, { max = 3, allowRemote = true } = {}) {
  if (!names.length) return [];
  const text = stripHomePhrases(rawText);
  const key = `${names.length}|${names[0]}|${names[names.length - 1]}`;
  let idx = indexCache.get(key);
  if (!idx) { idx = buildIndex(names); indexCache.set(key, idx); }

  // 1. Aliases
  const aliasHits = [];
  for (const [q, target] of ALIASES) {
    if (q.test(text)) for (const d of idx.docs) if (target.test(d.name)) aliasHits.push(d.name);
  }
  if (aliasHits.length) {
    // Narrow alias hits further by any distinctive tokens (e.g. "sinhgad vadgaon")
    const qt = tokenize(text).filter((t) => !STOP.has(t));
    const scored = [...new Set(aliasHits)].map((n) => {
      const toks = new Set(tokenize(n));
      return { n, s: qt.reduce((a, t) => a + (toks.has(t) ? idx.idf(t) : 0), 0) };
    }).sort((a, b) => b.s - a.s);
    const top = scored[0].s;
    return scored.filter((x) => x.s >= top * 0.999).slice(0, Math.max(max, 6)).map((x) => x.n);
  }

  // 2. IDF-weighted token overlap on distinctive words
  const qtoks = tokenize(text).filter((t) => !STOP.has(t) && t.length > 2 && !/^\d+$/.test(t));
  if (!qtoks.length) return [];
  const known = qtoks.filter((t) => idx.df.has(t));
  const rare = known.filter((t) => idx.df.get(t) <= Math.max(3, names.length * 0.02));
  if (rare.length) {
    const scored = idx.docs.map((d) => ({ n: d.name, s: known.reduce((a, t) => a + (d.toks.has(t) ? idx.idf(t) : 0), 0) }))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    if (scored.length) {
      const top = scored[0].s;
      let hits = scored.filter((x) => x.s >= top * 0.85);
      // Ties ("sangli" matches several) → let a misspelt word ("walchnd") break them.
      const typo = qtoks.filter((t) => !idx.df.has(t) && !COMMON_WORDS.has(t) && t.length >= 4);
      if (hits.length > 1 && typo.length) {
        const tt = trigrams(typo.join(' '));
        const byTri = hits.map((h) => ({ ...h, t: trigramSim(tt, trigrams(h.n)) })).sort((a, b) => b.t - a.t);
        if (byTri[0].t >= 0.4 && byTri[0].t > (byTri[1]?.t ?? 0) + 0.1) hits = [byTri[0]];
      }
      return hits.slice(0, max).map((x) => x.n);
    }
  }

  // 3. Typos / partial names → only when some words are unknown to every
  //    college name (e.g. "walchnd"). Known-but-common words like a city name
  //    alone ("pune") are a region, not a college.
  const unknown = qtoks.filter((t) => !idx.df.has(t) && !COMMON_WORDS.has(t) && t.length >= 4);
  if (!unknown.length) return [];
  const qtri = trigrams(unknown.join(' '));
  const shortlist = idx.docs.map((d) => ({ n: d.name, s: trigramSim(qtri, d.tri) })).sort((a, b) => b.s - a.s).slice(0, 25);
  if (!shortlist.length || shortlist[0].s < 0.45) return [];

  // 4. Nemotron rerank (fallback: embeddings) to pick among the shortlist
  if (allowRemote) {
    const query = qtoks.join(' ');
    const docs = shortlist.map((x) => x.n);
    const rr = await rerank(query, docs).catch(() => null);
    if (rr && rr.length && rr[0].score >= 0.05 && (rr.length < 2 || rr[0].score >= rr[1].score * 1.3)) return [docs[rr[0].index]];
    if (!rr) {
      const vecs = await embed([query, ...docs]).catch(() => null);
      if (vecs) {
        const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y); };
        const sims = docs.map((n, i) => ({ n, s: cos(vecs[0], vecs[i + 1]) })).sort((a, b) => b.s - a.s);
        if (sims[0].s > 0.45) return [sims[0].n];
      }
    }
  }
  return shortlist[0].s >= 0.6 ? [shortlist[0].n] : [];
}
