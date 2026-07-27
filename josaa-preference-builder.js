'use strict';

/* ══════ STATE ══════ */
let selectedYear = '2026';
let josaaData = [], selectedBranches = new Set(), matchedColleges = [], selectedColleges = [], prefList = [], allBranchNames = [];
let prefEditCount = 0;
let prefLocked = false;
let prefDataLoaded = false;
let currentFormId = null;
let allForms = [];
let currentUserId = null;
let expandedCategories = new Set();
let suggestionPool = [];
let currentStudentInfo = null;
let cachedUsers = null;

const CATS = {
  'Computer & IT': ['COMPUTER', 'INFORMATION TECHNOLOGY', 'AI', 'ARTIFICIAL', 'DATA SCIENCE', 'MACHINE LEARNING', 'SOFTWARE', 'CYBER', 'ROBOTICS'],
  'Electronics & Telecom': ['ELECTRONICS', 'TELECOMMUNICATION', 'ENTC', 'COMMUNICATION', 'INSTRUMENTATION'],
  'Core Engineering': ['MECHANICAL', 'CIVIL', 'ELECTRICAL', 'CHEMICAL', 'PRODUCTION', 'METALLURGY', 'AUTOMOBILE', 'TEXTILE', 'MINING'],
  'Biotech & Allied': ['BIOTECHNOLOGY', 'BIO-MEDICAL', 'BIO MEDICAL', 'FOOD', 'AGRICULTURE', 'PHARMACEUTICAL'],
  'Other Branches': []
};

const FIXED_ASPIRATIONAL = [];

/* ══════ INSTITUTE TYPE HELPER ══════ */
function getInstituteType(instituteName) {
  const u = (instituteName || '').toUpperCase();
  if (u.includes('NATIONAL INSTITUTE OF TECHNOLOGY') || u.match(/\bNIT\b/)) return 'NIT';
  if (u.includes('INDIAN INSTITUTE OF INFORMATION TECHNOLOGY') || u.match(/\bIIIT\b/)) return 'IIIT';
  return 'GFTI';
}

/* ══════ STEPPER ══════ */
let currentStep = 1;
function goStep(n) {
  if (n < 0 || n > 4) return;
  if (n === 2) {
    if (!validateStep1()) return;
    saveNonLockedData();
  }
  if (n === 3 && selectedBranches.size === 0) { pbToast('Select at least one branch'); return }
  if (n === 3) {
    generateMatches();
    if (window._tempKeys && window._tempKeys.length > 0) {
      selectedColleges = [];
      window._tempKeys.forEach(key => {
        const idx = matchedColleges.findIndex(c => (c.institute + '|' + c.branch) === key);
        if (idx >= 0) selectedColleges.push(idx);
      });
      delete window._tempKeys;
      renderColleges('all');
    }
  }
  if (n === 4) {
    if (!window._isLoadingForm) {
      buildPrefList();
    } else {
      renderPrefList();
      renderSuggestions();
      renderAspirational();
    }
  }
  
  if (n > 0) saveNonLockedData();
  
  currentStep = n;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const targetPanel = document.getElementById('panel' + n);
  if (targetPanel) targetPanel.classList.add('active');
  
  const stepper = document.getElementById('pbStepper');
  if (n === 0) {
    if (stepper) stepper.style.display = 'none';
  } else {
    if (stepper) stepper.style.display = 'flex';
    document.querySelectorAll('.step-item').forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i + 1 < n) s.classList.add('done');
      else if (i + 1 === n) s.classList.add('active');
    });
    document.querySelectorAll('.step-line').forEach((l, i) => {
      l.classList.toggle('done', i + 1 < n);
    });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startNewForm() {
  const user = getSession();
  const isAdmin = user && user.role === 'admin';

  // For admin users, show student details modal first
  if (isAdmin && !currentStudentInfo) {
    showStudentModal();
    return;
  }

  currentFormId = null;
  prefList = [...FIXED_ASPIRATIONAL];
  selectedColleges = [];
  selectedBranches = new Set();
  
  if (prefLocked) lockProfileFields();
  else unlockProfileFields();
  
  renderEditStatus();
  goStep(1);
}

function loadForm(formId, step = 1) {
  const form = allForms.find(f => f.id === formId);
  if (!form) return;
  currentFormId = formId;
  currentStudentInfo = form.studentInfo || null;
  document.getElementById('inPct').value = form.percentile || '';
  document.getElementById('inRank').value = form.rank || '';
  document.getElementById('inCategory').value = form.category || 'OPEN';
  document.getElementById('inGender').value = form.gender || 'Gender-Neutral';
  document.getElementById('inState').value = form.homeState || '';
  prefList = form.prefList || [];
  
  FIXED_ASPIRATIONAL.forEach(fa => {
    if (!prefList.some(p => p.institute === fa.institute && p.branch === fa.branch)) {
      prefList.unshift(fa);
    }
  });

  selectedBranches = new Set(form.selectedBranches || []);
  if (selectedBranches.size === 0 && prefList.length > 0) {
    prefList.forEach(item => {
      if (item.branch) {
        selectedBranches.add(item.branch);
      }
    });
  }

  window._tempKeys = form.selectedCollegeKeys || [];
  if (window._tempKeys.length === 0 && prefList.length > 0) {
    window._tempKeys = prefList.map(item => item.institute + '|' + item.branch);
  }
  
  // Restore institute type pills
  if (form.instTypes) {
    document.querySelectorAll('input[name="instType"]').forEach(cb => {
      cb.checked = form.instTypes.includes(cb.value);
      togglePill(cb);
    });
  }
  
  if (prefLocked) lockProfileFields();
  else unlockProfileFields();
  
  renderBranches();
  renderEditStatus();
  
  window._isLoadingForm = true;
  const targetStep = step || form.currentStep || 1;
  goStep(targetStep);
  window._isLoadingForm = false;
}

async function deleteForm(formId) {
  if (!confirm('Are you sure you want to delete this preference list? This action cannot be undone.')) return;
  const res = await authApi('deleteJosaaPrefForm', { userId: currentUserId, formId });
  if (res.ok) {
    pbToast('Form deleted successfully');
    loadSavedPrefData();
  } else {
    pbToast('Error: ' + res.error);
  }
}

function returnToDashboard() {
  loadSavedPrefData();
}

async function saveNonLockedData() {
  if (!currentUserId) return;
  const pct = document.getElementById('inPct').value;
  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;
  const gender = document.getElementById('inGender').value;
  const homeState = document.getElementById('inState').value;
  const instTypes = Array.from(document.querySelectorAll('input[name="instType"]:checked')).map(i => i.value);
  
  const res = await authApi('saveJosaaPrefData', { 
    userId: currentUserId, 
    formId: currentFormId,
    percentile: pct, 
    rank: rank, 
    category: cat,
    gender: gender,
    homeState: homeState,
    instTypes: instTypes,
    prefList: prefList,
    selectedBranches: Array.from(selectedBranches),
    selectedCollegeKeys: selectedColleges.map(idx => matchedColleges[idx] ? matchedColleges[idx].institute + '|' + matchedColleges[idx].branch : '').filter(Boolean),
    currentStep: currentStep,
    studentInfo: currentStudentInfo || null,
    skipEditCount: true 
  });
  if (res.ok && res.data && res.data.formId) currentFormId = res.data.formId;
}

let autoTid = null;
function triggerAutosave() {
  clearTimeout(autoTid);
  autoTid = setTimeout(saveNonLockedData, 1000);
}

function validateStep1(isLocking = false) {
  const p = document.getElementById('inPct').value, r = document.getElementById('inRank').value;
  if (!p || isNaN(parseFloat(p))) { pbToast('Please enter a valid JEE percentile'); return false }
  if (!r || isNaN(parseInt(r)) || parseInt(r) <= 0) { pbToast('Please enter your JEE Category / CRL Rank'); return false }
  if (!isLocking) {
    const state = document.getElementById('inState').value;
    if (!state) { pbToast('Please select your home state'); return false }
  }
  return true;
}

/* ══════ DATA LOADING ══════ */
function getClosingRankKey() {
  const maxR = selectedYear === '2026' ? 5 : 6;
  return `Round ${maxR} - Closing Rank `;
}

async function loadData(year = selectedYear) {
  const loader = document.getElementById('dataLoader');
  try {
    loader.style.display = 'flex';
    loader.innerHTML = '<div class="pb-spinner"></div><span>Loading JOSAA cutoff data (~5MB)...</span>';
    const is26 = year === '2026';
    const file = is26 ? 'JOSAA/JOSAA_CUTOFF_CONSOLIDATED_2026.json' : 'JOSAA/JOSAA_CUTOFF_CONSOLIDATED.json';
    const key = is26 ? 'JOSAA_CUTOFF_CONSOLIDATED_2026' : 'JOSAA_CUTOFF_CONSOLIDATED';
    const res = await fetch(file);
    if (!res.ok) throw new Error('Failed to load JOSAA data');
    const json = await res.json();
    josaaData = json[key] || [];

    // Extract unique branches (Academic Program Names)
    const bSet = new Set();
    josaaData.forEach(r => {
      if (r["Academic Program Name"]) bSet.add(r["Academic Program Name"].trim());
    });
    allBranchNames = Array.from(bSet).sort();
    renderBranches();
    loader.style.display = 'none';
    document.getElementById('predictBtn').disabled = false;
  } catch (e) {
    console.error(e);
    loader.innerHTML = '<span style="color:var(--brand)">Failed to load data. Please refresh.</span>';
  }
}

function switchCutoffYear(year) {
  if (selectedYear === year) return;
  selectedYear = year;
  const pill26 = document.getElementById('year-pill-2026');
  const pill25 = document.getElementById('year-pill-2025');
  if (pill26 && pill25) {
    if (year === '2026') {
      pill26.style.background = 'var(--brand-soft)';
      pill26.style.borderColor = 'var(--brand)';
      pill26.style.color = 'var(--brand)';
      pill25.style.background = 'transparent';
      pill25.style.borderColor = 'var(--stroke)';
      pill25.style.color = 'var(--muted)';
    } else {
      pill25.style.background = 'var(--brand-soft)';
      pill25.style.borderColor = 'var(--brand)';
      pill25.style.color = 'var(--brand)';
      pill26.style.background = 'transparent';
      pill26.style.borderColor = 'var(--stroke)';
      pill26.style.color = 'var(--muted)';
    }
  }
  loadData(selectedYear);
}
window.switchCutoffYear = switchCutoffYear;

/* ══════ BRANCH RENDERING ══════ */
function categorizeBranch(b) {
  const u = b.toUpperCase();
  for (const [cat, kws] of Object.entries(CATS)) {
    if (cat === 'Other Branches') continue;
    if (kws.some(k => { const re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); return re.test(u) })) return cat;
  }
  return 'Other Branches';
}

function renderBranches() {
  const container = document.getElementById('branchContainer');
  const grouped = {};
  Object.keys(CATS).forEach(c => grouped[c] = []);
  allBranchNames.forEach(b => { const cat = categorizeBranch(b); grouped[cat].push(b) });

  let html = '<div class="branch-select-all" onclick="toggleAllBranches()"><div class="branch-chk" id="chkAll">✓</div> Select All Branches (' + allBranchNames.length + ')</div>';

  Object.entries(grouped).forEach(([cat, branches]) => {
    if (!branches.length) return;
    const selCount = branches.filter(b => selectedBranches.has(b)).length;
    html += `<div class="branch-cat">
      <div class="branch-cat-head" onclick="toggleCatCollapse(this)">
        <div class="branch-cat-name"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${cat}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="branch-cat-count">${selCount}/${branches.length}</span>
          <button class="branch-cat-toggle" onclick="event.stopPropagation();toggleCategory('${cat}')">Select All</button>
        </div>
      </div>
      <div class="branch-list" style="display:${expandedCategories.has(cat) ? 'grid' : 'none'}">`;
    branches.forEach(b => {
      const sel = selectedBranches.has(b) ? 'selected' : '';
      html += `<div class="branch-opt ${sel}" onclick="toggleBranch('${b.replace(/'/g, "\\'")}')"><div class="branch-chk">${sel ? '✓' : ''}</div><span>${b}</span></div>`;
    });
    html += '</div></div>';
  });

  container.innerHTML = html;
  renderBranchChips();
  updateAllChk();
}

function toggleCatCollapse(el) {
  const list = el.nextElementSibling;
  const cat = el.querySelector('.branch-cat-name').textContent.trim();
  const isOpen = list.style.display === 'none';
  list.style.display = isOpen ? 'grid' : 'none';
  if (isOpen) expandedCategories.add(cat); else expandedCategories.delete(cat);
}

function toggleBranch(b) {
  if (selectedBranches.has(b)) selectedBranches.delete(b);
  else selectedBranches.add(b);
  renderBranches();
  triggerAutosave();
}

function toggleCategory(cat) {
  const grouped = {};
  Object.keys(CATS).forEach(c => grouped[c] = []);
  allBranchNames.forEach(b => { grouped[categorizeBranch(b)].push(b) });
  const branches = grouped[cat] || [];
  const allSel = branches.every(b => selectedBranches.has(b));
  branches.forEach(b => { if (allSel) selectedBranches.delete(b); else selectedBranches.add(b) });
  renderBranches();
}

function toggleAllBranches() {
  if (selectedBranches.size === allBranchNames.length) { selectedBranches.clear() }
  else { allBranchNames.forEach(b => selectedBranches.add(b)) }
  renderBranches();
}

function updateAllChk() {
  const el = document.getElementById('chkAll');
  if (el) el.textContent = selectedBranches.size === allBranchNames.length ? '✓' : '';
}

function renderBranchChips() {
  const row = document.getElementById('branchChips');
  if (!row) return;
  if (selectedBranches.size === 0) { row.innerHTML = '<span style="color:var(--muted);font-size:12px">No branches selected</span>'; return }
  if (selectedBranches.size > 8) { row.innerHTML = `<span class="bchip">${selectedBranches.size} branches selected</span>`; return }
  row.innerHTML = Array.from(selectedBranches).map(b => `<span class="bchip">${b.split('(')[0].trim()}<span class="bchip-x" onclick="toggleBranch('${b.replace(/'/g, "\\'")}')">&times;</span></span>`).join('');
}

/* ══════ COLLEGE MATCHING (Step 3) ══════ */
function generateMatches() {
  const rank = parseInt(document.getElementById('inRank').value);
  const cat = document.getElementById('inCategory').value;
  const gen = document.getElementById('inGender').value;
  const homeState = document.getElementById('inState').value;
  const selectedTypes = Array.from(document.querySelectorAll('input[name="instType"]:checked')).map(i => i.value);

  const closingKey = getClosingRankKey();

  // Filter JOSAA data
  let filtered = josaaData.filter(r => {
    if (r["Seat Type"] !== cat) return false;
    if (r.Gender !== gen) return false;
    // Branch filter
    if (!selectedBranches.has(r["Academic Program Name"])) return false;
    // Must have last round closing rank
    const rLast = parseInt(r[closingKey]);
    if (isNaN(rLast)) return false;
    return true;
  });

  // Apply Home State quota logic (same as josaa.html predictor)
  filtered = filtered.filter(r => {
    const instType = getInstituteType(r.Institute);
    if (instType === 'NIT') {
      // Home state NIT: HS quota where institute state matches home state
      // Other state NIT: OS quota where institute state != home state
      if (r.State === homeState && r.Quota === 'HS') return true;
      if (r.State !== homeState && r.Quota === 'OS') return true;
      return false;
    }
    if (instType === 'IIIT' || instType === 'GFTI') {
      return r.Quota === 'OS' || r.Quota === 'AI';
    }
    return false;
  });

  // Institute type filter
  if (selectedTypes.length > 0) {
    filtered = filtered.filter(r => {
      const instType = getInstituteType(r.Institute);
      return selectedTypes.includes(instType);
    });
  }

  // Build enriched result objects
  const maxR = selectedYear === '2026' ? 5 : 6;
  let results = filtered.map(r => {
    const rLast = parseInt(r[closingKey]);
    const instType = getInstituteType(r.Institute);
    return {
      institute: r.Institute,
      branch: r["Academic Program Name"],
      state: r.State || '',
      quota: r.Quota || '',
      seatType: r["Seat Type"] || '',
      gender: r.Gender || '',
      closingRank: rLast,
      r1: r["Round 1 - Closing Rank "] || '-',
      r2: r["Round 2 - Closing Rank "] || '-',
      r3: r["Round 3 - Closing Rank "] || '-',
      r4: r["Round 4 - Closing Rank "] || '-',
      r5: r["Round 5 - Closing Rank "] || '-',
      r6: maxR >= 6 ? (r["Round 6 - Closing Rank "] || '-') : (r["Round 5 - Closing Rank "] || '-'),
      instType: instType,
      isNIT: instType === 'NIT',
      isIIIT: instType === 'IIIT',
      isGFTI: instType === 'GFTI',
      diff: rLast - rank
    };
  });

  // Deduplicate: group by institute+branch, keep the one with best (lowest) closing rank
  const groups = {};
  results.forEach(r => {
    const key = r.institute + '|' + r.branch;
    if (!groups[key] || r.closingRank > groups[key].closingRank) {
      groups[key] = r;
    }
  });
  results = Object.values(groups);

  // Split: reachable (user rank <= closing rank) vs aspirational (user rank > closing rank)
  // Cap to top 150 colleges total to keep the preference list manageable
  const MAX_TOTAL_COLLEGES = 150;
  const MAX_ASPIRATIONAL = 6;

  const reachable = results.filter(r => rank <= r.closingRank).sort((a, b) => a.closingRank - b.closingRank);
  
  // Dynamically load aspirational colleges from user's selected Home State first
  let aspirational = results.filter(r => rank > r.closingRank && r.state === homeState).sort((a, b) => a.closingRank - b.closingRank).slice(0, MAX_ASPIRATIONAL);
  if (aspirational.length === 0) {
    // Fallback to general/national aspirational colleges if none exist in home state
    aspirational = results.filter(r => rank > r.closingRank).sort((a, b) => b.closingRank - a.closingRank).slice(0, MAX_ASPIRATIONAL);
  }

  aspirational.forEach(r => r.isAspirational = true);
  // Cap reachable so total (aspirational + reachable) does not exceed 150
  const reachableCap = Math.max(0, MAX_TOTAL_COLLEGES - aspirational.length);
  matchedColleges = [...aspirational, ...reachable.slice(0, reachableCap)];

  // Build suggestion pool (remaining colleges not in matched)
  suggestionPool = results.filter(r => {
    return !matchedColleges.some(m => m.institute === r.institute && m.branch === r.branch);
  }).sort((a, b) => Math.abs(a.closingRank - rank) - Math.abs(b.closingRank - rank));

  // Auto-select all
  selectedColleges = matchedColleges.map((_, i) => i);
  renderColleges();
}

function renderColleges(filter = 'all') {
  const grid = document.getElementById('collegeGrid');
  const countEl = document.getElementById('matchCount');
  let items = matchedColleges;

  if (filter === 'aspirational') items = matchedColleges.filter(r => r.isAspirational);
  else if (filter === 'reachable') items = matchedColleges.filter(r => !r.isAspirational);
  else if (filter === 'nit') items = matchedColleges.filter(r => r.isNIT);
  else if (filter === 'iiit') items = matchedColleges.filter(r => r.isIIIT);
  else if (filter === 'gfti') items = matchedColleges.filter(r => r.isGFTI);

  countEl.textContent = items.length + ' colleges found (' + selectedColleges.length + ' selected)';

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><h3>No Matches</h3><p>Try adjusting your rank, branch preferences, or institute type filters.</p></div>`;
    return;
  }

  grid.innerHTML = items.map((c, idx) => {
    const realIdx = matchedColleges.indexOf(c);
    const sel = selectedColleges.includes(realIdx);
    const asp = c.isAspirational ? 'aspirational' : '';
    const tags = [];
    const tagClass = c.isNIT ? 'gov' : c.isIIIT ? 'auto' : '';
    tags.push(`<span class="col-tag ${tagClass}">${c.instType}</span>`);
    tags.push(`<span class="col-tag branch-tag">${escH(c.branch.split('(')[0].trim())}</span>`);
    if (c.state) tags.push(`<span class="col-tag">${escH(c.state)}</span>`);
    if (c.quota) tags.push(`<span class="col-tag intake">${c.quota}</span>`);

    return `<div class="col-card ${sel ? 'selected' : ''} ${asp}" onclick="toggleCollege(${realIdx})">
      <div class="col-chk">${sel ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      <div class="col-name">${escH(c.institute)}</div>
      <div class="col-meta">
        ${tags.join('')}
      </div>
      <div class="col-pct"><strong>Rank: ${c.closingRank.toLocaleString()}</strong> <small>R6 Closing</small></div>
    </div>`;
  }).join('');
}

function toggleCollege(idx) {
  const i = selectedColleges.indexOf(idx);
  if (i >= 0) selectedColleges.splice(i, 1); else selectedColleges.push(idx);
  renderColleges(document.querySelector('.filter-chip.active')?.dataset.f || 'all');
  triggerAutosave();
}

function filterColleges(f, el) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderColleges(f);
}

function buildPrefList() {
  const homeState = document.getElementById('inState').value;
  const userAspirational = matchedColleges.filter((c, i) => selectedColleges.includes(i) && c.isAspirational);
  const userNormal = matchedColleges.filter((c, i) => selectedColleges.includes(i) && !c.isAspirational);
  
  // Sort normal colleges: home state first, then closing rank
  userNormal.sort((a, b) => {
    const aIsHS = (a.state === homeState);
    const bIsHS = (b.state === homeState);
    if (aIsHS && !bIsHS) return -1;
    if (!aIsHS && bIsHS) return 1;
    return a.closingRank - b.closingRank;
  });

  const filteredUserAsp = userAspirational.filter(ua => !FIXED_ASPIRATIONAL.some(fa => fa.institute === ua.institute && fa.branch === ua.branch));

  // Sort aspirational: home state first, then closing rank
  filteredUserAsp.sort((a, b) => {
    const aIsHS = (a.state === homeState);
    const bIsHS = (b.state === homeState);
    if (aIsHS && !bIsHS) return -1;
    if (!aIsHS && bIsHS) return 1;
    return a.closingRank - b.closingRank;
  });

  prefList = [...FIXED_ASPIRATIONAL, ...filteredUserAsp, ...userNormal];
  renderPrefList();
  renderSuggestions();
  renderAspirational();
}

/* ══════ ASPIRATIONAL TAB ══════ */
function renderAspirational() {
  const grid = document.getElementById('aspGrid');
  const suggGrid = document.getElementById('aspSuggestions');
  if (!grid) return;
  const rank = parseInt(document.getElementById('inRank').value) || 0;

  const allAsp = prefList.filter(c => c.isAspirational);
  grid.innerHTML = allAsp.map(c => {
    const tags = [];
    const tagClass = c.instType === 'NIT' ? 'gov' : c.instType === 'IIIT' ? 'auto' : '';
    tags.push(`<span class="col-tag ${tagClass}">${c.instType || getInstituteType(c.institute)}</span>`);
    return `<div class="col-card selected aspirational" onclick="toggleAspirational('${escAttr(c.institute)}','${escAttr(c.branch)}')">
      <div class="col-chk"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="col-name">${escH(c.institute)}</div>
      <div class="col-meta">${tags.join('')}<span class="col-tag branch-tag">${escH(c.branch.split('(')[0].trim())}</span></div>
      <div class="col-pct"><strong>Rank: ${c.closingRank ? c.closingRank.toLocaleString() : 'N/A'}</strong> <small>${c.state || ''}</small></div>
    </div>`;
  }).join('');

  if (!allAsp.length) grid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No aspirational colleges added</div>';

  if (suggGrid) {
    const inPref = new Set(prefList.map(p => p.institute + '|' + p.branch));
    const pool = suggestionPool.filter(c => !inPref.has(c.institute + '|' + c.branch) && rank > c.closingRank).slice(0, 8);
    suggGrid.innerHTML = pool.map(c => `<div class="col-card aspirational" onclick="toggleAspirational('${escAttr(c.institute)}','${escAttr(c.branch)}')">
      <div class="col-chk"></div>
      <div class="col-name">${escH(c.institute)}</div>
      <div class="col-meta"><span class="col-tag">${escH(c.branch.split('(')[0].trim())}</span></div>
      <div class="col-pct">Rank: ${c.closingRank.toLocaleString()}<small>${c.quota || ''} | ${c.seatType || ''}</small></div>
    </div>`).join('');
    if (!pool.length) suggGrid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No more suggestions</div>';
  }
}

let searchTimeout = null;
function searchManualColleges() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const query = (document.getElementById('manualSearchInput').value || '').toLowerCase().trim();
    const resDiv = document.getElementById('manualSearchResults');
    if (!query) { resDiv.innerHTML = ''; return; }
    resDiv.innerHTML = '<div class="pb-spinner" style="margin:20px auto"></div>';
    
    const rank = parseInt(document.getElementById('inRank').value) || 999999;
    const cat = document.getElementById('inCategory').value;
    const gen = document.getElementById('inGender').value;
    
    const closingKey = getClosingRankKey();
    const results = josaaData.filter(r => {
      if (r["Seat Type"] !== cat || r.Gender !== gen) return false;
      if (!selectedBranches.has(r["Academic Program Name"])) return false;
      const rLast = parseInt(r[closingKey]);
      if (isNaN(rLast)) return false;
      return (r.Institute || '').toLowerCase().includes(query) || (r["Academic Program Name"] || '').toLowerCase().includes(query);
    }).slice(0, 15);
    
    if (!results.length) { resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No colleges found</div>'; return; }

    const inPref = new Set(prefList.map(p => p.institute + '|' + p.branch));
    resDiv.innerHTML = results.map(r => {
      const instType = getInstituteType(r.Institute);
      const rLast = parseInt(r[closingKey]);
      const maxR = selectedYear === '2026' ? 5 : 6;
      const isSel = inPref.has(r.Institute + '|' + r["Academic Program Name"]);
      const tagClass = instType === 'NIT' ? 'gov' : instType === 'IIIT' ? 'auto' : '';
      return `<div class="col-card ${isSel ? 'selected' : ''}" style="margin-bottom:12px; cursor: default">
        <div class="col-name" style="padding-right:50px">${escH(r.Institute)}</div>
        <div class="col-meta">
          <span class="col-tag ${tagClass}">${instType}</span>
          <span class="col-tag branch-tag">${escH((r["Academic Program Name"] || '').split('(')[0].trim())}</span>
        </div>
        <div class="col-pct"><strong>Rank: ${rLast.toLocaleString()}</strong> <small>R${maxR} Closing | ${r.Quota || ''} | ${r["Seat Type"] || ''}</small></div>
        <button class="pb-btn pb-btn-primary" onclick="handleAddSuggestion('${escAttr(r.Institute)}','${escAttr(r["Academic Program Name"])}')" style="position:absolute; right:12px; top:12px; width:34px; height:34px; padding:0; border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow: none">
          ${isSel ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'}
        </button>
      </div>`;
    }).join('');
  }, 300);
}

let searchListTimeout = null;
function searchManualCollegesList() {
  clearTimeout(searchListTimeout);
  searchListTimeout = setTimeout(() => {
    const query = (document.getElementById('manualSearchInputList').value || '').toLowerCase().trim();
    const resDiv = document.getElementById('manualSearchResultsList');
    if (!query) { resDiv.innerHTML = ''; return; }
    resDiv.innerHTML = '<div class="pb-spinner" style="margin:20px auto"></div>';
    
    const cat = document.getElementById('inCategory').value;
    const gen = document.getElementById('inGender').value;
    
    const closingKey = getClosingRankKey();
    const results = josaaData.filter(r => {
      if (r["Seat Type"] !== cat || r.Gender !== gen) return false;
      if (!selectedBranches.has(r["Academic Program Name"])) return false;
      const rLast = parseInt(r[closingKey]);
      if (isNaN(rLast)) return false;
      return (r.Institute || '').toLowerCase().includes(query) || (r["Academic Program Name"] || '').toLowerCase().includes(query);
    }).slice(0, 15);
    
    if (!results.length) { resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No colleges found</div>'; return; }

    const inPref = new Set(prefList.map(p => p.institute + '|' + p.branch));
    resDiv.innerHTML = results.map(r => {
      const instType = getInstituteType(r.Institute);
      const rLast = parseInt(r[closingKey]);
      const maxR = selectedYear === '2026' ? 5 : 6;
      const isSel = inPref.has(r.Institute + '|' + r["Academic Program Name"]);
      const tagClass = instType === 'NIT' ? 'gov' : instType === 'IIIT' ? 'auto' : '';
      return `<div class="col-card ${isSel ? 'selected' : ''}" style="margin-bottom:12px; cursor: default">
        <div class="col-name" style="padding-right:50px">${escH(r.Institute)}</div>
        <div class="col-meta">
          <span class="col-tag ${tagClass}">${instType}</span>
          <span class="col-tag branch-tag">${escH((r["Academic Program Name"] || '').split('(')[0].trim())}</span>
        </div>
        <div class="col-pct"><strong>Rank: ${rLast.toLocaleString()}</strong> <small>R${maxR} Closing | ${r.Quota || ''} | ${r["Seat Type"] || ''}</small></div>
        <button class="pb-btn pb-btn-primary" onclick="handleAddSuggestion('${escAttr(r.Institute)}','${escAttr(r["Academic Program Name"])}')" style="position:absolute; right:12px; top:12px; width:34px; height:34px; padding:0; border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow: none">
          ${isSel ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'}
        </button>
      </div>`;
    }).join('');
  }, 300);
}

function sortPrefList() {
  prefList.sort((a, b) => (a.closingRank || 999999) - (b.closingRank || 999999));
  renderPrefList();
  pbToast('List sorted by closing rank');
}

function toggleAspirational(institute, branch) {
  const idx = prefList.findIndex(p => p.institute === institute && p.branch === branch);
  if (idx >= 0) {
    if (prefList[idx].isFixed) return pbToast('Cannot remove fixed college');
    prefList.splice(idx, 1);
    pbToast('Removed from preference list');
  } else {
    const c = [...matchedColleges, ...suggestionPool].find(r => r.institute === institute && r.branch === branch);
    if (c) {
      const rank = parseInt(document.getElementById('inRank').value) || 0;
      const copy = { ...c };
      if (rank > copy.closingRank) {
        copy.isAspirational = true;
        prefList.unshift(copy); // Insert at the absolute top!
      } else {
        prefList.push(copy); // Append to the end!
      }
      pbToast('Added to preference list');
    }
  }
  renderPrefList(); renderAspirational(); renderSuggestions();
  triggerAutosave();
}

function renderPrefList() {
  const list = document.getElementById('prefListTbody');
  const count = document.getElementById('prefCount');
  if (!count) return;
  count.textContent = prefList.length + ' colleges';
  if (!prefList.length) {
    list.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--muted)">
          <h3>No colleges added</h3>
          <p>Go back and select colleges.</p>
        </td>
      </tr>`;
    return;
  }

  list.innerHTML = prefList.map((c, i) => {
    const isFixed = c.isFixed;
    const instType = c.instType || getInstituteType(c.institute);
    const badges = [];
    if (c.isAspirational) {
      badges.push('<span class="pref-code asp-badge" style="background:#fff7ed; color:#ea580c; border:1px solid rgba(234, 88, 12, 0.15); font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding: 2px 8px; border-radius: 6px">Aspirational</span>');
    }
    if (isFixed) {
      badges.push('<span class="pref-code fixed-badge" style="background:var(--brand-soft); color:var(--brand); border:1px solid var(--brand-ring); font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding: 2px 8px; border-radius: 6px">Mandatory</span>');
    }

    const statusTags = [];
    if (c.state) {
      statusTags.push(`<span class="col-tag" style="font-size: 9px; padding: 2px 8px">${escH(c.state)}</span>`);
    }
    if (c.quota) {
      statusTags.push(`<span class="col-tag intake" style="font-size: 9px; padding: 2px 8px">${escH(c.quota)}</span>`);
    }

    return `
      <tr class="pref-item ${isFixed ? 'is-fixed' : ''} ${c.isAspirational ? 'asp-item' : ''}" 
          draggable="${!isFixed}" 
          data-idx="${i}"
          ondragstart="${isFixed ? '' : 'dragStart(event)'}" 
          ondragover="${isFixed ? '' : 'dragOver(event)'}" 
          ondrop="${isFixed ? '' : 'dropItem(event)'}" 
          ondragend="${isFixed ? '' : 'dragEnd(event)'}"
          ontouchstart="${isFixed ? '' : 'handleTouchStart(event)'}" 
          ontouchmove="${isFixed ? '' : 'handleTouchMove(event)'}" 
          ontouchend="${isFixed ? '' : 'handleTouchEnd(event)'}"
          style="${isFixed ? 'border-left: 4px solid var(--brand); cursor: default' : ''}">
        <td class="pref-grip" style="text-align: center; width: 40px; vertical-align: middle">
          ${isFixed ? '' : `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="cursor: grab; color: var(--muted)">
            <circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/>
            <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
            <circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
          `}
        </td>
        <td class="pref-num" style="text-align: center; font-weight: 800; width: 60px; vertical-align: middle">${i + 1}</td>
        <td class="pref-name" style="font-weight: 600; color: var(--ink); vertical-align: middle" title="${escH(c.institute)}">${escH(c.institute)}</td>
        <td style="vertical-align: middle" title="${escH(c.branch)}">${escH(c.branch)}</td>
        <td style="vertical-align: middle">
          <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center">
            <span class="col-tag auto" style="font-size: 9px; padding: 2px 8px">${escH(instType)}</span>
            ${badges.join('')}
            ${statusTags.join('')}
          </div>
        </td>
        <td class="excel-td-pct" style="vertical-align: middle"><strong>${c.closingRank ? c.closingRank.toLocaleString() : 'N/A'}</strong></td>
        <td style="text-align: center; width: 70px; vertical-align: middle">
          ${isFixed ?
            '<span style="font-size:9px; font-weight:800; color:var(--brand); opacity:0.6; text-transform:uppercase">Mandatory</span>' :
            `<button class="pref-remove" onclick="removePref(${i})" title="Remove" style="background:none; border:none; color:var(--muted); cursor:pointer; padding:4px; border-radius:6px; transition:0.2s">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>`
          }
        </td>
      </tr>`;
  }).join('');
}

function removePref(i) {
  if (prefList[i] && prefList[i].isFixed) return pbToast('Cannot remove fixed college');
  prefList.splice(i, 1);
  renderPrefList();
  triggerAutosave();
}

/* ══════ DRAG & DROP ══════ */
let dragIdx = null;
function dragStart(e) { dragIdx = +e.target.closest('.pref-item').dataset.idx; e.target.closest('.pref-item').classList.add('dragging') }
function dragOver(e) { e.preventDefault(); const item = e.target.closest('.pref-item'); if (item) item.classList.add('drag-over') }
function dropItem(e) {
  e.preventDefault();
  document.querySelectorAll('.pref-item').forEach(el => el.classList.remove('drag-over'));
  const targetIdx = +e.target.closest('.pref-item').dataset.idx;
  if (dragIdx === null || dragIdx === targetIdx) return;
  const [moved] = prefList.splice(dragIdx, 1);
  prefList.splice(targetIdx, 0, moved);
  renderPrefList();
  triggerAutosave();
}
function dragEnd(e) { dragIdx = null; document.querySelectorAll('.pref-item').forEach(el => el.classList.remove('dragging', 'drag-over')) }

// Mobile Touch Support
let touchElement = null;
function handleTouchStart(e) {
  touchElement = e.target.closest('.pref-item');
  if (!touchElement) return;
  dragIdx = parseInt(touchElement.dataset.idx);
  touchElement.classList.add('dragging');
}
function handleTouchMove(e) {
  if (!touchElement) return;
  const touch = e.touches[0];
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const targetItem = target ? target.closest('.pref-item') : null;
  document.querySelectorAll('.pref-item').forEach(el => el.classList.remove('drag-over'));
  if (targetItem && targetItem !== touchElement) targetItem.classList.add('drag-over');
  e.preventDefault();
}
function handleTouchEnd(e) {
  if (!touchElement) return;
  const touch = e.changedTouches[0];
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const targetItem = target ? target.closest('.pref-item') : null;
  if (targetItem) {
    const targetIdx = parseInt(targetItem.dataset.idx);
    if (dragIdx !== null && dragIdx !== targetIdx) {
      const [moved] = prefList.splice(dragIdx, 1);
      prefList.splice(targetIdx, 0, moved);
      renderPrefList();
    }
  }
  document.querySelectorAll('.pref-item').forEach(el => el.classList.remove('dragging', 'drag-over'));
  touchElement = null; dragIdx = null;
}

/* ══════ SUGGESTIONS ══════ */
function renderSuggestions() {
  const panel = document.getElementById('suggList');
  if (!panel) return;
  const prefCodes = new Set(prefList.map(c => c.institute + '|' + c.branch));

  const currentMatches = matchedColleges.filter(c => !prefCodes.has(c.institute + '|' + c.branch));
  const poolMatches = suggestionPool.filter(c => !prefCodes.has(c.institute + '|' + c.branch));

  const suggs = [...currentMatches, ...poolMatches].slice(0, 12);

  if (!suggs.length) { panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No more suggestions</div>'; return }

  panel.innerHTML = suggs.map(c => `<div class="sugg-item">
    <div class="sugg-info">
      <div class="sugg-name">${escH(c.institute)}</div>
      <div class="sugg-sub">${escH(c.branch.split('(')[0].trim())} | Rank: ${c.closingRank.toLocaleString()} | ${c.quota || ''} | ${c.seatType || ''}</div>
    </div>
    <button class="sugg-add" onclick="handleAddSuggestion('${escAttr(c.institute)}','${escAttr(c.branch)}')">+ Add</button>
  </div>`).join('');
}

function handleAddSuggestion(institute, branch) {
  let c = [...matchedColleges, ...suggestionPool].find(r => r.institute === institute && r.branch === branch);

  if (!c) {
    const raw = josaaData.find(r => r.Institute === institute && r["Academic Program Name"] === branch);
    if (raw) {
      const r6 = parseInt(raw["Round 6 - Closing Rank "]);
      const instType = getInstituteType(raw.Institute);
      c = {
        institute: raw.Institute, branch: raw["Academic Program Name"],
        state: raw.State || '', quota: raw.Quota || '',
        closingRank: r6, instType: instType,
        isNIT: instType === 'NIT', isIIIT: instType === 'IIIT', isGFTI: instType === 'GFTI',
        r1: raw["Round 1 - Closing Rank "] || '-',
        r2: raw["Round 2 - Closing Rank "] || '-',
        r3: raw["Round 3 - Closing Rank "] || '-',
        r4: raw["Round 4 - Closing Rank "] || '-',
        r5: raw["Round 5 - Closing Rank "] || '-',
        r6: String(r6)
      };
    }
  }

  if (c) {
    const idx = prefList.findIndex(p => p.institute === c.institute && p.branch === c.branch);
    if (idx < 0) {
      const rank = parseInt(document.getElementById('inRank').value) || 0;
      const copy = { ...c };
      if (rank > copy.closingRank) {
        copy.isAspirational = true;
        prefList.unshift(copy); // Insert at the absolute top!
      } else {
        prefList.push(copy); // Append to the end!
      }
      pbToast('Added to preference list');
      renderPrefList(); renderAspirational(); renderSuggestions();
      if (document.getElementById('manualSearchInput')) searchManualColleges();
      if (document.getElementById('manualSearchInputList')) searchManualCollegesList();
      triggerAutosave();
    } else {
      if (prefList[idx].isFixed) return pbToast('Cannot remove mandatory college');
      prefList.splice(idx, 1);
      pbToast('Removed from preference list');
      renderPrefList(); renderAspirational(); renderSuggestions();
      if (document.getElementById('manualSearchInput')) searchManualColleges();
      if (document.getElementById('manualSearchInputList')) searchManualCollegesList();
      triggerAutosave();
    }
  }
}

/* ══════ PDF EXPORT ══════ */
function exportPDF() {
  if (!prefList.length) return pbToast('List is empty');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const pct = document.getElementById('inPct').value;
  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;
  const gen = document.getElementById('inGender').value;
  const homeState = document.getElementById('inState').value || 'Not specified';

  // Header (Letterhead structure)
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(220, 38, 38); // Brand Red
  doc.text('College', 14, 20);
  
  doc.setFont("Helvetica", "bold");
  doc.setTextColor(17, 24, 39); // Ink
  const brandWidth = doc.getTextWidth('College ');
  doc.text('Simplified', 14 + brandWidth, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('JOSAA Preference List Report', 14, 28);
  
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Rank: ${rank} | Category: ${cat} | Gender: ${gen} | State: ${homeState}`, 14, 34);
  if (currentStudentInfo && currentStudentInfo.name) {
    doc.text(`Student: ${currentStudentInfo.name}`, 14, 39);
  }

  // Right Side Info
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text('Official Website', 196, 16, { align: 'right' });
  doc.text('www.collegesimplified.in', 196, 21, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 196, 26, { align: 'right' });

  // Divider Line
  doc.setDrawColor(220, 38, 38); // Brand Red
  doc.setLineWidth(1);
  doc.line(14, 38, 196, 38);
  
  // Build profile table rows — include student info if present
  const profileRows = [];
  if (currentStudentInfo && currentStudentInfo.name) {
    profileRows.push(['Student Name', currentStudentInfo.name]);
    if (currentStudentInfo.email) profileRows.push(['Student Email', currentStudentInfo.email]);
    if (currentStudentInfo.phone) profileRows.push(['Student Phone', currentStudentInfo.phone]);
  }
  profileRows.push(['JEE Percentile', pct + '%']);
  profileRows.push(['Category Rank', rank]);
  profileRows.push(['Category', cat]);
  profileRows.push(['Gender', gen]);
  profileRows.push(['Home State', homeState]);

  doc.autoTable({
    startY: currentStudentInfo && currentStudentInfo.name ? 48 : 48,
    head: [['Field', 'Details']],
    body: profileRows,
    theme: 'plain',
    headStyles: { fillColor: [249, 250, 251], textColor: [107, 114, 128], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 }
  });

  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('Your Preference Order', 14, doc.lastAutoTable.finalY + 15);

  const tableData = prefList.map((c, i) => [
    i + 1,
    c.institute,
    c.branch.split('(')[0].trim(),
    c.instType || getInstituteType(c.institute),
    c.closingRank ? c.closingRank.toLocaleString() : 'N/A',
    c.state || ''
  ]);

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 20,
    head: [['#', 'Institute', 'Branch', 'Type', 'R6 Rank', 'State']],
    body: tableData,
    rowPageBreak: 'avoid',
    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    styles: { fontSize: 8, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 57 },
      2: { cellWidth: 45 },
      3: { cellWidth: 14 },
      4: { cellWidth: 18 },
      5: { cellWidth: 30 }
    }
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${i} of ${pageCount} — Created with College Simplified`, 14, doc.internal.pageSize.height - 10);
  }

  const pdfName = currentStudentInfo && currentStudentInfo.name
    ? `JOSAA_Preferences_${currentStudentInfo.name.replace(/\s+/g, '_')}.pdf`
    : `JOSAA_Preferences_${rank || 'List'}.pdf`;
  doc.save(pdfName);
  pbToast('PDF Generated Successfully!');
}

/* ══════ EXCEL EXPORT ══════ */
function exportExcel() {
  if (!prefList.length) return pbToast('List is empty');
  
  const pct = document.getElementById('inPct').value;
  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;
  const gen = document.getElementById('inGender').value;
  const homeState = document.getElementById('inState').value || 'Not specified';

  // Profile info rows
  const profileData = [
    ['JOSAA Preference List — College Simplified'],
    ['Generated on', new Date().toLocaleDateString('en-IN')],
    ['JEE Percentile', pct + '%'],
    ['Category Rank', rank],
    ['Category', cat],
    ['Gender', gen],
    ['Home State', homeState],
    [], // Empty row separator
    ['#', 'Institute', 'Branch', 'Type', 'State', 'Quota', 'R6 Closing Rank', 'R5 Closing Rank', 'R4 Closing Rank', 'R3 Closing Rank', 'R2 Closing Rank', 'R1 Closing Rank']
  ];

  const rows = prefList.map((c, i) => [
    i + 1,
    c.institute,
    c.branch,
    c.instType || getInstituteType(c.institute),
    c.state || '',
    c.quota || '',
    c.closingRank || '',
    c.r5 || '',
    c.r4 || '',
    c.r3 || '',
    c.r2 || '',
    c.r1 || ''
  ]);

  const wsData = [...profileData, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 50 }, { wch: 40 }, { wch: 8 }, { wch: 18 }, { wch: 6 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'JOSAA Preferences');
  XLSX.writeFile(wb, `JOSAA_Preferences_${rank || 'List'}.xlsx`);
  pbToast('Excel file downloaded!');
}

function switchSideTab(tab) {
  document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.sidebar-content').forEach(c => c.classList.toggle('active', c.id === 'side-' + tab));
}

/* ══════ UTILS ══════ */
function escH(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function escAttr(s) { return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;') }
function pbToast(msg) {
  let t = document.getElementById('pbToast');
  if (!t) { t = document.createElement('div'); t.id = 'pbToast'; t.className = 'pb-toast'; document.body.appendChild(t) }
  t.textContent = msg; t.style.display = 'flex';
  clearTimeout(t._tid); t._tid = setTimeout(() => t.style.display = 'none', 3000);
}

/* ══════ STUDENT DETAILS MODAL (Admin) ══════ */
function showStudentModal() {
  currentStudentInfo = null;
  const searchInput = document.getElementById('studentSearchInput');
  const resultsDiv = document.getElementById('studentSearchResults');
  const selectedCard = document.getElementById('studentSelectedCard');
  const nameInput = document.getElementById('studentName');
  const emailInput = document.getElementById('studentEmail');
  const phoneInput = document.getElementById('studentPhone');
  if (searchInput) searchInput.value = '';
  if (resultsDiv) resultsDiv.innerHTML = '';
  if (selectedCard) { selectedCard.style.display = 'none'; selectedCard.innerHTML = ''; }
  if (nameInput) nameInput.value = '';
  if (emailInput) emailInput.value = '';
  if (phoneInput) phoneInput.value = '';
  switchStudentMode('existing');
  const modal = document.getElementById('studentModal');
  if (modal) modal.classList.add('show');
}

function closeStudentModal() {
  const modal = document.getElementById('studentModal');
  if (modal) modal.classList.remove('show');
}

function switchStudentMode(mode) {
  const existingWrap = document.getElementById('studentExistingWrap');
  const customWrap = document.getElementById('studentCustomWrap');
  const existingLabel = document.getElementById('studentModeExisting');
  const customLabel = document.getElementById('studentModeCustom');
  if (mode === 'existing') {
    existingWrap.style.display = 'block';
    customWrap.style.display = 'none';
    existingLabel.style.border = '2px solid var(--brand)';
    existingLabel.style.background = 'var(--brand-soft)';
    existingLabel.style.color = 'var(--brand)';
    customLabel.style.border = '2px solid var(--stroke)';
    customLabel.style.background = 'transparent';
    customLabel.style.color = 'var(--muted)';
  } else {
    existingWrap.style.display = 'none';
    customWrap.style.display = 'block';
    customLabel.style.border = '2px solid var(--brand)';
    customLabel.style.background = 'var(--brand-soft)';
    customLabel.style.color = 'var(--brand)';
    existingLabel.style.border = '2px solid var(--stroke)';
    existingLabel.style.background = 'transparent';
    existingLabel.style.color = 'var(--muted)';
  }
  currentStudentInfo = null;
  const selectedCard = document.getElementById('studentSelectedCard');
  if (selectedCard) { selectedCard.style.display = 'none'; selectedCard.innerHTML = ''; }
}

let studentSearchTid = null;
async function searchExistingUsers() {
  clearTimeout(studentSearchTid);
  studentSearchTid = setTimeout(async () => {
    const query = (document.getElementById('studentSearchInput').value || '').toLowerCase().trim();
    const resultsDiv = document.getElementById('studentSearchResults');
    if (!query || query.length < 2) { resultsDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Type at least 2 characters to search</div>'; return; }
    resultsDiv.innerHTML = '<div class="pb-spinner" style="margin:20px auto"></div>';

    if (!cachedUsers) {
      const res = await authApi('getUsers');
      if (res.ok) cachedUsers = res.data || [];
      else { resultsDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--brand);font-size:12px">Failed to load users</div>'; return; }
    }

    const filtered = cachedUsers.filter(u => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    }).slice(0, 10);

    if (!filtered.length) {
      resultsDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No users found matching your search</div>';
      return;
    }

    resultsDiv.innerHTML = filtered.map(u => {
      const ini = (u.name || 'U').charAt(0).toUpperCase();
      return `<div onclick="selectExistingUser('${escH(u.id)}')" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;cursor:pointer;transition:0.2s;border:1.5px solid var(--stroke);margin-bottom:8px;background:var(--card)" onmouseover="this.style.borderColor='var(--brand)';this.style.background='var(--brand-soft)'" onmouseout="this.style.borderColor='var(--stroke)';this.style.background='var(--card)'">
        <div style="width:40px;height:40px;border-radius:50%;background:var(--brand-soft);color:var(--brand);display:grid;place-items:center;font-weight:800;font-size:16px;flex-shrink:0">${ini}</div>
        <div style="min-width:0;flex:1">
          <div style="font-weight:700;font-size:14px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escH(u.name)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escH(u.email || '')}${u.phone ? ' · ' + escH(u.phone) : ''}</div>
        </div>
      </div>`;
    }).join('');
  }, 300);
}

function selectExistingUser(userId) {
  if (!cachedUsers) return;
  const user = cachedUsers.find(u => u.id === userId);
  if (!user) return;
  currentStudentInfo = {
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    userId: user.id
  };
  const selectedCard = document.getElementById('studentSelectedCard');
  const resultsDiv = document.getElementById('studentSearchResults');
  if (resultsDiv) resultsDiv.innerHTML = '';
  if (selectedCard) {
    const ini = (user.name || 'U').charAt(0).toUpperCase();
    selectedCard.style.display = 'block';
    selectedCard.innerHTML = `<div style="display:flex;align-items:center;gap:14px;padding:16px;border-radius:16px;border:2px solid var(--brand);background:var(--brand-soft)">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:800;font-size:18px;flex-shrink:0">${ini}</div>
      <div style="min-width:0;flex:1">
        <div style="font-weight:800;font-size:15px;color:var(--ink)">${escH(user.name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">${escH(user.email || '')}${user.phone ? ' · ' + escH(user.phone) : ''}</div>
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
    </div>`;
  }
  document.getElementById('studentSearchInput').value = user.name;
}

function submitStudentInfo() {
  const mode = document.querySelector('input[name="studentMode"]:checked')?.value || 'existing';
  if (mode === 'existing') {
    if (!currentStudentInfo || !currentStudentInfo.name) {
      pbToast('Please search and select a student');
      return;
    }
  } else {
    const name = (document.getElementById('studentName').value || '').trim();
    if (!name) {
      pbToast('Student name is required');
      return;
    }
    currentStudentInfo = {
      name: name,
      email: (document.getElementById('studentEmail').value || '').trim(),
      phone: (document.getElementById('studentPhone').value || '').trim()
    };
  }
  closeStudentModal();
  currentFormId = null;
  prefList = [...FIXED_ASPIRATIONAL];
  selectedColleges = [];
  selectedBranches = new Set();
  if (prefLocked) lockProfileFields();
  else unlockProfileFields();
  renderEditStatus();
  goStep(1);
}

function togglePill(input) {
  const pill = input.parentElement;
  if (input.checked) {
    pill.style.background = 'var(--brand-soft)';
    pill.style.borderColor = 'var(--brand)';
    pill.style.color = 'var(--brand)';
  } else {
    pill.style.background = 'var(--bg)';
    pill.style.borderColor = 'var(--stroke)';
    pill.style.color = 'var(--muted)';
  }
}

/* ══════ PREF DATA SAVE/LOAD ══════ */
async function loadSavedPrefData() {
  if (!currentUserId) return;
  const res = await authApi('getJosaaPrefData', { userId: currentUserId });
  if (res.ok && res.data) {
    prefDataLoaded = true;
    prefEditCount = res.data.editCount || 0;
    const user = getSession();
    const isAdmin = user && user.role === 'admin';
    prefLocked = !isAdmin && prefEditCount >= 3;
    allForms = res.data.forms || [];

    if (allForms.length > 0) {
      const latest = allForms[0];
      document.getElementById('inPct').value = latest.percentile || '';
      document.getElementById('inRank').value = latest.rank || '';
      if (latest.category) document.getElementById('inCategory').value = latest.category;
      if (latest.gender) document.getElementById('inGender').value = latest.gender;
      if (latest.homeState) document.getElementById('inState').value = latest.homeState;
    }

    renderEditStatus();
    
    const dashSec = document.getElementById('dashboardDrafts');
    const dashList = document.getElementById('dashboardDraftsList');
    if (dashSec && dashList) {
      if (allForms.length > 0) {
        dashSec.style.display = 'block';
        dashList.innerHTML = allForms.map(form => {
          const date = form.updatedAt ? new Date(form.updatedAt.toDate ? form.updatedAt.toDate() : form.updatedAt).toLocaleDateString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : 'Recently';
          const studentInfo = form.studentInfo;
          const studentLine = studentInfo && studentInfo.name
            ? `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;font-weight:700;color:var(--ink2)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                ${escH(studentInfo.name)}${studentInfo.email ? ' · ' + escH(studentInfo.email) : ''}
              </div>`
            : '';
          return `<div class="col-card dashboard-form-card" style="text-align: left; border: 1px solid var(--stroke); padding: 20px; cursor: default; margin-bottom: 12px">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px">
              <div>
                <div style="font-weight: 800; color: var(--brand); font-size: 17px">JOSAA Preference List</div>
                <div style="font-size: 11px; color: var(--muted); margin-top: 2px; display: flex; align-items: center; gap: 4px">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  ${date}
                </div>
                ${studentLine}
              </div>
              <div style="display: flex; gap: 8px; align-items: center">
                <div style="background: var(--brand-soft); color: var(--brand); padding: 3px 10px; border-radius: 6px; font-size: 9px; font-weight: 800; border: 1px solid var(--brand-ring); text-transform: uppercase">ID: ${form.id.slice(-4)}</div>
                <button onclick="deleteForm('${form.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center" title="Delete Draft">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
            
            <div class="dash-card-stats" style="margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 16px; border: 1px solid var(--stroke); display: flex; flex-direction: column; gap: 12px">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px">
                <span style="font-weight: 800; color: var(--ink)">Rank: ${form.rank || '??'}</span>
                <span style="font-weight: 700; color: var(--brand); font-size: 11px">${form.homeState || 'State N/A'}</span>
              </div>
              <div style="font-size: 12px; font-weight: 600; color: var(--ink2); padding-top: 8px; border-top: 1px dashed var(--stroke); display: flex; justify-content: space-between">
                <span>Category: ${form.category || 'Open'}</span>
                <span style="color:var(--muted)">${form.gender === 'Female-only (including Supernumerary)' ? 'Female-only' : 'Gender-Neutral'}</span>
              </div>
            </div>

              <button class="pb-btn pb-btn-primary" onclick="loadForm('${form.id}')" style="flex: 1; padding: 10px; justify-content: center; font-size: 13px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Resume List
              </button>
          </div>`;
        }).join('');
      } else {
        dashSec.style.display = 'none';
      }
    }
    goStep(0); 
  } else {
    renderEditStatus();
    goStep(1);
  }
}

function renderEditStatus() {
  let wrap = document.getElementById('editStatusWrap');
  if (wrap) wrap.style.display = 'none';
  let saveWrap = document.getElementById('saveProfileWrap');
  if (saveWrap) saveWrap.style.display = 'none';
  unlockProfileFields();
}

function lockProfileFields() {
  // Permanently unlocked - do nothing
}

function unlockProfileFields() {
  const el = document.getElementById('inPct');
  if (el) { el.disabled = false; el.style.opacity = '1'; el.style.cursor = ''; }
}

function enableEditing() {
  const user = getSession();
  const isAdmin = user && user.role === 'admin';
  if (isAdmin) {
    unlockProfileFields();
    let saveWrap = document.getElementById('saveProfileWrap');
    if (saveWrap) saveWrap.style.display = 'flex';
    document.getElementById('editStatusWrap').style.opacity = '0.4';
    return;
  }
  const remaining = 3 - prefEditCount;
  if (remaining <= 0) { pbToast('No edits remaining'); return; }

  const msg = remaining === 1 ?
    '⚠️ WARNING: This is your LAST edit! After saving, you will be locked out. Are you sure?' :
    `You have used ${prefEditCount}/3 edits. Are you sure you want to use another edit?`;

  if (!confirm(msg)) return;

  unlockProfileFields();
  let saveWrap = document.getElementById('saveProfileWrap');
  if (saveWrap) saveWrap.style.display = 'flex';
  document.getElementById('editStatusWrap').style.opacity = '0.4';
}

async function saveProfileData() {
  if (!validateStep1(true)) return;
  const pct = document.getElementById('inPct').value;
  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;
  const gender = document.getElementById('inGender').value;
  const homeState = document.getElementById('inState').value;
  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
  const res = await authApi('saveJosaaPrefData', { 
    userId: currentUserId, 
    formId: currentFormId,
    percentile: pct, 
    rank: rank, 
    category: cat,
    gender: gender,
    homeState: homeState,
    prefList: prefList,
    incrementEdit: true 
  });
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save & Lock'; }
  if (res.ok) {
    if (res.data.formId) currentFormId = res.data.formId;
    prefEditCount = res.data.editCount;
    prefDataLoaded = true;
    const user = getSession();
    const isAdmin = user && user.role === 'admin';
    prefLocked = !isAdmin && prefEditCount >= 3;
    document.getElementById('editStatusWrap').style.opacity = '1';
    renderEditStatus();
    lockProfileFields();
    let saveWrap = document.getElementById('saveProfileWrap');
    if (saveWrap) saveWrap.style.display = 'none';
    if (isAdmin) {
      pbToast('Profile saved!');
    } else {
      pbToast('Profile saved! ' + (3 - prefEditCount) + ' edits remaining.');
    }
  } else {
    pbToast(res.error || 'Failed to save');
  }
}

function openReportModal() {
  let modal = document.getElementById('reportModal');
  if (modal) modal.classList.add('show');
}

function closeReportModal() {
  let modal = document.getElementById('reportModal');
  if (modal) modal.classList.remove('show');
}

async function submitEditRequest() {
  const user = getSession();
  if (!user) return;
  const msg = (document.getElementById('reportMessage').value || '').trim() || 'Please unlock my JOSAA preference list edits.';
  const btn = document.getElementById('submitReportBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  const res = await authApi('submitEditRequest', { userId: currentUserId, userName: user.name, userEmail: user.email, message: msg, tool: 'josaa-pref-builder' });
  if (btn) { btn.disabled = false; btn.textContent = 'Send Request'; }
  if (res.ok) {
    pbToast('Request sent! Admin will review it shortly.');
    closeReportModal();
  } else {
    pbToast(res.error || 'Failed to send request');
  }
}

/* ══════ BOOT ══════ */
async function boot() {
  const session = initAuth({ requireLogin: true, requirePremium: true, toolContainerId: 'toolArea' });
  if (!session) return;
  const user = getSession();
  if (user) currentUserId = user.id;
  await loadData();
  await loadSavedPrefData();
}

// Expose globals
window.goStep = goStep; window.toggleBranch = toggleBranch; window.toggleCategory = toggleCategory;
window.toggleAllBranches = toggleAllBranches; window.toggleCatCollapse = toggleCatCollapse;
window.toggleCollege = toggleCollege; window.filterColleges = filterColleges;
window.removePref = removePref; window.handleAddSuggestion = handleAddSuggestion;
window.returnToDashboard = returnToDashboard;
window.exportPDF = exportPDF; window.exportExcel = exportExcel;
window.switchSideTab = switchSideTab;
window.deleteForm = deleteForm; window.startNewForm = startNewForm; window.loadForm = loadForm;
window.dragStart = dragStart; window.dragOver = dragOver; window.dropItem = dropItem; window.dragEnd = dragEnd;
window.toggleAspirational = toggleAspirational;
window.enableEditing = enableEditing; window.saveProfileData = saveProfileData;
window.openReportModal = openReportModal; window.closeReportModal = closeReportModal;
window.submitEditRequest = submitEditRequest;
window.searchManualColleges = searchManualColleges;
window.searchManualCollegesList = searchManualCollegesList;
window.sortPrefList = sortPrefList;
window.handleTouchStart = handleTouchStart;
window.handleTouchMove = handleTouchMove;
window.handleTouchEnd = handleTouchEnd;
window.togglePill = togglePill;
window.showStudentModal = showStudentModal;
window.closeStudentModal = closeStudentModal;
window.switchStudentMode = switchStudentMode;
window.searchExistingUsers = searchExistingUsers;
window.selectExistingUser = selectExistingUser;
window.submitStudentInfo = submitStudentInfo;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
