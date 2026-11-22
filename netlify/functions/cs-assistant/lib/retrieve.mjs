// Turns a parsed profile into grounded data blocks for the LLM.

import * as D from './data.mjs';
import { EXAMS, branchRegex, HOME_UNIS, MHT_REGION_WORDS } from './parse.mjs';
import { matchColleges } from './colleges.mjs';

// "Which NITs/colleges can I get with rank X" is a shortlist request even if a
// college-ish word appears; skip single-college lookup in that case.
function wantsShortlist(p) {
  const hasScore = p.percentile != null || p.rank != null || p.marks != null;
  return hasScore && /\b(which|what|kaun\w*|list|options|suggest|konse|best)\b/i.test(p.lastMessage) &&
    /\b(colleges?|nits?|iiits?|iits?|gftis?|institutes?|options|branches)\b/i.test(p.lastMessage);
}
const lookup = (p, names) => (wantsShortlist(p) ? Promise.resolve([]) : matchColleges(p.lastMessage, names, { max: 3 }));

const TOOLS = {
  MHTCET: [['MHT-CET College Predictor', 'mht_cet_college_predictor.html'], ['College Explorer & Cutoffs', 'college_explorer.html'], ['Compare Colleges', 'compare_colleges.html']],
  MHT_AI: [['JEE Main AIR → Maharashtra College Predictor', 'air.html']],
  DSE: [['DSE College Predictor', 'dse_college_predictor.html'], ['DSE Cutoff Explorer', 'dse_cutoff_checker.html']],
  JOSAA: [['JoSAA Predictor (NIT/IIIT/GFTI)', 'josaa.html'], ['JoSAA Cutoff Checker', 'josaa_cutoff.html']],
  IIT: [['JoSAA IIT Predictor', 'josaa_iit.html']],
  CSAB: [['CSAB Predictor', 'csab.html']],
  COMEDK: [['COMEDK Predictor', 'comedk_predictor.html'], ['COMEDK Cutoffs', 'comedk_cutoff.html']],
  MANIPAL: [['Manipal Cutoffs', 'manipal_cutoff.html']],
};
export const PREF_BUILDERS = {
  MHTCET: 'preference-builder.html', MHT_AI: 'preference-builder.html', DSE: 'dse-preference-builder.html',
  JOSAA: 'josaa-preference-builder.html', IIT: 'josaa-preference-builder.html', CSAB: 'josaa-preference-builder.html', COMEDK: 'comedk-preference-builder.html',
};

const fmt = (n, d = 2) => (n == null ? '–' : typeof n === 'number' ? (Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toFixed(d)) : String(n));
function table(headers, rows) {
  if (!rows.length) return '(no matching rows)';
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map((c) => String(c ?? '–').replace(/\|/g, '/')).join(' | ')} |`)].join('\n');
}
const uniq = (a) => [...new Set(a)];
const shortBranch = (b) => b.replace(/\s*\(4 Years, Bachelor of Technology\)/i, '').replace(/\s*\(5 Years,.*?\)/i, ' (5-yr dual)').trim();

function branchFilter(branches) {
  const res = branches.map(branchRegex).filter(Boolean);
  return res.length ? (name) => res.some((re) => re.test(name)) : () => true;
}

/* ───────── MHT-CET seat-type eligibility ───────── */
const MHT_CAT_RE = /^(G|L)(OPEN|OBC|SC|ST|SEBC|VJ|NT1|NT2|NT3)(S|H|O)$/;
const MHT_SPECIAL_RE = /^(PWDR?|DEFR?)(OPEN|OBC|SC|ST|SEBC|VJ|NT1|NT2|NT3)(S|H|O)$/;

export function mhtEligibility(p) {
  const base = p.cat && !['KKR', 'TFWS', 'EWS'].includes(p.cat) ? p.cat : 'OPEN';
  const bases = uniq([base, 'OPEN']);
  const genders = p.gender === 'F' ? ['G', 'L'] : ['G'];
  return (row) => {
    let m = row.cat.match(MHT_CAT_RE);
    let suffix;
    if (m) {
      if (!genders.includes(m[1]) || !bases.includes(m[2])) return false;
      suffix = m[3];
    } else if ((m = row.cat.match(MHT_SPECIAL_RE))) {
      if (!p.special || !m[1].startsWith(p.special) || !bases.includes(m[2])) return false;
      suffix = m[3];
    } else {
      if (row.cat === 'EWS') return p.cat === 'EWS';
      if (row.cat === 'TFWS') return p.cat === 'TFWS';
      if (row.cat === 'MI') return p.special === 'MI';
      return false;
    }
    if (suffix === 'S') return true;
    if (!p.homeUni) return suffix === 'O'; // conservative: assume outside the college's home university
    return row.hu === p.homeUni ? suffix === 'H' : suffix === 'O';
  };
}

function chanceByPct(user, closing) {
  const m = user - closing;
  if (m >= 1.5) return 'Safe';
  if (m >= 0) return 'Likely';
  if (m >= -1.5) return 'Reach';
  return null;
}
function chanceByRank(user, closing) {
  const r = closing / user;
  if (r >= 1.15) return 'Safe';
  if (r >= 1) return 'Likely';
  if (r >= 0.9) return 'Reach';
  return null;
}
// Pick a balanced shortlist: strongest colleges in each band.
function balance(list, scoreKey, desc, caps = { Reach: 6, Likely: 10, Safe: 8 }, perCollege = 2) {
  const out = [];
  for (const band of ['Reach', 'Likely', 'Safe']) {
    const sorted = list.filter((x) => x.chance === band).sort((a, b) => (desc ? b[scoreKey] - a[scoreKey] : a[scoreKey] - b[scoreKey]));
    const seen = new Map();
    let n = 0;
    for (const x of sorted) {
      if (n >= caps[band]) break;
      const c = seen.get(x.college) || 0;
      if (c >= perCollege) continue;
      seen.set(x.college, c + 1);
      out.push(x);
      n++;
    }
  }
  return out;
}

function mhtProfileLine(p, estPct) {
  const score = p.percentile != null ? p.percentile + ' percentile' : estPct != null ? `~${estPct} percentile (estimated from ${p.marks} marks)` : p.rank != null ? 'rank ' + p.rank : 'score not given';
  return `Student: ${score}; category ${p.cat || 'not given (assumed OPEN)'}${p.special ? ' + ' + p.special : ''}; ` +
    `gender ${p.gender === 'F' ? 'female (eligible for G + L seats)' : p.gender === 'M' ? 'male' : 'not given (assumed male / gender-neutral G seats)'}; ` +
    `home university ${p.homeUni || 'not given (assumed OTHER-than-home seats; home-university seats are usually easier)'}` +
    (p.cat && p.cat !== 'OPEN' ? `. Note: a ${p.cat} student can claim both ${p.cat} seats and OPEN seats (seat codes like GOPENS/GOPENO/LOPENH are OPEN seats, not minority or special quotas); the table keeps whichever is easier per college-branch.` : '');
}

/* ───────── Conversions ───────── */
function mhtConvert(p) {
  const blocks = [];
  let estPct = null;
  if (p.marks != null) {
    const row = D.mhtMarksToPct().find((r) => { const [lo, hi] = r.marks.split('-').map(Number); return p.marks >= lo && p.marks <= hi; });
    if (row) {
      blocks.push(`MHT-CET marks → percentile (site table, moderate shift): ${p.marks} marks falls in band ${row.marks} → about ${row.pct} percentile. Actual percentile depends on shift difficulty.`);
      estPct = parseFloat(String(row.pct).split('-')[0]);
    }
  }
  const pct = p.percentile ?? estPct;
  if (pct != null) {
    const t = D.mhtPctToRank();
    const r = t.reduce((best, x) => (Math.abs(x.pct - pct) < Math.abs(best.pct - pct) ? x : best), t[0]);
    if (r) blocks.push(`MHT-CET percentile → state merit rank (site table): ~${pct} percentile ≈ rank ${fmt(r.min)}–${fmt(r.max)} (nearest table row ${r.pct}).`);
  }
  return { blocks, estPct };
}
function jeeConvert(p) {
  if (p.percentile == null) return [];
  const t = D.jeePctToRank();
  const r = t.reduce((best, x) => (Math.abs(x.pct - p.percentile) < Math.abs(best.pct - p.percentile) ? x : best), t[0]);
  return r ? [`JEE Main percentile → CRL (site table): ${p.percentile} percentile ≈ CRL rank ${fmt(r.rank)} (nearest row ${r.pct}). Category rank will be lower (better).`] : [];
}

/* ───────── Placements / rankings ───────── */
function placementBlocks(colleges, exam) {
  const out = [];
  if (!colleges.length) return out;
  // Placement files use short names ("COEP Technological University", "IIT Bombay"),
  // cutoff files use official ones, so match on distinctive words only.
  const GENERIC = /^(of|and|the|college|engineering|institute|technology|technological|university|national|indian|information|management|research|science|sciences|education|society|trust|s|dr|shri|sri|mandal|campus|school)$/;
  const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !GENERIC.test(w)));
  const abbrev = (s) => String(s).replace(/Indian Institute of Technology/i, 'IIT').replace(/National Institute of Technology/i, 'NIT').replace(/Indian Institute of Information Technology/i, 'IIIT');
  const best = (name, list) => {
    const a = words(abbrev(name));
    let top = null, topScore = 0;
    for (const t of list) {
      const b = words(t.college);
      if (!b.size) continue;
      let inter = 0; for (const w of b) if (a.has(w)) inter++;
      const score = inter / b.size; // share of the short name's distinctive words present
      if (score > topScore) { topScore = score; top = t; }
    }
    return topScore >= 0.6 ? top : null;
  };
  const national = ['JOSAA', 'IIT', 'CSAB'].includes(exam);
  for (const c of colleges.slice(0, 4)) {
    if (national) {
      const n = best(c, D.nationalPlacements());
      if (n) out.push(`Placement (site data): ${n.college} (${[n.type, n.tier].filter(Boolean).join(', ')}) — avg ${n.avg}, median ${n.median}, highest ${n.highest}, placed ${n.placed}.`);
    } else {
      const t = best(c, D.placementTier());
      if (t) out.push(`Placement (site data): ${t.college} — avg package ${t.avg} LPA, ${t.tier}.`);
    }
  }
  return out;
}
function regionRankingBlock(p) {
  const map = { 6: 'PUNE', 3: 'MUMBAI', 4: 'NAGPUR', 5: 'NASHIK', 2: 'AURANGABAD', 1: 'AMRAVATI' };
  const regs = p.regions.length ? p.regions : [];
  if (!regs.length) {
    const tier = D.placementTier().slice(0, 15);
    return `Top Maharashtra colleges by average package (site placement-tier data):\n` + table(['#', 'College', 'Avg LPA', 'Tier'], tier.map((t, i) => [i + 1, t.college, t.avg, t.tier]));
  }
  return regs.map((d) => {
    const r = D.regionRanking(map[d]).slice(0, 15);
    return `College Simplified ${map[d]} region ranking (top 15):\n` + table(['Rank', 'College', 'DTE code'], r.map((x) => [x.rank, x.college, /^0+$/.test(x.code) ? '–' : x.code]));
  }).join('\n\n');
}

/* ───────── Exam handlers ───────── */
async function mhtcet(p, out) {
  const conv = mhtConvert(p);
  out.blocks.push(...conv.blocks);
  const pct = p.percentile ?? conv.estPct;
  const round = p.round && p.round <= 4 ? p.round : null;
  const r1 = D.mhtRound(round || 1);
  const names = uniq(r1.map((r) => r.college));
  const colleges = await lookup(p, names);
  const okBranch = branchFilter(p.branches);
  const elig = mhtEligibility(p);
  out.blocks.push(mhtProfileLine(p, p.percentile == null ? conv.estPct : null));

  if (colleges.length) {
    out.matched = colleges;
    const set = new Set(colleges);
    const rounds = round ? [round] : [1, 2, 3, 4];
    const showCats = p.cat || p.gender || p.homeUni ? elig : (r) => /^GOPEN[SHO]$/.test(r.cat);
    const key = (r) => `${r.college}|${r.branch}|${r.cat}`;
    const merged = new Map();
    for (const n of rounds) {
      for (const r of D.mhtRound(n)) {
        if (!set.has(r.college) || !okBranch(r.branch) || !showCats(r)) continue;
        let e = merged.get(key(r));
        if (!e) { e = { college: r.college, code: r.code, branch: r.branch, cat: r.cat, hu: r.hu, rounds: {} }; merged.set(key(r), e); }
        e.rounds[n] = r;
      }
    }
    let list = [...merged.values()];
    list.sort((a, b) => a.college.localeCompare(b.college) || (b.rounds[rounds[0]]?.pct ?? 0) - (a.rounds[rounds[0]]?.pct ?? 0));
    list = list.slice(0, 40);
    const hdr = ['College (code)', 'Branch', 'Seat', ...rounds.map((n) => `R${n} %ile (rank)`)];
    if (pct != null || p.rank != null) hdr.push('Your chance (vs R' + rounds[0] + ')');
    const rowsOut = list.map((e) => {
      const cells = [`${e.college} (${e.code})`, e.branch, e.cat, ...rounds.map((n) => (e.rounds[n] ? `${fmt(e.rounds[n].pct, 2)} (${fmt(e.rounds[n].rank)})` : '–'))];
      const base = e.rounds[rounds[0]];
      if (pct != null || p.rank != null) cells.push(base ? (pct != null ? chanceByPct(pct, base.pct) : chanceByRank(p.rank, base.rank)) || 'Unlikely' : '–');
      return cells;
    });
    out.blocks.push(`MHT-CET 2026 CAP closing cutoffs for: ${colleges.join('; ')}${p.branches.length ? ' — branches: ' + p.branches.join(', ') : ''}. Seat codes: G=gender-neutral, L=ladies; suffix S=state-level, H=home-university, O=other-than-home-university.\n` + table(hdr, rowsOut));
    if (p.intents.includes('seats')) {
      const codes = new Set(list.map((e) => e.code));
      const typeOk = (t) => (p.special ? t === p.special || ['State Level', 'HU', 'OHU'].includes(t) : ['State Level', 'HU', 'OHU'].includes(t));
      const seats = D.mhtSeatMatrix().filter((s) => codes.has(s.code) && okBranch(s.branch) && typeOk(s.rowType)).slice(0, 25);
      out.blocks.push('MHT-CET 2026 seat matrix (Seat pool: State Level = open to all Maharashtra; HU = home-university candidates; OHU = other-university candidates; OPEN/OBC/... counts include ladies seats):\n' +
        table(['College', 'Branch', 'Seat pool', 'CAP seats (course)', 'OPEN', 'OBC', 'SC', 'ST', 'SEBC', 'EWS', 'TFWS', 'All-India'], seats.map((s) => [s.college, s.branch, s.rowType, s.cap, s.open, s.obc, s.sc, s.st, s.sebc, s.ews, s.tfws, s.allIndia])));
    }
    out.blocks.push(...placementBlocks(colleges, 'MHTCET'));
    return;
  }

  if (p.intents.includes('ranking') && pct == null && p.rank == null) {
    out.blocks.push(regionRankingBlock(p));
    return;
  }

  if (pct != null || p.rank != null) {
    const regionOk = p.regions.length ? (r) => p.regions.includes(r.regionDigit) : () => true;
    const best = new Map();
    for (const r of r1) {
      if (!elig(r) || !okBranch(r.branch) || !regionOk(r)) continue;
      const chance = pct != null ? (r.pct != null ? chanceByPct(pct, r.pct) : null) : r.rank != null ? chanceByRank(p.rank, r.rank) : null;
      if (!chance) continue;
      const k = `${r.college}|${r.branch}`;
      const prev = best.get(k);
      // keep the easiest seat the student qualifies for
      if (!prev || (pct != null ? r.pct < prev.pct : r.rank > prev.rank)) best.set(k, { ...r, chance });
    }
    const list = balance([...best.values()], pct != null ? 'pct' : 'rank', pct != null);
    out.blocks.push(`MHT-CET 2026 CAP Round ${round || 1} prediction (${list.length} of ${best.size} eligible college-branch options shown; Reach = needs cutoff to drop slightly, Likely = within 1.5 percentile above cutoff, Safe = 1.5+ above).` +
      `${p.regions.length ? ' Regions: ' + p.regions.map((d) => D.MHT_REGION_BY_DIGIT[d]).join(', ') + '.' : ''}${p.branches.length ? ' Branches: ' + p.branches.join(', ') + '.' : ''}\n` +
      table(['Chance', 'College (code)', 'Branch', 'Seat', 'Closing %ile', 'Closing rank', 'Status'], list.map((r) => [r.chance, `${r.college} (${r.code})`, r.branch, r.cat, fmt(r.pct, 2), fmt(r.rank), r.status])));
    out.predicted = list.length;
    return;
  }
  if (p.intents.includes('ranking')) out.blocks.push(regionRankingBlock(p));
  else out.missing.push('percentile or rank', 'category', 'home university / district');
}

async function mhtAllIndia(p, out) {
  const round = p.round && p.round <= 4 ? p.round : 1;
  const data = D.mhtAllIndia(round);
  out.blocks.push(...jeeConvert(p));
  const colleges = await lookup(p, uniq(data.map((r) => r.college)));
  const okBranch = branchFilter(p.branches);
  if (colleges.length) {
    const set = new Set(colleges);
    const rows = [];
    for (let n = 1; n <= 4; n++) for (const r of D.mhtAllIndia(n)) if (set.has(r.college) && okBranch(r.branch)) rows.push([`R${n}`, r.college, r.branch, fmt(r.rank), fmt(r.pct, 3)]);
    out.blocks.push('MHT-CET 2026 All-India quota (JEE Main) closing merit by round:\n' + table(['Round', 'College', 'Branch', 'Closing JEE rank', 'JEE %ile'], rows.slice(0, 40)));
    out.matched = colleges;
    return;
  }
  if (p.rank == null && p.percentile == null) { out.missing.push('JEE Main rank or percentile'); return; }
  const list = data.filter((r) => okBranch(r.branch)).map((r) => ({ ...r, chance: p.percentile != null ? (r.pct != null ? chanceByPct(p.percentile, r.pct) : null) : r.rank != null ? chanceByRank(p.rank, r.rank) : null })).filter((r) => r.chance);
  const shown = balance(list, p.percentile != null ? 'pct' : 'rank', p.percentile != null);
  out.blocks.push(`MHT-CET 2026 All-India quota Round ${round} prediction (JEE Main based, ${list.length} eligible):\n` + table(['Chance', 'College', 'Branch', 'Closing JEE rank', 'JEE %ile'], shown.map((r) => [r.chance, r.college, r.branch, fmt(r.rank), fmt(r.pct, 3)])));
  out.predicted = shown.length;
}

async function dse(p, out) {
  const round = p.round === 2 ? 2 : 1;
  const data = D.dseRound(round);
  const base = p.cat && !['KKR', 'TFWS'].includes(p.cat) ? p.cat : 'OPEN';
  const dseBase = { NT1: 'NTB', NT2: 'NTC', NT3: 'NTD', VJ: 'NTA' }[base] || base;
  const allowed = new Set(['G' + dseBase, 'GOPEN', ...(p.gender === 'F' ? ['L' + dseBase, 'LOPEN'] : []), ...(base === 'EWS' ? ['EWS'] : [])]);
  const okBranch = branchFilter(p.branches);
  const colleges = await lookup(p, uniq(data.map((r) => r.college)));
  out.blocks.push(`Student (DSE): diploma ${p.percentile != null ? p.percentile + '%' : p.rank != null ? 'rank ' + p.rank : 'score not given'}; category ${p.cat || 'assumed OPEN'}; gender ${p.gender === 'F' ? 'female' : 'assumed male'}.`);
  if (colleges.length) {
    const set = new Set(colleges);
    const rows = [];
    for (const n of [1, 2]) for (const r of D.dseRound(n)) if (set.has(r.college) && okBranch(r.branch) && (allowed.has(r.cat) || !p.cat)) rows.push([`CAP ${n}`, r.college, r.branch, r.cat, fmt(r.pct, 2), fmt(r.rank)]);
    out.blocks.push('DSE 2026 closing cutoffs:\n' + table(['Round', 'College', 'Branch', 'Seat', 'Closing %', 'Rank'], rows.slice(0, 40)));
    out.matched = colleges;
    return;
  }
  if (p.percentile == null && p.rank == null) { out.missing.push('diploma percentage', 'category'); return; }
  const best = new Map();
  for (const r of data) {
    if (!allowed.has(r.cat) || !okBranch(r.branch)) continue;
    const chance = p.percentile != null ? (r.pct != null ? chanceByPct(p.percentile, r.pct) : null) : chanceByRank(p.rank, r.rank);
    if (!chance) continue;
    const k = r.college + '|' + r.branch;
    if (!best.has(k) || r.pct < best.get(k).pct) best.set(k, { ...r, chance });
  }
  const shown = balance([...best.values()], 'pct', true);
  out.blocks.push(`DSE 2026 CAP ${round} prediction (${best.size} eligible):\n` + table(['Chance', 'College', 'Branch', 'Seat', 'Closing %', 'Status'], shown.map((r) => [r.chance, r.college, r.branch, r.cat, fmt(r.pct, 2), r.status])));
  out.predicted = shown.length;
}

function centralCat(p) {
  const base = { OBC: 'OBC-NCL', SC: 'SC', ST: 'ST', EWS: 'EWS' }[p.cat] || 'OPEN';
  return p.special === 'PWD' ? `${base} (PwD)` : base;
}
async function central(exam, p, out) {
  const data = exam === 'IIT' ? D.iit() : exam === 'CSAB' ? D.csab() : D.josaa();
  const cat = centralCat(p);
  const gOk = (g) => g === 'Gender-Neutral' || (p.gender === 'F' && /female/i.test(g));
  const quotaOk = (r) => {
    if (exam === 'IIT') return r.quota === 'AI';
    const hs = exam === 'CSAB' ? 'Home State' : 'HS', os = exam === 'CSAB' ? 'Other State' : 'OS', ai = exam === 'CSAB' ? 'All India' : 'AI';
    if (r.quota === ai) return true;
    if (!p.state) return r.quota === os;
    const home = r.state && r.state.toLowerCase() === p.state.toLowerCase();
    return home ? r.quota === hs : r.quota === os;
  };
  const typeWanted = /\biiits?\b/i.test(p.lastMessage) && exam !== 'IIT' ? 'IIIT' : /\bnits?\b/i.test(p.lastMessage) ? 'NIT' : /\bgftis?\b/i.test(p.lastMessage) ? 'GFTI' : null;
  const okBranch = branchFilter(p.branches);
  const rLabel = exam === 'IIT' ? 'JEE Advanced category rank' : exam === 'CSAB' ? 'JEE Main rank (category rank for reserved seats)' : 'JEE Main CRL / category rank';
  out.blocks.push(`Student (${EXAMS[exam]}): ${p.rank != null ? rLabel + ' ' + p.rank : 'rank not given'}${p.percentile != null ? '; percentile ' + p.percentile : ''}; seat type ${cat}${p.cat ? '' : ' (assumed)'}; gender ${p.gender === 'F' ? 'female (Gender-Neutral + Female-only)' : 'Gender-Neutral'}; home state ${p.state || 'not given (Other-State quota assumed)'}.`);
  if (exam !== 'IIT') out.blocks.push(...jeeConvert(p));
  if (cat !== 'OPEN' && p.rank != null) out.blocks.push(`Note: closing ranks for ${cat} seats are CATEGORY ranks. If ${p.rank} is the student's CRL (common rank list), their ${cat} category rank is much lower (better) and results would improve. Ask them to confirm their category rank.`);

  const colleges = await lookup(p, uniq(data.map((r) => r.college)));
  const nRounds = exam === 'IIT' ? 6 : exam === 'CSAB' ? 3 : 5;
  if (colleges.length) {
    const set = new Set(colleges);
    const catFilter = p.cat || p.special ? (r) => r.cat === cat : (r) => r.cat === 'OPEN';
    const rows = data.filter((r) => set.has(r.college) && okBranch(r.branch) && catFilter(r) && gOk(r.gender)).slice(0, 40);
    out.blocks.push(`${EXAMS[exam]} 2026 closing ranks by round for ${colleges.join('; ')}:\n` +
      table(['Institute', 'Program', 'Quota', 'Seat', 'Gender', ...Array.from({ length: nRounds }, (_, i) => `R${i + 1}`), ...(p.rank != null ? ['Your chance'] : [])],
        rows.map((r) => [r.college, shortBranch(r.branch), r.quota, r.cat, /female/i.test(r.gender) ? 'Female-only' : 'Neutral', ...r.rounds.map((x) => fmt(x)), ...(p.rank != null ? [r.closing ? chanceByRank(p.rank, r.closing) || 'Unlikely' : '–'] : [])])));
    out.blocks.push(...placementBlocks(colleges, exam));
    out.matched = colleges;
    return;
  }
  if (p.rank == null) {
    if (p.intents.includes('placement')) out.blocks.push('National placement data (site):\n' + table(['Institute', 'Type', 'Avg', 'Median', 'Highest'], D.nationalPlacements().filter((n) => exam === 'IIT' ? n.type === 'IIT' : n.type !== 'IIT').slice(0, 20).map((n) => [n.college, n.type, n.avg, n.median, n.highest])));
    else out.missing.push(exam === 'IIT' ? 'JEE Advanced category rank' : 'JEE Main rank (CRL or category rank)', 'category', 'home state', 'gender');
    return;
  }
  const pool = data.filter((r) => r.cat === cat && gOk(r.gender) && quotaOk(r) && r.closing && (!typeWanted || r.type === typeWanted));
  const list = [];
  for (const r of pool) {
    if (!okBranch(r.branch)) continue;
    const chance = chanceByRank(p.rank, r.closing);
    if (chance) list.push({ ...r, chance });
  }
  // de-dup institute+program keeping the easiest eligible quota/gender
  const best = new Map();
  for (const r of list) { const k = r.college + '|' + r.branch; if (!best.has(k) || r.closing > best.get(k).closing) best.set(k, r); }
  const shown = balance([...best.values()], 'closing', false);
  const cols = ['Chance', 'Institute', 'Program', 'Quota', 'Final closing rank', 'Round-1 closing'];
  const toRow = (r) => [r.chance, r.college, shortBranch(r.branch), r.quota, fmt(r.closing), fmt(r.rounds[0])];
  out.blocks.push(`${EXAMS[exam]} 2026 prediction vs final-round closing rank (${best.size} eligible options${typeWanted ? ', ' + typeWanted + 's only' : ''}${p.branches.length ? ', branches: ' + p.branches.join(', ') : ''}):\n` + table(cols, shown.map(toRow)));
  if (!shown.length) {
    // Nothing reachable: show the closest misses and how many options exist in other branches.
    const near = pool.filter((r) => okBranch(r.branch)).sort((a, b) => b.closing - a.closing).slice(0, 8).map((r) => ({ ...r, chance: 'Out of reach (closest)' }));
    if (near.length) out.blocks.push('Closest options that are still out of reach (highest closing ranks for the requested filter):\n' + table(cols, near.map(toRow)));
    if (p.branches.length) {
      const other = pool.filter((r) => chanceByRank(p.rank, r.closing)).length;
      out.blocks.push(`Without the branch filter there are ${other} reachable program/quota options for this rank and seat type.`);
    }
  }
  out.predicted = shown.length;
}

async function comedk(p, out) {
  const quota = p.cat === 'KKR' ? 'KKR' : 'GM';
  const data = D.comedk().filter((r) => r.quota === quota);
  const okBranch = branchFilter(p.branches);
  const colleges = await lookup(p, uniq(D.comedk().map((r) => r.college)));
  out.blocks.push(`Student (COMEDK): ${p.rank != null ? 'rank ' + p.rank : 'rank not given'}; quota ${quota}${p.cat === 'KKR' ? '' : ' (assumed; KKR only for Kalyana-Karnataka candidates)'}.`);
  if (colleges.length) {
    const set = new Set(colleges);
    const rows = D.comedk().filter((r) => set.has(r.college) && okBranch(r.branch) && (p.cat === 'KKR' || r.quota === 'GM' || /kkr/i.test(p.lastMessage)));
    out.blocks.push('COMEDK 2026 closing ranks:\n' + table(['College', 'Branch', 'Quota', 'R1', 'R2', 'R3', 'R4', ...(p.rank != null ? ['Your chance'] : [])],
      rows.slice(0, 40).map((r) => [r.college, r.branch, r.quota, ...r.rounds.map((x) => fmt(x)), ...(p.rank != null ? [r.closing ? chanceByRank(p.rank, r.closing) || 'Unlikely' : '–'] : [])])));
    const firstWords = colleges.map((c) => c.split(/[-,]/)[0].toLowerCase().trim());
    const fees = D.comedkFees().filter((f) => firstWords.some((w) => f.college.toLowerCase().startsWith(w)) && okBranch(f.branch)).slice(0, 20);
    if (fees.length) out.blocks.push('COMEDK fees & seats (site data):\n' + table(['College', 'Course', 'Total seats', 'GM', 'KKR', 'Total fee ₹/yr'], fees.map((f) => [f.college, f.branch, f.seats, f.gm, f.kkr, fmt(f.fee)])));
    out.matched = colleges;
    return;
  }
  if (p.rank == null) { out.missing.push('COMEDK rank', 'GM or KKR quota'); return; }
  const best = new Map();
  for (const r of data) {
    if (!okBranch(r.branch) || !r.closing) continue;
    const chance = chanceByRank(p.rank, r.closing);
    if (chance) { const k = r.college + '|' + r.branch; if (!best.has(k)) best.set(k, { ...r, chance }); }
  }
  const shown = balance([...best.values()], 'closing', false);
  out.blocks.push(`COMEDK 2026 ${quota} prediction vs last-round closing rank (${best.size} eligible):\n` + table(['Chance', 'College', 'Branch', 'Final closing', 'R1 closing'], shown.map((r) => [r.chance, r.college, r.branch, fmt(r.closing), fmt(r.rounds[0])])));
  out.predicted = shown.length;
}

async function manipalExam(p, out) {
  const data = D.manipal();
  const okBranch = branchFilter(p.branches);
  const rows = data.filter((r) => okBranch(r.branch)).map((r) => ({ ...r, chance: p.rank != null && r.closing ? chanceByRank(p.rank, r.closing) || 'Unlikely' : '–' }));
  out.blocks.push(`Manipal (MET) 2026 closing ranks${p.rank != null ? ' vs your rank ' + p.rank : ''}:\n` + table(['Campus', 'Branch', 'R1', 'R2', 'R3', 'R4', 'Chance'], rows.slice(0, 40).map((r) => [r.college, r.branch, ...r.rounds.map((x) => fmt(x)), r.chance])));
}

/* ───────── Entry ───────── */
// No exam keyword: infer from which dataset names the college (local matching only).
async function inferExam(p) {
  const probes = [
    ['MHTCET', () => D.mhtRound(1)], ['JOSAA', () => D.josaa()], ['IIT', () => D.iit()], ['COMEDK', () => D.comedk()], ['MANIPAL', () => D.manipal()],
  ];
  // Place names ("best colleges in nagpur") describe a region, not a specific college.
  let text = p.lastMessage;
  for (const [, re] of [...HOME_UNIS, ...MHT_REGION_WORDS]) text = text.replace(new RegExp(re.source, 'gi'), ' ');
  for (const [exam, get] of probes) {
    const hit = await matchColleges(text, uniq(get().map((r) => r.college)), { max: 1, allowRemote: false });
    if (hit.length) return exam;
  }
  return null;
}

export async function retrieve(p) {
  let exam = p.exam;
  // The last message names no exam: a college it mentions decides (e.g. "Walchand
  // Sangli cutoff" asked on the JoSAA page, or "VNIT" after an MHT-CET chat).
  if (!p.examExplicit) {
    const inferred = await inferExam(p);
    const sameColleges = (inferred === 'MHTCET' && (exam === 'DSE' || exam === 'MHT_AI')) || (inferred === 'JOSAA' && exam === 'CSAB');
    if (inferred && !sameColleges) exam = inferred;
  }
  // MHT-CET is the site's primary counselling; use it for bare scores/branch questions.
  if (!exam && (p.percentile != null || p.marks != null || p.rank != null || p.branches.length || p.intents.some((i) => ['cutoff', 'predict', 'seats', 'ranking'].includes(i)) || p.regions.length)) {
    exam = 'MHTCET';
    p.examAssumed = true;
  }
  const out = { exam, blocks: [], missing: [], matched: [], predicted: 0, tools: [] };
  if (!exam) {
    out.blocks.push('No exam identified yet. Available datasets: MHT-CET 2026 CAP R1–R4 (state + All-India), DSE 2026 CAP 1–2, JoSAA 2026 (NIT/IIIT/GFTI R1–R5, IIT R1–R6), CSAB 2026, COMEDK 2026, Manipal 2026, seat matrix, placements, region rankings.');
    if (p.intents.includes('ranking') || p.intents.includes('placement')) out.blocks.push(regionRankingBlock(p));
    return out;
  }
  out.examExplicit = p.examExplicit;
  out.tools = (TOOLS[exam] || []).map(([label, href]) => ({ label, href }));
  if (exam === 'MHTCET') await mhtcet(p, out);
  else if (exam === 'MHT_AI') await mhtAllIndia(p, out);
  else if (exam === 'DSE') await dse(p, out);
  else if (exam === 'JOSAA' || exam === 'IIT' || exam === 'CSAB') await central(exam, p, out);
  else if (exam === 'COMEDK') await comedk(p, out);
  else if (exam === 'MANIPAL') await manipalExam(p, out);
  return out;
}
