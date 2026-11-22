// Lazy, cached loaders for every dataset the College Simplified site ships.
// Each loader normalises its file into compact rows once per warm instance.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Netlify places `included_files` relative to the site root inside the bundle.
// Locally the site root is three levels above this file. Try both.
const ROOT_CANDIDATES = [
  process.env.CS_DATA_ROOT,
  process.env.LAMBDA_TASK_ROOT,
  process.cwd(),
  path.resolve(here, '../../../..'),
  path.resolve(here, '../../..'),
].filter(Boolean);

function resolveData(rel) {
  for (const root of ROOT_CANDIDATES) {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Dataset not found: ${rel}`);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(resolveData(rel), 'utf8'));
}

// Unwrap `{ "SOME_KEY": [...] }` files.
function rows(rel) {
  const j = readJson(rel);
  if (Array.isArray(j)) return j;
  const k = Object.keys(j)[0];
  return Array.isArray(j[k]) ? j[k] : [];
}

const num = (v) => {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const cache = new Map();
function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/* ─────────────── MHT-CET 2026 CAP (state) ─────────────── */
// Region from institute code prefix, same convention as mht_cet_college_predictor.html
export const MHT_REGION_BY_DIGIT = { 1: 'Amravati', 2: 'Chhatrapati Sambhajinagar', 3: 'Mumbai', 4: 'Nagpur', 5: 'Nashik', 6: 'Pune' };

export function mhtRound(n) {
  return memo(`mht${n}`, () =>
    rows(`CUTOFFS 2026/mhtcet_round${n}.json`)
      .filter((r) => r && r.institute_name && r.category)
      .map((r) => ({
        code: String(r.institute_code || '').padStart(5, '0'),
        choice: String(r.choice_code || ''),
        college: clean(r.institute_name),
        branch: clean(r.branch_name),
        cat: String(r.category).trim(),
        rank: num(r.rank),
        pct: num(r.percentile),
        seat: r.seat_type || '',
        status: r.status || '',
        hu: clean(r.home_university),
        city: clean(r.region),
        regionDigit: String(r.institute_code || '').replace(/^0+/, '').charAt(0),
      })),
  );
}

export function mhtSeatMatrix() {
  return memo('mhtSeats', () =>
    rows('CUTOFFS 2026/MHT_CET_2026_Seat_Matrix.json').map((r) => ({
      code: String(r.College_Code || '').padStart(5, '0'),
      college: clean(r.College_Name),
      branch: clean(r.Course_Name),
      choice: String(r.Choice_Code || ''),
      type: clean(r.Institute_Type),
      cap: num(r.CAP_Seats),
      total: num(r['Total_G+L']),
      open: (num(r.OPEN_G) || 0) + (num(r.OPEN_L) || 0),
      obc: (num(r.OBC_G) || 0) + (num(r.OBC_L) || 0),
      sc: (num(r.SC_G) || 0) + (num(r.SC_L) || 0),
      st: (num(r.ST_G) || 0) + (num(r.ST_L) || 0),
      sebc: (num(r.SEBC_G) || 0) + (num(r.SEBC_L) || 0),
      ews: num(r.EWS_Seats),
      tfws: num(r.TFWS_Seats),
      allIndia: num(r.All_India),
      minority: num(r.Minority_Seats),
      institute: num(r.Institute_Seats),
      rowType: r.Row_Type || '',
    })),
  );
}

/* ─────────────── MHT-CET All-India quota (JEE Main) ─────────────── */
export function mhtAllIndia(n) {
  return memo(`mhtai${n}`, () =>
    rows(`CUTOFFS 2026/round${n}_all_india.json`).map((r) => {
      const merit = String(r['All India Merit'] || '');
      const m = merit.match(/([\d,]+)\s*\(([\d.]+)\)/);
      const inst = clean(r['Institute Name']);
      return {
        code: (inst.match(/^(\d{4,5})/) || [])[1] || String(r['College Code'] || ''),
        college: inst.replace(/^\d{4,5}\s*-\s*/, ''),
        branch: clean(r['Course Name']),
        rank: m ? num(m[1]) : null,
        pct: m ? num(m[2]) : null,
        exam: r['Merit Exam'] || 'JEE',
      };
    }),
  );
}

/* ─────────────── MHT-CET DSE (Direct Second Year) ─────────────── */
export function dseRound(n) {
  return memo(`dse${n}`, () =>
    rows(`DSE 2026/DSE_CAP_${n}_2026_cutoffs.json`).map((r) => ({
      code: String(r['Institute Code'] || '').padStart(5, '0'),
      college: clean(r.Institute),
      branch: clean(r.Branch),
      cat: String(r['Seat Type'] || '').trim(),
      rank: num(r.Rank),
      pct: num(r.Percentile),
      status: clean(r['Institute Status']),
      stage: r.Stage || '',
    })),
  );
}

/* ─────────────── JoSAA (NIT/IIIT/GFTI), CSAB, IIT ─────────────── */
function closingRounds(r, maxRound) {
  const out = [];
  for (let i = 1; i <= maxRound; i++) out.push(num(r[`Round ${i} - Closing Rank `] ?? r[`Round ${i} - Closing Rank`]));
  return out;
}
const lastNonNull = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null; };

export function josaa() {
  return memo('josaa', () =>
    rows('JOSAA/JOSAA_CUTOFF_CONSOLIDATED_2026.json').map((r) => {
      const rounds = closingRounds(r, 5);
      return {
        college: clean(r.Institute), state: clean(r.State), type: r.Type,
        branch: clean(r['Academic Program Name']), quota: r.Quota, cat: r['Seat Type'],
        gender: r.Gender, rounds, closing: lastNonNull(rounds),
      };
    }),
  );
}

export function csab() {
  return memo('csab', () =>
    rows('JOSAA/CSAB_CUTOFF_CONSOLIDATED_2026.json').map((r) => {
      const rounds = closingRounds(r, 3);
      return {
        college: clean(r.Institute), state: clean(r.State), type: r.Type,
        branch: clean(r['Academic Program Name']), quota: r.Quota, cat: r['Seat Type'],
        gender: r.Gender, rounds, closing: lastNonNull(rounds),
      };
    }),
  );
}

// IIT closing ranks for rounds 1..6 merged per (institute, program, quota, seat, gender)
export function iit() {
  return memo('iit', () => {
    const map = new Map();
    for (let n = 1; n <= 6; n++) {
      for (const r of rows(`JOSAA/IIT_ROUND_${n}_2026.json`)) {
        const key = [r.Institute, r['Academic Program Name'], r.Quota, r['Seat Type'], r.Gender].join('|');
        let e = map.get(key);
        if (!e) {
          e = { college: clean(r.Institute), branch: clean(r['Academic Program Name']), quota: r.Quota, cat: r['Seat Type'], gender: r.Gender, type: 'IIT', rounds: [null, null, null, null, null, null] };
          map.set(key, e);
        }
        e.rounds[n - 1] = num(r['Closing Rank']);
      }
    }
    return [...map.values()].map((e) => ({ ...e, closing: lastNonNull(e.rounds) }));
  });
}

/* ─────────────── COMEDK & Manipal ─────────────── */
function roundCols(r, n) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(num(String(r[`Round ${i}`] ?? '').replace(/[–-]/g, '')));
  return out;
}
export function comedk() {
  return memo('comedk', () => {
    const mk = (file, quota) => rows(file).map((r) => {
      const rounds = roundCols(r, 4);
      const [name, city] = String(r.College || '').split('\n');
      return { college: clean(name), city: clean(city), branch: clean(r.Branch), quota, rounds, closing: lastNonNull(rounds) };
    });
    return [...mk('COMEDK/COMEDK_GM_CUTOFF.json', 'GM'), ...mk('COMEDK/COMEDK_KKR_CUTOFF.json', 'KKR')];
  });
}
export function comedkFees() {
  return memo('comedkFees', () =>
    rows('COMEDK/COMDEK_CLG_DETAILS.json').map((r) => ({
      code: r['College Code'], college: clean(r['College Name']), branch: clean(r['Course Code & Course Name']),
      seats: num(r['Total Seats']), gm: num(r['GM\nSeats']), kkr: num(r['KKR\nSeats']),
      fee: num(r['Total Fee\n₹']), tuition: num(r['Tuition Fee\n₹']),
    })),
  );
}
export function manipal() {
  return memo('manipal', () =>
    rows('MANIPAL/MANIPAL_CUTOFF.json').map((r) => {
      const rounds = roundCols(r, 4);
      return { college: clean(String(r.Campus || '').replace('\n', ', ')), branch: clean(r.Branch), rounds, closing: lastNonNull(rounds) };
    }),
  );
}

/* ─────────────── Rankings, placements, conversions ─────────────── */
export const REGION_FILES = ['PUNE', 'MUMBAI', 'NAGPUR', 'NASHIK', 'AURANGABAD', 'AMRAVATI'];
export function regionRanking(region) {
  return memo(`rank_${region}`, () =>
    rows(`REGION_WISE_RANKING/${region}_RANKING.json`).map((r) => ({
      rank: num(r['Sr No']), code: String(r['College Code'] || '').padStart(5, '0'), college: clean(r['College Name']),
    })),
  );
}
export function placementTier() {
  return memo('ptier', () =>
    rows('ALL_CLG_PLACEMENT_TIER.json').map((r) => ({ college: clean(r['College Name']), avg: num(r['Avg Package (LPA)']), tier: r.Tier })),
  );
}
export function nationalPlacements() {
  return memo('pnat', () =>
    ['IIT', 'NIT', 'IIIT', 'GFTI'].flatMap((t) =>
      rows(`placement/${t}_PLACEMENTS.json`).map((r) => ({
        college: clean(r.Institute), type: r.Category || t, tier: r.Tier || '',
        avg: r['Avg Package'], median: r['Median Package'], highest: r['Highest Package'],
        placed: r['Placement %'], location: r.Location,
      })),
    ),
  );
}
export function mhtIntake() {
  return memo('intake', () =>
    rows('college-data.json').map((r) => ({
      code: String(r['Institute Code'] || '').padStart(5, '0'), college: clean(r['Institute Name']), status: clean(r.Status), intake: num(r['Total Intake']),
    })),
  );
}
export function mhtMarksToPct() {
  return memo('m2p', () => rows('MHT CET marks vs percentile.json').map((r) => ({ marks: clean(r.Marks), pct: clean(r['Percentile (%)']) })));
}
export function mhtPctToRank() {
  return memo('p2r', () => rows('MHT CET percentile vs rank.json').map((r) => ({ pct: num(r.Percentile), min: num(r['Minimum Rank']), max: num(r['Maximum Rank']) })));
}
export function jeePctToRank() {
  // File has odd headers: "1" = rank, "100" = percentile
  return memo('jp2r', () => rows('percentile vs rank jee mains.json').map((r) => ({ rank: num(r['1']), pct: num(r['100']) })));
}
