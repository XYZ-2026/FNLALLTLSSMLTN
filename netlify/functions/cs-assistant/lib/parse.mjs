// Rule-based slot extraction. Deterministic so numbers never depend on a free model's mood.

export const EXAMS = {
  MHTCET: 'MHT-CET', MHT_AI: 'MHT-CET All-India (JEE Main)', DSE: 'MHT-CET DSE (Diploma)',
  JOSAA: 'JoSAA (NIT/IIIT/GFTI)', IIT: 'JoSAA IIT (JEE Advanced)', CSAB: 'CSAB', COMEDK: 'COMEDK', MANIPAL: 'Manipal (MET)',
};

const EXAM_PATTERNS = [
  ['DSE', /\b(dse|direct\s*second\s*year|diploma|lateral\s*entry|d\.?s\.?e)\b/i],
  ['CSAB', /\bcsab\b/i],
  ['COMEDK', /\b(comedk|comed-?k|karnataka)\b/i],
  ['MANIPAL', /\b(manipal|met\s*exam|mahe)\b/i],
  ['IIT', /\b(iits?|jee\s*adv(anced)?|advanced\s*rank)\b/i],
  ['MHT_AI', /\b(all[\s-]*india\s*(quota|seat)s?|ai\s*quota)\b.*\b(maharashtra|mht|cet|coep|vjti|pict)\b|\b(maharashtra|mht|cet)\b.*\ball[\s-]*india\s*(quota|seat)/i],
  ['JOSAA', /\b(josaa|jossa|nits?|iiits?|gftis?|jee\s*mains?|jee)\b/i],
  ['MHTCET', /\b(mht[\s-]*cet|mhtcet|cet\s*cell|maha\s*cet|cet|maharashtra|cap\s*round)\b/i],
];

export const PAGE_EXAM = [
  [/dse/i, 'DSE'], [/csab/i, 'CSAB'], [/comedk/i, 'COMEDK'], [/manipal/i, 'MANIPAL'],
  [/josaa_iit/i, 'IIT'], [/josaa|jee/i, 'JOSAA'], [/air\.html/i, 'MHT_AI'],
  [/cet|mht|preference-builder|college_explorer|compare_colleges|results/i, 'MHTCET'],
];

// ── Categories ──
const CAT_WORDS = [
  ['NT1', /\b(nt[\s-]?1|nt[\s-]?b|ntb)\b/i], ['NT2', /\b(nt[\s-]?2|nt[\s-]?c|ntc)\b/i], ['NT3', /\b(nt[\s-]?3|nt[\s-]?d|ntd)\b/i],
  ['VJ', /\b(vj|vjnt|vj[\s/-]?dt|nt[\s-]?a)\b/i],
  ['SEBC', /\b(sebc|maratha)\b/i], ['EWS', /\b(ews)\b/i], ['TFWS', /\b(tfws|tuition\s*fee\s*waiver)\b/i],
  ['OBC', /\b(obc|obc[\s-]?ncl|ncl|backward)\b/i],
  ['SC', /\bSC\b|\b(sc\s*(category|cat|caste|quota|seat|candidate|student)|(category|cat|caste)\s*(is|:|-)?\s*sc\b|scheduled\s*caste)/i],
  ['ST', /\bST\b|\b(st\s*(category|cat|caste|quota|seat|candidate|student)|(category|cat|caste)\s*(is|:|-)?\s*st\b|scheduled\s*tribe)/i],
  ['KKR', /\b(kkr|kalyana?\s*karnataka|hyderabad[\s-]*karnataka)\b/i],
  ['OPEN', /\b(open|general|gen|gm|unreserved)\b/i],
];
const SPECIAL = [['PWD', /\b(pwd|ph|disabled|disability|divyang)\b/i], ['DEF', /\b(def|defen[cs]e|army|ex[\s-]?serviceman)\b/i], ['MI', /\b(minority\s*quota|mi\s*quota)\b/i]];

// ── Home universities (MHT-CET) — strings exactly as in the dataset's home_university field ──
export const HOME_UNIS = [
  ['Savitribai Phule Pune University', /\b(pune|sppu|pcmc|pimpri|chinchwad|ahmednagar|ahilyanagar|nashik|baramati|lonavala)\b/i],
  ['Mumbai University', /\b(mumbai|thane|navi\s*mumbai|raigad|palghar|ratnagiri|sindhudurg|panvel|kalyan|vasai|virar|dombivli|mu\b)/i],
  ['Rashtrasant Tukadoji Maharaj Nagpur University', /\b(nagpur|rtmnu|wardha|bhandara|gondia)\b/i],
  ['Gondwana University', /\b(gondwana|chandrapur|gadchiroli)\b/i],
  ['Sant Gadge Baba Amravati University', /\b(amravati|sgbau|akola|yavatmal|buldhana|washim)\b/i],
  ['Dr. Babasaheb Ambedkar Marathwada University', /\b(aurangabad|sambhajinagar|bamu|jalna|beed|dharashiv|osmanabad)\b/i],
  ['Swami Ramanand Teerth Marathwada University, Nanded', /\b(nanded|latur|parbhani|hingoli|srtmu)\b/i],
  ['Shivaji University', /\b(kolhapur|sangli|satara|karad|shivaji\s*university|ichalkaranji)\b/i],
  ['Kavayitri Bahinabai Chaudhari North Maharashtra University, Jalgaon', /\b(jalgaon|dhule|nandurbar|kbcnmu|nmu)\b/i],
  ['Punyashlok Ahilyadevi Holkar Solapur University', /\b(solapur|pandharpur)\b/i],
];
export const MHT_REGION_WORDS = [
  ['6', /\b(pune|pcmc|pimpri|kolhapur|sangli|satara|solapur|karad)\b/i], ['3', /\b(mumbai|thane|navi\s*mumbai|raigad|panvel|konkan|ratnagiri)\b/i],
  ['4', /\b(nagpur|vidarbha|wardha|chandrapur)\b/i], ['5', /\b(nashik|jalgaon|dhule|ahmednagar|ahilyanagar)\b/i],
  ['2', /\b(aurangabad|sambhajinagar|marathwada|nanded|latur|beed)\b/i], ['1', /\b(amravati|akola|yavatmal)\b/i],
];

export const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];

// ── Branches: label → regex on dataset branch names ──
export const BRANCHES = [
  ['AI & ML', /\b(ai\s*(&|and)?\s*ml|aiml|ai[\s-]?ml|machine\s*learning)\b/i, /machine\s*learning|AI\s*&?\s*ML|AIML/i],
  ['AI & Data Science', /\b(ai\s*(&|and)?\s*ds|aids|ai[\s-]?ds|data\s*science|\bds\b)\b/i, /data\s*science/i],
  ['Artificial Intelligence', /\b(artificial\s*intelligence|\bai\b)(?!\s*(&|and)?\s*(ml|ds))/i, /artificial\s*intelligence/i],
  ['Cyber Security', /\b(cyber|cyber\s*security)\b/i, /cyber/i],
  ['IoT', /\b(iot|internet\s*of\s*things)\b/i, /internet\s*of\s*things|\bIoT\b/i],
  ['Computer Science / CSE', /\b(cse|cs|comp(uter)?(\s*(science|sci|engg|engineering))?|coe)\b/i, /^computer\s*(science|engineering)(\s*(and|&)\s*engineering)?\s*(\(|$)|^computer\s*engineering|^COMPUTER SCIENCE|^CS\b|^computer\s*science\s*(&|and)\s*engineering\s*\(4/i],
  ['Information Technology', /\bIT\b|\b(information\s*tech(nology)?|it\s*(branch|engg|engineering|seat|cutoff))\b/i, /information\s*technology/i],
  ['Electronics & Telecom (ENTC)', /\b(entc|e\s*&\s*tc|extc|e&tc|telecom(munication)?)\b/i, /telecommunication/i],
  ['Electronics & Communication (ECE)', /\b(ece|electronics\s*(and|&)\s*communication)\b/i, /electronics\s*(and|&)\s*communication/i],
  ['Electronics', /\belectronics\b/i, /electronics/i],
  ['Electrical', /\b(electrical|eee|ee)\b/i, /electrical/i],
  ['Mechanical', /\b(mech|mechanical)\b/i, /mechanical/i],
  ['Civil', /\bcivil\b/i, /civil/i],
  ['Chemical', /\b(chem|chemical)\b/i, /chemical/i],
  ['Instrumentation', /\binstrument(ation)?\b/i, /instrumentation/i],
  ['Aerospace / Aeronautical', /\b(aero|aerospace|aeronautical)\b/i, /aero/i],
  ['Automobile', /\bauto(mobile|motive)?\b/i, /automo/i],
  ['Robotics / Mechatronics', /\b(robotics|mechatronics|automation)\b/i, /robot|mechatronic|automation/i],
  ['Biotechnology', /\b(biotech|bio\s*technology|biomedical)\b/i, /bio/i],
  ['Production / Industrial', /\b(production|industrial|manufacturing)\b/i, /production|industrial|manufactur/i],
];

// ── Intents ──
const INTENTS = {
  cap_list: /\b((cap|preference|option|choice)\s*(round\s*)?(list|form|order|sheet|filling|entry)|(make|create|build|prepare|generate|give|suggest|bana[o]?)\b.{0,30}\b(list|preferences?|options?)\b.{0,20}\b(cap|form|round|filling|preference|option)|choice\s*filling|option\s*form\s*filling|preference\s*builder)\b/i,
  convert: /\b(marks?\s*(to|vs|→|->)\s*percentile|percentile\s*(to|vs|→|->)\s*rank|how\s*much\s*percentile|what\s*(will\s*be\s*)?(my\s*)?(percentile|rank)|expected\s*(percentile|rank)|convert)\b/i,
  seats: /\b(seats?|seat\s*matrix|intake|capacity)\b/i,
  placement: /\b(placements?|packages?|lpa|salary|ctc|roi|highest\s*package|avg\s*package|average\s*package|recruit)/i,
  fees: /\b(fees?|tuition|cost|kitna\s*paisa)\b/i,
  ranking: /\b(best|top|ranking|ranked|rank\s*list\s*of\s*colleges|good\s*colleges?)\b/i,
  predict: /\b(can\s*i\s*get|will\s*i\s*get|chances?|predict|which\s*colleges?|what\s*colleges?|colleges?\s*(for|at|with|in)|options?\s*(for|at|with)|kaunsa|milega|admission|eligible|possible|suggest)\b/i,
  cutoff: /\b(cut\s*-?\s*offs?|closing|opening|last\s*year|previous\s*year|round\s*\d)\b/i,
};

function pickExam(text) {
  for (const [id, re] of EXAM_PATTERNS) if (re.test(text)) return id;
  return null;
}

function parseNumbers(text) {
  const t = text.replace(/(\d),(?=\d{3}\b)/g, '$1');
  const out = {};
  let m;
  if ((m = t.match(/(\d{1,2}(?:\.\d+)?|100(?:\.0+)?)\s*(?:%ile|%|percentile|pr\b|ptile|pct|percent)/i)) ||
      (m = t.match(/percentile\s*(?:of|is|=|:|-)?\s*(\d{1,2}(?:\.\d+)?|100)/i))) out.percentile = parseFloat(m[1]);
  if ((m = t.match(/(?:rank|air|crl|merit\s*(?:no|number)?|category\s*rank)\s*(?:of|is|=|:|-|around|approx)?\s*(\d{1,7})/i)) ||
      (m = t.match(/(\d{1,7})\s*(?:th|st|nd|rd)?\s*(?:rank|air|crl)\b/i))) out.rank = parseInt(m[1], 10);
  if ((m = t.match(/(\d{1,3})\s*(?:marks|mark|\/\s*200|out\s*of\s*200)/i)) || (m = t.match(/(?:marks|scored|score)\s*(?:of|is|=|:)?\s*(\d{1,3})\b(?!\s*(%|percentile))/i))) {
    const v = parseInt(m[1], 10); if (v <= 200) out.marks = v;
  }
  if ((m = t.match(/\bround\s*-?\s*(\d)\b|\br\s*-?\s*(\d)\b|\b(\d)(?:st|nd|rd|th)\s*round\b/i))) out.round = parseInt(m[1] || m[2] || m[3], 10);
  // Bare decimal like "I have 96.4" → percentile
  if (out.percentile == null && out.rank == null && (m = t.match(/\b(\d{2}\.\d{1,7})\b/))) out.percentile = parseFloat(m[1]);
  return out;
}

function parseCategory(text, exam) {
  // Avoid "st" in "1st", "it" etc. by testing only on tokens surrounded by spaces/punctuation
  const t = ' ' + text.replace(/\b\d+(st|nd|rd|th)\b/gi, ' ') + ' ';
  let base = null;
  for (const [id, re] of CAT_WORDS) {
    if (id === 'SC' && /\b(b\.?\s*sc|bsc|msc)\b/i.test(t)) continue;
    if (id === 'KKR' && exam && exam !== 'COMEDK') continue;
    if (re.test(t)) { base = id; break; }
  }
  let special = null;
  for (const [id, re] of SPECIAL) if (re.test(t)) { special = id; break; }
  return { base, special };
}

export function parseGender(text) {
  if (/\b(girl|female|woman|women|ladies|lady|daughter|she|her|mulgi|ladki)\b/i.test(text)) return 'F';
  if (/\b(boy|male|son|mulga|ladka)\b/i.test(text)) return 'M';
  return null;
}

// A place counts as the student's home only with a cue ("from Pune", "domicile Nagpur")
// or when the whole message is just the place (an answer to "where are you from?").
const HOME_CUE = /(from|belong|live|living|stay|staying|resident|residing|domicile|native|home\s*(university|town|district|state)?|hu|i\s*am\s*in|rehta|rehti|rahto|rahte)\s*(to|in|at|is|:|-|=)?\s*(the\s*)?$/i;
function placeWithCue(text, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = g.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (HOME_CUE.test(before)) return true;
  }
  return text.trim().length <= 30 && re.test(text) && !/\b(college|institute|cutoff|in\s)/i.test(text);
}
function parseHomeUni(text) {
  for (const [name, re] of HOME_UNIS) if (placeWithCue(text, re)) return name;
  return null;
}
function parseRegion(text) {
  const out = [];
  for (const [d, re] of MHT_REGION_WORDS) if (re.test(text)) out.push(d);
  return out;
}
function parseState(text) {
  for (const s of STATES) if (placeWithCue(text, new RegExp('\\b' + s.replace(/ /g, '\\s*') + '\\b', 'i'))) return s;
  if (placeWithCue(text, /\bUP\b/)) return 'Uttar Pradesh';
  if (placeWithCue(text, /\bMP\b/)) return 'Madhya Pradesh';
  if (placeWithCue(text, /\bTN\b/)) return 'Tamil Nadu';
  // Maharashtra cities imply Maharashtra domicile for JoSAA home-state quota
  if (parseHomeUni(text)) return 'Maharashtra';
  return null;
}
export function parseBranches(text) {
  const found = [];
  for (const [label, q] of BRANCHES) if (q.test(text)) found.push(label);
  // "Electronics" is redundant if ENTC/ECE matched
  if (found.some((b) => /ENTC|ECE/.test(b))) return found.filter((b) => b !== 'Electronics');
  return found;
}
export function branchRegex(label) {
  const b = BRANCHES.find((x) => x[0] === label);
  return b ? b[2] : null;
}

function parseIntents(text) {
  const out = [];
  for (const [k, re] of Object.entries(INTENTS)) if (re.test(text)) out.push(k);
  return out;
}

/**
 * Build a profile from the conversation: earlier user turns provide defaults,
 * the latest message overrides. Returns slots + intents of the latest message.
 */
export function buildProfile(userMessages, pageHint) {
  const p = { exam: null, percentile: null, rank: null, marks: null, round: null, cat: null, special: null, gender: null, homeUni: null, regions: [], state: null, branches: [] };
  const msgs = userMessages.slice(-6);
  msgs.forEach((m, i) => {
    const isLast = i === msgs.length - 1;
    const exam = pickExam(m);
    // "NIT"/"IIIT"/"GFTI" name institute types that CSAB also covers, so they
    // don't switch a CSAB conversation to JoSAA.
    const onlyInstituteType = exam === 'JOSAA' && !/\b(josaa|jossa|jee)\b/i.test(m);
    if (exam && !(onlyInstituteType && p.exam === 'CSAB')) p.exam = exam;
    const n = parseNumbers(m);
    // A new score in a later message replaces the old one of the other kind
    if (n.percentile != null) { p.percentile = n.percentile; if (n.rank == null) p.rank = isLast ? null : p.rank; }
    if (n.rank != null) { p.rank = n.rank; if (n.percentile == null && isLast) p.percentile = null; }
    if (n.marks != null) p.marks = n.marks;
    p.round = n.round ?? (isLast ? null : p.round);
    const c = parseCategory(m, p.exam);
    if (c.base) p.cat = c.base;
    if (c.special) p.special = c.special;
    const g = parseGender(m); if (g) p.gender = g;
    const hu = parseHomeUni(m); if (hu) p.homeUni = hu;
    const st = parseState(m); if (st) p.state = st;
    const br = parseBranches(m);
    if (br.length) p.branches = br; else if (isLast && /\b(any|all)\s*branch/i.test(m)) p.branches = [];
    if (isLast) p.regions = parseRegion(m);
  });
  const last = msgs[msgs.length - 1] || '';
  p.examExplicit = !!pickExam(last) && p.exam === pickExam(last);
  if (!p.exam && pageHint) for (const [re, id] of PAGE_EXAM) if (re.test(pageHint)) { p.exam = id; break; }
  p.intents = parseIntents(last);
  p.lastMessage = last;
  return p;
}
