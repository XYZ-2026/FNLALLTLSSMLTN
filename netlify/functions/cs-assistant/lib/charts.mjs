// Chart specs built from the same retrieved rows the model sees. The model never
// supplies chart values, so a chart cannot show a made-up number.
// Every builder returns a plain-JSON spec, or null when a chart would not help.

const MAX_SERIES = 4;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

export function shortCollege(name) {
  let s = String(name || '').replace(/\s+/g, ' ').trim();
  if (/COEP/i.test(s)) return 'COEP';
  if (/\bVJTI\b/i.test(s)) return 'VJTI';
  // Drop a long trust prefix: "... Charitable Trust's Vishwakarma Institute of Technology"
  const m = s.match(/^.{12,}?[’']s,?\s*(.+)$/i);
  if (m && /(college|institute|university)/i.test(m[1]) && !/^(college|institute|university)\b/i.test(m[1])) s = m[1];
  return s
    .replace(/Indian Institute of Information Technology/i, 'IIIT')
    .replace(/Indian Institute of Technology/i, 'IIT')
    .replace(/National Institute of Technology/i, 'NIT')
    .replace(/College of Engineering/i, 'COE')
    .replace(/\bInstitute of Technology\b/i, 'Inst. of Tech.')
    .replace(/\s*\(IIIT\)/i, '')
    .trim();
}

/** Closing cutoff across rounds. entries: [{college, branch, seat, values: []}] */
export function trendChart({ title, metric, rounds, entries, you }) {
  const points = (e) => e.values.filter(isNum).length;
  if (!entries.some((e) => points(e) >= 2)) return null;
  // A row that filled in one round still gets its dot, so a comparison never loses a college.
  const usable = entries.filter((e) => points(e) >= 1).sort((a, b) => (points(b) >= 2) - (points(a) >= 2));
  // Spread the limited number of lines across colleges first.
  const byCollege = new Map();
  for (const e of usable) {
    if (!byCollege.has(e.college)) byCollege.set(e.college, []);
    byCollege.get(e.college).push(e);
  }
  const picked = [];
  for (let i = 0; picked.length < MAX_SERIES; i++) {
    let added = false;
    for (const list of byCollege.values()) {
      if (list[i] && picked.length < MAX_SERIES) { picked.push(list[i]); added = true; }
    }
    if (!added) break;
  }
  const keep = rounds.map((_, i) => picked.some((e) => isNum(e.values[i])));
  const labels = rounds.filter((_, i) => keep[i]);
  if (labels.length < 2) return null;
  // Anything every line shares goes in the subtitle once; the legend names only what differs.
  const differs = (f) => new Set(picked.map(f)).size > 1;
  const branchOf = (e) => String(e.branch).replace(/^B\.?\s*Tech\s+in\s+/i, '');
  const part = { college: differs((e) => e.college), branch: differs(branchOf), seat: differs((e) => e.seat) };
  const label = (e, want) => [part.college === want ? shortCollege(e.college) : '', part.branch === want ? branchOf(e) : '', part.seat === want ? e.seat : ''].filter(Boolean).join(' · ');
  return {
    type: 'trend', title, metric, labels,
    shared: label(picked[0], false),
    you: isNum(you) ? you : null,
    series: picked.map((e) => ({
      name: label(e, true) || shortCollege(e.college),
      full: [e.college, e.branch, e.seat].filter(Boolean).join(' · '),
      values: e.values.filter((_, i) => keep[i]).map((v) => (isNum(v) ? v : null)),
    })),
    note: usable.length > picked.length ? `${picked.length} of ${usable.length} rows charted` : '',
  };
}

/** Student's score against a shortlist. rows: [{chance, college, branch, value}] */
export function fitChart({ title, metric, you, rows }) {
  if (!isNum(you)) return null;
  const ok = rows.filter((r) => isNum(r.value) && ['Reach', 'Likely', 'Safe'].includes(r.chance));
  const picked = ['Reach', 'Likely', 'Safe'].flatMap((c) => ok.filter((r) => r.chance === c).slice(0, 4));
  if (picked.length < 2) return null;
  return {
    type: 'fit', title, metric, you,
    rows: picked.map((r) => ({ chance: r.chance, name: shortCollege(r.college), sub: r.branch, full: `${r.college} · ${r.branch}`, value: r.value })),
    note: ok.length > picked.length ? `${picked.length} of ${ok.length} shortlisted options charted` : '',
  };
}

/** Magnitudes on one baseline. rows: [{name, full?, value}] */
export function barChart({ title, unit = '', prefix = '', rows, sort = true, max = 10 }) {
  let ok = rows.filter((r) => isNum(r.value) && r.value >= 0);
  if (sort) ok = [...ok].sort((a, b) => b.value - a.value);
  const picked = ok.slice(0, max);
  if (picked.length < 2 || !picked.some((r) => r.value > 0)) return null;
  return {
    type: 'bars', title, unit, prefix,
    rows: picked.map((r) => ({ name: r.name, full: r.full || r.name, value: r.value })),
    note: ok.length > picked.length ? `${picked.length} of ${ok.length} rows charted` : '',
  };
}

/** A chart problem must never break an answer. */
export function addChart(out, build) {
  try {
    const c = build();
    if (c && out.charts.length < 2) out.charts.push(c);
  } catch (e) {
    console.error('[cs-assistant] chart skipped:', e.message);
  }
}
