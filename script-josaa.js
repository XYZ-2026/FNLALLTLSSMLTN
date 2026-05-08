/**
 * JOSAA College Predictor — script.js
 * ─────────────────────────────────────────────────────────────
 * Handles: Auth, Theme, Navigation, Data Loading,
 *          Rank Prediction, College Filtering, UI Rendering
 * ─────────────────────────────────────────────────────────────
 */

'use strict';


/* ══════════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════════ */
let josaaData = [];   // Full JOSAA dataset (loaded from josaa.json)
let shiftDataCache = {};   // Cached shift JSON files
let allResults = [];   // Last prediction results (for filter)
let currentPage = 'home';

/* ══════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadJosaaData();

  // Check for 'rank' in URL to pre-fill predictor
  const params = new URLSearchParams(window.location.search);
  const rank = params.get('rank');
  if (rank) {
    const inRank = document.getElementById('inRank');
    if (inRank) {
      inRank.value = rank;
      // Show predictor page
      showPage('predictor');
      // Scroll to form
      setTimeout(() => {
        const card = document.querySelector('.predictor-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }
});

/* ══════════════════════════════════════════════════════════════
   THEME
   ══════════════════════════════════════════════════════════════ */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.checked = (saved === 'dark');
}

function toggleTheme(checkbox) {
  const theme = checkbox.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

/* ══════════════════════════════════════════════════════════════
   PAGE NAVIGATION
   ══════════════════════════════════════════════════════════════ */
function showPage(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const el = document.getElementById('page' + capitalise(page));
  if (el) el.classList.add('active');
  currentPage = page;

  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('nav' + capitalise(page));
  if (activeBtn) activeBtn.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


/* ══════════════════════════════════════════════════════════════
   MOBILE MENU
   ══════════════════════════════════════════════════════════════ */
function toggleMobileMenu() {
  const nav = document.getElementById('mobNav');
  const btn = document.getElementById('hamburger');
  const open = nav.classList.toggle('open');
  btn.classList.toggle('open', open);
}

function closeMobNav() {
  document.getElementById('mobNav').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}





/* ══════════════════════════════════════════════════════════════
   LOAD JOSAA DATA
   ══════════════════════════════════════════════════════════════ */
async function loadJosaaData() {
  try {
    const res = await fetch('josaa.json');
    const json = await res.json();
    josaaData = json['JOSAA DATA'] || [];
    console.log(`✅ JOSAA data loaded: ${josaaData.length} records`);
  } catch (err) {
    console.error('❌ Failed to load josaa.json:', err);
    toast('Failed to load JOSAA data. Refresh and try again.', 'err');
  }
}

/**
 * Load a shift difficulty JSON file (cached after first load)
 * @param {string} shift - e.g. 'easy_to_moderate'
 * @returns {Array} Array of {Marks, Percentile} objects
 */


/* ══════════════════════════════════════════════════════════════
   RANK PREDICTION LOGIC
   ══════════════════════════════════════════════════════════════ */

/**
 * Parse a percentile range string like "99.50-99.60" → [99.50, 99.60]
 * Also handles unicode dash (–)
 */


/**
 * Parse a marks range string like "200 – 191" → midpoint value
 * Also handles unicode dash (–)

/**
 * Find the estimated marks for a given percentile in the shift data.
 * Returns the midpoint marks of the matching percentile range.
 * @param {number} percentile
 * @param {Array}  shiftRows
 * @returns {number} estimated marks
 */




/* ══════════════════════════════════════════════════════════════
   BRANCH GROUP KEYWORDS
   ══════════════════════════════════════════════════════════════ */
const BRANCH_KEYWORDS = {
  computer: ['computer', 'cse', 'information technology', 'artificial intelligence', 'data science', 'machine learning', 'software', 'it '],
  electronics: ['electronics', 'communication', 'electrical', 'ece', 'eee', 'electronic', 'instrumentation'],
  core: ['mechanical', 'civil', 'chemical', 'production', 'manufacturing', 'metallurgy', 'mining', 'textile'],
  others: [] // match everything not covered above
};

/**
 * Check if a branch name matches the selected branch group.
 * @param {string} branchName  - JOSAA "Academic Program Name"
 * @param {string} group       - 'computer' | 'electronics' | 'core' | 'others'
 */
function matchesBranchGroup(branchName, group) {
  const lower = branchName.toLowerCase();

  if (group === 'others') {
    // 'others' = does NOT match computer, electronics, or core
    const allKeywords = [
      ...BRANCH_KEYWORDS.computer,
      ...BRANCH_KEYWORDS.electronics,
      ...BRANCH_KEYWORDS.core
    ];
    return !allKeywords.some(kw => lower.includes(kw));
  }

  return BRANCH_KEYWORDS[group].some(kw => lower.includes(kw));
}

/* ══════════════════════════════════════════════════════════════
   INSTITUTE TYPE DETECTION
   ══════════════════════════════════════════════════════════════ */
/**
 * Detect whether an institute is NIT, IIIT, or GFTI.
 * @param {string} instituteName
 * @returns {string} 'NIT' | 'IIIT' | 'GFTI'
 */
function detectInstituteType(instituteName) {
  const lower = instituteName.toLowerCase();
  if (lower.includes('national institute of technology') || lower.includes(' nit ') || lower.startsWith('nit '))
    return 'NIT';
  if (lower.includes('indian institute of information technology') || lower.includes(' iiit') || lower.startsWith('iiit'))
    return 'IIIT';
  return 'GFTI';
}

/* ══════════════════════════════════════════════════════════════
   COLLEGE FILTERING
   ══════════════════════════════════════════════════════════════ */
/**
 * Filter JOSAA data based on user inputs.
 * @param {Object} params
 * @returns {Array} filtered + annotated results
 */
function filterColleges({ rank, gender, category, homeState, instTypes, branchGroup }) {
  const results = [];

  for (const row of josaaData) {
    const institute = row['Institute'] || '';
    const program = row['Academic Program Name'] || '';
    const quota = row['Quota'] || '';
    const seatType = row['Seat Type'] || '';
    const rowGender = row['Gender'] || '';
    const opening = parseInt(row['Opening Rank'] || '0', 10);
    const closing = parseInt(row['Closing Rank'] || '0', 10);

    if (!opening || !closing) continue;

    // ── 1. Rank filter ──
    // Student's rank must be ≤ closing rank (within consideration)
    // Allow a 20% buffer above closing for near-matches
    if (rank > closing * 1.05) continue;

    // ── 2. Gender filter ──
    // 'Gender-Neutral' seats are open to all
    const genderMatch = rowGender === 'Gender-Neutral' || rowGender === gender;
    if (!genderMatch) continue;

    // ── 3. Category (Seat Type) filter ──
    if (seatType !== category) continue;

    // ── 4. Quota filter ──
    // Home State quota: institute state should match student's state
    // All India quota: always eligible
    // Other State quota: if not from home state
    const instituteState = extractStateFromInstitute(institute);
    if (quota === 'Home State') {
      if (!homeState || !instituteState.toLowerCase().includes(homeState.toLowerCase().slice(0, 6))) continue;
    } else if (quota === 'Other State') {
      if (homeState && instituteState.toLowerCase().includes(homeState.toLowerCase().slice(0, 6))) continue;
    }
    // 'All India' quota — always include

    // ── 5. Institute type filter ──
    const instType = detectInstituteType(institute);
    if (!instTypes.includes(instType)) continue;

    // ── 6. Branch group filter ──
    if (!matchesBranchGroup(program, branchGroup)) continue;

    // ── 7. Compute confidence ──
    const confidence = computeConfidence(rank, opening, closing);

    results.push({
      institute,
      program,
      quota,
      category: seatType,
      gender: rowGender,
      opening,
      closing,
      confidence,
      instType
    });
  }

  // Sort: Safe first → Moderate → Dream
  const order = { safe: 0, moderate: 1, dream: 2 };
  results.sort((a, b) => order[a.confidence] - order[b.confidence] || a.opening - b.opening);

  return results;
}

/**
 * Compute match confidence based on rank vs opening/closing.
 * - Safe:     rank ≤ (opening + (closing - opening) * 0.40)
 * - Dream:    rank < opening
 * - Moderate: everything else
 */
function computeConfidence(rank, opening, closing) {
  if (rank < opening) return 'dream';
  const safeThreshold = opening + (closing - opening) * 0.45;
  if (rank <= safeThreshold) return 'safe';
  return 'moderate';
}

/**
 * Extract state from institute name (approximate matching).
 * This covers most JOSAA institute location patterns.
 */
const STATE_PATTERNS = [
  ['Andhra Pradesh', ['andhra', 'warangal', 'tirupati', 'surathkal']],
  ['Karnataka', ['karnataka', 'surathkal']],
  ['Tamil Nadu', ['tamil', 'trichy', 'tiruchirappalli', 'madurai']],
  ['Maharashtra', ['maharashtra', 'nagpur', 'mumbai', 'pune']],
  ['Rajasthan', ['rajasthan', 'jaipur', 'jodhpur', 'kota']],
  ['Uttar Pradesh', ['allahabad', 'bhopal', 'agra', 'lucknow', 'uttar pradesh']],
  ['West Bengal', ['durgapur', 'west bengal', 'kolkata', 'shibpur']],
  ['Bihar', ['bihar', 'patna']],
  ['Odisha', ['odisha', 'rourkela', 'odisa']],
  ['Madhya Pradesh', ['bhopal', 'madhya pradesh', 'jabalpur']],
  ['Kerala', ['kerala', 'calicut', 'kozhikode']],
  ['Gujarat', ['gujarat', 'surat', 'ahmedabad']],
  ['Haryana', ['haryana', 'kurukshetra', 'faridabad']],
  ['Punjab', ['punjab', 'jalandhar', 'chandigarh']],
  ['Himachal Pradesh', ['hamirpur', 'himachal']],
  ['Jharkhand', ['jharkhand', 'jamshedpur']],
  ['Uttarakhand', ['uttarakhand', 'roorkee', 'srinagar uttara']],
  ['Arunachal Pradesh', ['arunachal', 'itanagar']],
  ['Nagaland', ['nagaland']],
  ['Manipur', ['manipur', 'imphal']],
  ['Tripura', ['tripura', 'agartala']],
  ['Meghalaya', ['meghalaya', 'shillong']],
  ['Mizoram', ['mizoram', 'aizawl']],
  ['Sikkim', ['sikkim', 'gangtok']],
  ['Goa', ['goa']],
  ['Delhi', ['delhi']],
  ['Jammu and Kashmir', ['srinagar', 'jammu', 'kashmir']],
];

function extractStateFromInstitute(name) {
  const lower = name.toLowerCase();
  for (const [state, patterns] of STATE_PATTERNS) {
    if (patterns.some(p => lower.includes(p))) return state;
  }
  return '';
}

/* ══════════════════════════════════════════════════════════════
   PREDICTOR FORM SUBMIT
   ══════════════════════════════════════════════════════════════ */
async function handlePredict(e) {
  e.preventDefault();

  const errEl = document.getElementById('predictErr');
  errEl.style.display = 'none';

  // ── Read inputs ──
  const rank = parseInt(document.getElementById('inRank').value);
  const gender = document.getElementById('inGender').value;
  const category = document.getElementById('inCategory').value;
  const homeState = document.getElementById('inState').value;
  const branchGroup = document.getElementById('inBranch').value;

  const instTypeCheckboxes = document.querySelectorAll('input[name="instType"]:checked');
  const instTypes = Array.from(instTypeCheckboxes).map(cb => cb.value);

  // ADD:
  if (isNaN(rank) || rank < 1) {
    showErr(errEl, 'Please enter a valid rank.');
    return;
  }
  if (!gender || !category || !homeState || !branchGroup) {
    showErr(errEl, 'Please fill in all fields before predicting.');
    return;
  }
  if (instTypes.length === 0) {
    showErr(errEl, 'Please select at least one institute type (NIT / IIIT / GFTI).');
    return;
  }
  if (josaaData.length === 0) {
    showErr(errEl, 'JOSAA data not loaded yet. Please refresh the page.');
    return;
  }

  // ── Show loading ──
  showLoading(true);
  const btn = document.getElementById('predictBtn');
  setLoading(btn, true, 'Predicting…');

  // Tiny delay so the UI can paint the loader
  await sleep(300);

  try {

    // ADD:
    const predictedRank = rank;
    // ── Filter colleges ──
    allResults = filterColleges({ rank: predictedRank, gender, category, homeState, instTypes, branchGroup });

    // ── Save to history ──
    // ADD:
    saveSearchToHistory({
      rank, gender, category, homeState, branchGroup, instTypes,
      predictedRank,
      count: allResults.length,
      time: new Date().toISOString()
    });

    // ── Update summary bar ──
    // ADD:
    document.getElementById('rssRank').textContent = predictedRank.toLocaleString('en-IN');
    document.getElementById('rssCount').textContent = allResults.length;

    // ── Render results ──
    document.getElementById('resultsSection').style.display = '';

    // Reset filter chips
    document.querySelectorAll('.fchip').forEach(c => c.classList.toggle('active', c.dataset.f === 'all'));
    renderResults(allResults);

    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (allResults.length === 0) {
      toast('No colleges matched your filters. Try widening your preferences.', 'info');
    } else {
      toast(`Found ${allResults.length} matching college-branch combinations! 🎉`, 'ok');
    }

  } catch (err) {
    console.error(err);
    showErr(errEl, 'Prediction failed: ' + err.message);
    toast('Something went wrong. Please try again.', 'err');
  }

  showLoading(false);
  setLoading(btn, false, '🔮 Predict My Colleges');
}

/* ══════════════════════════════════════════════════════════════
   RENDER RESULTS
   ══════════════════════════════════════════════════════════════ */
function renderResults(results) {
  const grid = document.getElementById('resultsGrid');
  const empty = document.getElementById('emptyState');

  grid.innerHTML = '';

  if (results.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  results.forEach(r => {
    const card = document.createElement('div');
    card.className = `cc ${r.confidence}`;
    card.innerHTML = `
      <div class="cc-hdr">
        <div class="cc-name">${escHtml(r.institute)}</div>
        <span class="chip ${confidenceChip(r.confidence)}" style="flex-shrink:0;">${r.instType}</span>
      </div>
      <div class="cc-branch">${escHtml(r.program)}</div>
      <div class="cc-meta">
        <span class="chip chip-gray">${escHtml(r.quota)}</span>
        <span class="chip chip-gray">${escHtml(r.category)}</span>
        <span class="chip chip-gray">${escHtml(r.gender === 'Gender-Neutral' ? 'GN' : 'Female')}</span>
      </div>
      <div class="cc-foot">
        <div class="cc-rank-info">
          <div class="cc-rank-block">
            <div class="cc-rank-label">Opening</div>
            <div class="cc-rank-val opening">${r.opening.toLocaleString('en-IN')}</div>
          </div>
          <div class="cc-rank-block">
            <div class="cc-rank-label">Closing</div>
            <div class="cc-rank-val closing">${r.closing.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div class="conf-badge conf-${r.confidence}">
          ${confidenceEmoji(r.confidence)} ${capitalise(r.confidence)}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function confidenceChip(confidence) {
  return { safe: 'chip-green', moderate: 'chip-orange', dream: 'chip-red' }[confidence] || '';
}

function confidenceEmoji(confidence) {
  return { safe: '✅', moderate: '⚡', dream: '🌟' }[confidence] || '';
}

/* ══════════════════════════════════════════════════════════════
   RESULTS FILTER
   ══════════════════════════════════════════════════════════════ */
function applyFilter(filter, clickedChip) {
  document.querySelectorAll('.fchip').forEach(c => c.classList.remove('active'));
  clickedChip.classList.add('active');

  const filtered = filter === 'all'
    ? allResults
    : allResults.filter(r => r.confidence === filter);

  renderResults(filtered);
}

/* ══════════════════════════════════════════════════════════════
   EXPORT RESULTS (CSV)
   ══════════════════════════════════════════════════════════════ */
function exportResults() {
  if (allResults.length === 0) {
    toast('No results to export.', 'info');
    return;
  }

  const header = ['Institute', 'Program', 'Quota', 'Category', 'Gender', 'Opening Rank', 'Closing Rank', 'Type', 'Confidence'];
  const rows = allResults.map(r => [
    r.institute, r.program, r.quota, r.category,
    r.gender, r.opening, r.closing, r.instType, r.confidence
  ]);

  const csv = [header, ...rows].map(row =>
    row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'josaa_predictions.csv';
  a.click();
  toast('Results exported as CSV ✅', 'ok');
}

/* ══════════════════════════════════════════════════════════════
   SEARCH HISTORY (localStorage)
   ══════════════════════════════════════════════════════════════ */
function saveSearchToHistory(entry) {
  const history = getHistory();
  history.unshift(entry);                    // Latest first
  const trimmed = history.slice(0, 20);      // Keep max 20
  localStorage.setItem('josaa_history', JSON.stringify(trimmed));
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem('josaa_history')) || []; }
  catch { return []; }
}

function clearHistory() {
  localStorage.removeItem('josaa_history');
  renderHistory();
  toast('Search history cleared.', 'ok');
}

function renderHistory() {
  const container = document.getElementById('historyList');
  const history = getHistory();

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📭</div>
        <h3>No searches yet</h3>
        <p>Run your first prediction to see results here.</p>
      </div>`;
    return;
  }

  const rows = history.map((h, i) => {
    const d = new Date(h.time);
    const dateStr = isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = isNaN(d) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="card" style="margin-bottom:10px;cursor:pointer;" onclick="replaySearch(${i})" title="Click to re-run this search">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-family:'Poppins',sans-serif;font-weight:700;font-size:14px;">
        // ADD:
Rank ${Number(h.rank || h.predictedRank).toLocaleString('en-IN')}
            </div>
            <div class="muted" style="font-size:12px;margin-top:3px;">
              ${escHtml(h.category)} · ${escHtml(h.gender === 'Gender-Neutral' ? 'General/Male' : 'Female')} · ${escHtml(h.homeState)} · ${branchLabel(h.branchGroup)}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:'Poppins',sans-serif;font-weight:800;font-size:15px;color:var(--brand);">Rank ~${Number(h.predictedRank).toLocaleString('en-IN')}</div>
            <div class="muted" style="font-size:11px;">${h.count} colleges · ${dateStr} ${timeStr}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = rows;
}

/** Re-fill the predictor form with a past search entry */
function replaySearch(index) {
  const h = getHistory()[index];
  if (!h) return;

  showPage('predictor');

  // Fill form
  // ADD:
  document.getElementById('inRank').value = h.rank || h.predictedRank;
  document.getElementById('inGender').value = h.gender;
  document.getElementById('inCategory').value = h.category;
  document.getElementById('inState').value = h.homeState;
  document.getElementById('inBranch').value = h.branchGroup;

  // Set institute type checkboxes
  document.querySelectorAll('input[name="instType"]').forEach(cb => {
    cb.checked = (h.instTypes || []).includes(cb.value);
  });

  toast('Form filled with past search. Click Predict! 🔮', 'info');
}

function shiftLabel(shift) {
  const map = {
    easy_to_moderate: 'Easy–Moderate',
    moderate: 'Moderate',
    moderate_to_difficult: 'Moderate–Difficult',
    difficult: 'Difficult'
  };
  return map[shift] || shift;
}

function branchLabel(group) {
  const map = {
    computer: 'Computer',
    electronics: 'Electronics',
    core: 'Core',
    others: 'Others'
  };
  return map[group] || group;
}

/* ══════════════════════════════════════════════════════════════
   GOOGLE APPS SCRIPT REQUEST
   ══════════════════════════════════════════════════════════════ */
/**
 * Send a request to Google Apps Script via JSONP (no-cors workaround).
 * GAS deployed as "Execute as: Me, Who has access: Anyone".
 * @param {string} action  - 'loginUser' | 'registerUser'
 * @param {Object} payload - data object
 * @returns {Promise<Object>} parsed response JSON
 */

/* ══════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ══════════════════════════════════════════════════════════════ */


/** Show/hide a loading overlay */
function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('open', show);
}

/** Set button loading state */
function setLoading(btn, isLoading, label) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = label;
}

/** Show an inline error message */
function showErr(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

/** Simple sleep */
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/** Escape HTML to prevent XSS */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ══════════════════════════════════════════════════════════════ */
/**
 * Show a toast notification.
 * @param {string} message
 * @param {'ok'|'err'|'info'} type
 * @param {number} duration - milliseconds
 */
function toast(message, type = 'info', duration = 3500) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;

  const el = document.createElement('div');
  el.className = `toast t-${type}`;
  el.innerHTML = `<span class="toast-dot"></span><span>${escHtml(message)}</span>`;
  wrap.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(110%)';
    el.style.transition = 'opacity .3s, transform .3s';
    setTimeout(() => el.remove(), 350);
  }, duration);
}
