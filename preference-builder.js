'use strict';

/* ══════ STATE ══════ */
let cutoffData = [], collegeMetadata = [], selectedBranches = new Set(), matchedColleges = [], selectedColleges = [], prefList = [], allBranchNames = [];
let prefEditCount = 0;
let prefLocked = false;
let prefDataLoaded = false;
let currentFormId = null;
let allForms = [];
let currentUserId = null;
let expandedCategories = new Set();
const CATS = {
  'Computer & IT': ['COMPUTER', 'INFORMATION TECHNOLOGY', 'AI', 'ARTIFICIAL', 'DATA SCIENCE', 'MACHINE LEARNING', 'SOFTWARE', 'CYBER', 'ROBOTICS'],
  'Electronics & Telecom': ['ELECTRONICS', 'TELECOMMUNICATION', 'ENTC', 'COMMUNICATION', 'INSTRUMENTATION'],
  'Core Engineering': ['MECHANICAL', 'CIVIL', 'ELECTRICAL', 'CHEMICAL', 'PRODUCTION', 'METALLURGY', 'AUTOMOBILE', 'TEXTILE', 'MINING'],
  'Biotech & Allied': ['BIOTECHNOLOGY', 'BIO-MEDICAL', 'BIO MEDICAL', 'FOOD', 'AGRICULTURE', 'PHARMACEUTICAL'],
  'Other Branches': []
};
const FIXED_ASPIRATIONAL = [
  { code: '16006', instituteName: 'COEP Technological University', branch: 'Computer Engineering', percentile: 99.98, isFixed: true, isAspirational: true },
  { code: '3012', instituteName: 'Veermata Jijabai Technological Institute (VJTI)', branch: 'Computer Engineering', percentile: 99.95, isFixed: true, isAspirational: true },
  { code: '3012', instituteName: 'Veermata Jijabai Technological Institute (VJTI)', branch: 'Information Technology', percentile: 99.92, isFixed: true, isAspirational: true },
  { code: '16006', instituteName: 'COEP Technological University', branch: 'Artificial Intelligence and Machine Learning', percentile: 99.88, isFixed: true, isAspirational: true },
  { code: '3215', instituteName: 'Sardar Patel Institute of Technology (SPIT)', branch: 'Computer Science and Engineering', percentile: 99.85, isFixed: true, isAspirational: true },
  { code: '3215', instituteName: 'Sardar Patel Institute of Technology (SPIT)', branch: 'Computer Engineering', percentile: 99.82, isFixed: true, isAspirational: true }
];

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
    // Restore checkbox selections from keys if available
    if (window._tempKeys && window._tempKeys.length > 0) {
      selectedColleges = [];
      window._tempKeys.forEach(key => {
        const idx = matchedColleges.findIndex(c => (c.code + '|' + c.branch) === key);
        if (idx >= 0) selectedColleges.push(idx);
      });
      delete window._tempKeys;
      renderColleges('all');
    }
  }
  if (n === 4) buildPrefList();
  
  // Save progress on every step transition
  if (n > 0) saveNonLockedData();
  
  currentStep = n;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const targetPanel = document.getElementById('panel' + n);
  if (targetPanel) targetPanel.classList.add('active');
  
  // Manage Stepper
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
  currentFormId = null;
  prefList = [...FIXED_ASPIRATIONAL];
  selectedColleges = [];
  selectedBranches = new Set(); // Clear branch selections
  
  if (prefLocked) lockProfileFields();
  else unlockProfileFields();
  
  renderEditStatus();
  goStep(1);
}

function loadForm(formId, step = 1) {
  const form = allForms.find(f => f.id === formId);
  if (!form) return;
  currentFormId = formId;
  document.getElementById('inPct').value = form.percentile || '';
  document.getElementById('inRank').value = form.rank || '';
  document.getElementById('inCategory').value = form.category || 'OPEN';
  document.getElementById('inRegion').value = form.region || '';
  prefList = form.prefList || [];
  
  // Ensure Fixed Aspirational are present even in old forms
  FIXED_ASPIRATIONAL.forEach(fa => {
    if (!prefList.some(p => p.code === fa.code && p.branch === fa.branch)) {
      prefList.unshift(fa);
    }
  });

  selectedBranches = new Set(form.selectedBranches || []);
  window._tempKeys = form.selectedCollegeKeys || [];
  
  if (form.colType) document.getElementById('inColType').value = form.colType;
  if (form.minority) document.getElementById('inMinority').value = form.minority;
  
  if (prefLocked) lockProfileFields();
  else unlockProfileFields();
  
  renderBranches();
  renderEditStatus();
  
  // Use saved step if not explicitly provided
  const targetStep = step || form.currentStep || 1;
  goStep(targetStep);
}

async function deleteForm(formId) {
  if (!confirm('Are you sure you want to delete this preference list? This action cannot be undone.')) return;
  const res = await authApi('deleteForm', { userId: currentUserId, formId });
  if (res.ok) {
    pbToast('Form deleted successfully');
    loadSavedPrefData();
  } else {
    pbToast('Error: ' + res.error);
  }
}

function returnToDashboard() {
  loadSavedPrefData(); // Refresh list
}

async function saveNonLockedData() {
  if (!currentUserId) return;
  const pct = document.getElementById('inPct').value;
  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;
  const region = document.getElementById('inRegion').value;
  
  const res = await authApi('savePrefData', { 
    userId: currentUserId, 
    formId: currentFormId,
    percentile: pct, 
    rank: rank, 
    category: cat, 
    region: region, 
    prefList: prefList,
    selectedBranches: Array.from(selectedBranches),
    selectedCollegeKeys: selectedColleges.map(idx => matchedColleges[idx] ? matchedColleges[idx].code + '|' + matchedColleges[idx].branch : '').filter(Boolean),
    currentStep: currentStep,
    colType: document.getElementById('inColType').value,
    minority: document.getElementById('inMinority').value,
    skipEditCount: true 
  });
  if (res.ok && res.data.formId) currentFormId = res.data.formId;
}

let autoTid = null;
function triggerAutosave() {
  clearTimeout(autoTid);
  autoTid = setTimeout(saveNonLockedData, 1000);
}

function validateStep1() {
  const p = document.getElementById('inPct').value, r = document.getElementById('inRank').value;
  if (!p || isNaN(parseFloat(p))) { pbToast('Enter valid percentile'); return false }
  if (!r || isNaN(parseInt(r))) { pbToast('Enter valid rank'); return false }
  return true;
}

/* ══════ DATA LOADING ══════ */
async function loadData() {
  const loader = document.getElementById('dataLoader');
  try {
    loader.innerHTML = '<div class="pb-spinner"></div><span>Loading cutoff data (12MB)...</span>';
    const r1 = await fetch('data.json'); const j1 = await r1.json();
    const raw1 = j1['MHT-CET College Data'] || j1[Object.keys(j1)[0]] || [];
    cutoffData = raw1.map(r => ({
      code: String(r['Institute Code'] || ''), name: r['Institute'] || r['Institute Name'] || '',
      branch: (r['Branch'] || r['Branch Name'] || '').trim(),
      seatType: r['Seat Type'] || '', rank: parseInt(r['Rank']) || 0,
      percentile: parseFloat(r['Percentile']) || 0
    }));

    loader.querySelector('span').textContent = 'Loading college metadata...';
    const r2 = await fetch('college-data.json'); const j2 = await r2.json();
    collegeMetadata = (j2['college-data'] || []).map(c => ({
      code: String(c['Institute Code'] || ''), name: c['Institute Name'] || '',
      status: c['Status'] || '', intake: c['Total Intake'] || 0
    }));

    // Extract branches
    const bSet = new Set();
    cutoffData.forEach(r => { if (r.branch) bSet.add(r.branch) });
    allBranchNames = Array.from(bSet).sort();
    renderBranches();
    loader.style.display = 'none';
    document.getElementById('predictBtn').disabled = false;
  } catch (e) {
    console.error(e);
    loader.innerHTML = '<span style="color:var(--brand)">Failed to load data. Please refresh.</span>';
  }
}

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
  row.innerHTML = Array.from(selectedBranches).map(b => `<span class="bchip">${b}<span class="bchip-x" onclick="toggleBranch('${b.replace(/'/g, "\\'")}')">×</span></span>`).join('');
}

/* ══════ COLLEGE MATCHING (Step 3) ══════ */
function generateMatches() {
  const pct = parseFloat(document.getElementById('inPct').value);
  const rank = parseInt(document.getElementById('inRank').value);
  const region = document.getElementById('inRegion').value;
  const colType = document.getElementById('inColType').value;
  const minority = document.getElementById('inMinority').value;
  const category = document.getElementById('inCategory').value;

  // Build category seat filter
  const catMap = { 'OPEN': 'OPEN', 'OBC': 'OBC', 'SC': 'SC', 'ST': 'ST', 'VJ/DT': 'VJ', 'NT1': 'NT1', 'NT2': 'NT2', 'NT3': 'NT3', 'EWS': 'EWS', 'TFWS': 'TFWS' };
  const searchCat = catMap[category] || 'OPEN';

  // Filter cutoff data
  let filtered = cutoffData.filter(r => {
    if (!selectedBranches.has(r.branch)) return false;
    if (searchCat !== 'OPEN' && !(r.seatType || '').includes(searchCat)) return false;
    if (searchCat === 'OPEN' && !(r.seatType || '').includes('OPEN')) return false;
    return true;
  });

  // Group by institute+branch, pick closest percentile
  const groups = {};
  filtered.forEach(r => {
    const key = r.code + '|' + r.branch;
    if (!groups[key] || Math.abs(r.percentile - pct) < Math.abs(groups[key].percentile - pct)) {
      groups[key] = r;
    }
  });

  let results = Object.values(groups);

  // Enrich with college metadata
  const metaMap = {};
  collegeMetadata.forEach(c => metaMap[c.code] = c);

  results = results.map(r => {
    const meta = metaMap[r.code] || {};
    const status = (meta.status || '').toLowerCase();
    return {
      ...r, instituteName: meta.name || r.name,
      status: meta.status || '', intake: meta.intake || 0,
      isGov: status.includes('government'),
      isAided: status.includes('aided'),
      isAuto: status.includes('autonomous'),
      isMinority: status.includes('minority'),
      minorityType: extractMinority(meta.status || ''),
      diff: r.percentile - pct
    };
  });

  // Apply reachable filters (ColType, Minority, Region)
  let reachableList = results;
  if (colType) {
    reachableList = reachableList.filter(r => {
      if (colType === 'Government') return r.isGov;
      if (colType === 'Aided') return r.isAided;
      if (colType === 'Autonomous') return r.isAuto;
      if (colType === 'Un-Aided') return !r.isGov && !r.isAided;
      return true;
    });
  }
  if (minority) {
    reachableList = reachableList.filter(r => r.isMinority && r.minorityType.toLowerCase().includes(minority.toLowerCase()));
  }
  if (region) {
    reachableList = reachableList.filter(r => (r.instituteName || '').toLowerCase().includes(region.toLowerCase()));
  }

  // Apply aspirational filters (IGNORE minority filter)
  let aspirationalList = results;
  if (colType) {
    aspirationalList = aspirationalList.filter(r => {
      if (colType === 'Government') return r.isGov;
      if (colType === 'Aided') return r.isAided;
      if (colType === 'Autonomous') return r.isAuto;
      if (colType === 'Un-Aided') return !r.isGov && !r.isAided;
      return true;
    });
  }
  // User said: dont consider minority in aspirational ones
  if (region) {
    aspirationalList = aspirationalList.filter(r => (r.instituteName || '').toLowerCase().includes(region.toLowerCase()));
  }

  // Split: reachable vs aspirational
  const reachable = reachableList.filter(r => r.percentile <= pct).sort((a, b) => b.percentile - a.percentile).slice(0, 34);

  // For aspirational, we take from the list that IGNORES minority status
  const aspirational = aspirationalList
    .filter(r => r.percentile > pct)
    .sort((a, b) => a.percentile - b.percentile)
    .slice(0, 6); // Select exactly 6 aspirational colleges as requested

  aspirational.forEach(r => r.isAspirational = true);
  matchedColleges = [...aspirational, ...reachable];

  // Suggestion pool: branch+cat+region+colType matching colleges that were filtered out by minority
  // (Or any other colleges the user might want to see as suggestions)
  suggestionPool = results.filter(r => {
    // Ignore minority filter
    if (colType) {
      const status = (r.status || '').toLowerCase();
      if (colType === 'Government' && !status.includes('government')) return false;
      if (colType === 'Aided' && !status.includes('aided')) return false;
      if (colType === 'Autonomous' && !status.includes('autonomous')) return false;
      if (colType === 'Un-Aided' && (status.includes('government') || status.includes('aided'))) return false;
    }
    if (region && !(r.instituteName || '').toLowerCase().includes(region.toLowerCase())) return false;

    // Don't include what's already in matchedColleges
    if (matchedColleges.some(m => m.code === r.code && m.branch === r.branch)) return false;

    return true;
  }).sort((a, b) => Math.abs(a.percentile - pct) - Math.abs(b.percentile - pct));

  // Auto-select reachable + aspirational
  selectedColleges = matchedColleges.map((_, i) => i);
  renderColleges();
}

let suggestionPool = [];

function extractMinority(status) {
  const m = status.match(/(Religious Minority\s*-\s*\w+|Linguistic Minority\s*-\s*\w+)/i);
  return m ? m[1] : '';
}

function renderColleges(filter = 'all') {
  const grid = document.getElementById('collegeGrid');
  const countEl = document.getElementById('matchCount');
  let items = matchedColleges;

  if (filter === 'aspirational') items = matchedColleges.filter(r => r.isAspirational);
  else if (filter === 'reachable') items = matchedColleges.filter(r => !r.isAspirational);
  else if (filter === 'government') items = matchedColleges.filter(r => r.isGov);
  else if (filter === 'autonomous') items = matchedColleges.filter(r => r.isAuto);

  countEl.textContent = items.length + ' colleges found (' + selectedColleges.length + ' selected)';

  if (!items.length) {
    const minority = document.getElementById('inMinority').value;
    const region = document.getElementById('inRegion').value;
    let msg = 'Try adjusting your filters or branch preferences.';
    if (minority) msg = `no colleges found !! for ${minority} ${region ? 'in ' + region : ''}`;

    grid.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><h3>No Matches</h3><p>${msg}</p></div>`;
    return;
  }

  grid.innerHTML = items.map((c, idx) => {
    const realIdx = matchedColleges.indexOf(c);
    const sel = selectedColleges.includes(realIdx);
    const asp = c.isAspirational ? 'aspirational' : '';
    const tags = [];
    if (c.isGov) tags.push('<span class="col-tag gov">Government</span>');
    if (c.isAuto) tags.push('<span class="col-tag auto">Autonomous</span>');
    if (c.isMinority) tags.push('<span class="col-tag minority">' + escH(c.minorityType || 'Minority') + '</span>');
    if (c.isAided) tags.push('<span class="col-tag">Aided</span>');

    return `<div class="col-card ${sel ? 'selected' : ''} ${asp}" onclick="toggleCollege(${realIdx})">
      <div class="col-chk">${sel ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      <div class="col-name">${escH(c.instituteName)}</div>
      <div class="col-meta">
        ${tags.join('')}
        <span class="col-tag branch-tag">${escH(c.branch)}</span>
        ${c.intake ? `<span class="col-tag intake">Intake: ${c.intake}</span>` : ''}
      </div>
      <div class="col-pct"><strong>${c.percentile.toFixed(2)}%</strong> <small>Cutoff | Code: ${c.code}</small></div>
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

/* ══════ PREFERENCE LIST (Step 4) ══════ */
function buildPrefList() {
  const userAspirational = matchedColleges.filter((c, i) => selectedColleges.includes(i) && c.isAspirational);
  const userNormal = matchedColleges.filter((c, i) => selectedColleges.includes(i) && !c.isAspirational);
  
  // Sort normal by percentile desc
  userNormal.sort((a, b) => b.percentile - a.percentile);

  // Filter out any user selected that are already in FIXED
  const filteredUserAsp = userAspirational.filter(ua => !FIXED_ASPIRATIONAL.some(fa => fa.code === ua.code && fa.branch === ua.branch));

  // Combine: Fixed -> User Aspirational -> User Normal
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
  const pct = parseFloat(document.getElementById('inPct').value) || 0;

  // 1. Current Aspirational in Pref List
  const allAsp = prefList.filter(c => c.isAspirational);
  grid.innerHTML = allAsp.map(c => {
    const tags = [];
    if (c.isGov) tags.push('<span class="col-tag gov">Government</span>');
    if (c.isAuto) tags.push('<span class="col-tag auto">Autonomous</span>');
    return `<div class="col-card selected aspirational" onclick="toggleAspirational('${c.code}','${c.branch.replace(/'/g, "\\'")}')">
      <div class="col-chk"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="col-name">${escH(c.instituteName)}</div>
      <div class="col-meta">${tags.join('')}<span class="col-tag branch-tag">${escH(c.branch)}</span></div>
      <div class="col-pct"><strong>${c.percentile.toFixed(2)}%</strong> <small>Code: ${c.code}</small></div>
    </div>`;
  }).join('');

  if (!allAsp.length) grid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No aspirational colleges added</div>';

  // 2. Aspirational Suggestions (from suggestionPool)
  if (suggGrid) {
    const inPref = new Set(prefList.map(p => p.code + '|' + p.branch));
    const pool = suggestionPool.filter(c => !inPref.has(c.code + '|' + c.branch) && c.percentile > pct).slice(0, 8);
    suggGrid.innerHTML = pool.map(c => `<div class="col-card aspirational" onclick="toggleAspirational('${c.code}','${c.branch.replace(/'/g, "\\'")}')">
      <div class="col-chk"></div>
      <div class="col-name">${escH(c.instituteName)}</div>
      <div class="col-meta"><span class="col-tag">${escH(c.branch)}</span></div>
      <div class="col-pct">${c.percentile.toFixed(2)}%<small>Code: ${c.code}</small></div>
    </div>`).join('');
    if (!pool.length) suggGrid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No more suggestions</div>';
  }
}

let searchTimeout = null;
function searchManualColleges() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const query = (document.getElementById('manualSearchInput').value || '').toLowerCase().trim();
    const resDiv = document.getElementById('manualSearchResults');
    if (!query) { resDiv.innerHTML = ''; return; }
    resDiv.innerHTML = '<div class="pb-spinner" style="margin:20px auto"></div>';
    const results = cutoffData.filter(r => r.code.includes(query) || (r.name || '').toLowerCase().includes(query) || (r.branch || '').toLowerCase().includes(query)).slice(0, 15);
    if (!results.length) { resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No colleges found</div>'; return; }

    const metaMap = {}; collegeMetadata.forEach(c => metaMap[c.code] = c);
    const inPref = new Set(prefList.map(p => p.code + '|' + p.branch));

    resDiv.innerHTML = results.map(r => {
      const meta = metaMap[r.code] || {};
      const status = (meta.status || '').toLowerCase();
      const isSel = inPref.has(r.code + '|' + r.branch);
      const tags = [];
      if (status.includes('government')) tags.push('<span class="col-tag gov">Government</span>');
      if (status.includes('autonomous')) tags.push('<span class="col-tag auto">Autonomous</span>');

      return `<div class="col-card ${isSel ? 'selected' : ''}" style="margin-bottom:12px; cursor: default">
        <div class="col-name" style="padding-right:50px">${escH(meta.name || r.name)}</div>
        <div class="col-meta">
          ${tags.join('')}
          <span class="col-tag branch-tag">${escH(r.branch)}</span>
        </div>
        <div class="col-pct"><strong>${r.percentile.toFixed(2)}%</strong> <small>Cutoff | Code: ${r.code}</small></div>
        <button class="pb-btn pb-btn-primary" onclick="handleAddSuggestion('${r.code}','${r.branch.replace(/'/g, "\\'")}')" style="position:absolute; right:12px; top:12px; width:34px; height:34px; padding:0; border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow: none">
          ${isSel ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'}
        </button>
      </div>`;
    }).join('');
  }, 300);
}

let searchListTimeout = null;
function searchManualCollegesList() {
  clearTimeout(searchListTimeout);
  searchListTimeout = setTimeout(async () => {
    const query = (document.getElementById('manualSearchInputList').value || '').toLowerCase().trim();
    const resDiv = document.getElementById('manualSearchResultsList');
    if (!query) { resDiv.innerHTML = ''; return; }
    resDiv.innerHTML = '<div class="pb-spinner" style="margin:20px auto"></div>';
    const results = cutoffData.filter(r => r.code.includes(query) || (r.name || '').toLowerCase().includes(query) || (r.branch || '').toLowerCase().includes(query)).slice(0, 15);
    if (!results.length) { resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No colleges found</div>'; return; }

    const metaMap = {}; collegeMetadata.forEach(c => metaMap[c.code] = c);
    const inPref = new Set(prefList.map(p => p.code + '|' + p.branch));

    resDiv.innerHTML = results.map(r => {
      const meta = metaMap[r.code] || {};
      const status = (meta.status || '').toLowerCase();
      const isSel = inPref.has(r.code + '|' + r.branch);
      const tags = [];
      if (status.includes('government')) tags.push('<span class="col-tag gov">Government</span>');
      if (status.includes('autonomous')) tags.push('<span class="col-tag auto">Autonomous</span>');

      return `<div class="col-card ${isSel ? 'selected' : ''}" style="margin-bottom:12px; cursor: default">
        <div class="col-name" style="padding-right:50px">${escH(meta.name || r.name)}</div>
        <div class="col-meta">
          ${tags.join('')}
          <span class="col-tag branch-tag">${escH(r.branch)}</span>
        </div>
        <div class="col-pct"><strong>${r.percentile.toFixed(2)}%</strong> <small>Cutoff | Code: ${r.code}</small></div>
        <button class="pb-btn pb-btn-primary" onclick="handleAddSuggestion('${r.code}','${r.branch.replace(/'/g, "\\'")}')" style="position:absolute; right:12px; top:12px; width:34px; height:34px; padding:0; border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow: none">
          ${isSel ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'}
        </button>
      </div>`;
    }).join('');
  }, 300);
}

function sortPrefList() {
  prefList.sort((a, b) => b.percentile - a.percentile);
  renderPrefList();
  pbToast('List sorted by cutoff percentile');
}

function toggleAspirational(code, branch) {
  const key = code + '|' + branch;
  const idx = prefList.findIndex(p => p.code === code && p.branch === branch);
  if (idx >= 0) {
    // Prevent removing fixed aspirational
    if (prefList[idx].isFixed) return pbToast('Cannot remove fixed college');
    prefList.splice(idx, 1);
    pbToast('Removed from preference list');
  } else {
    const c = matchedColleges.find(r => r.code === code && r.branch === branch);
    if (c) { prefList.push({ ...c }); pbToast('Added to preference list'); }
  }
  renderPrefList(); renderAspirational(); renderSuggestions();
  triggerAutosave();
}

function renderPrefList() {
  const list = document.getElementById('prefListUl');
  const count = document.getElementById('prefCount');
  if (!count) return;
  count.textContent = prefList.length + ' colleges';
  if (!prefList.length) {
    list.innerHTML = '<div class="empty-state" style="padding:40px"><h3>No colleges added</h3><p>Go back and select colleges.</p></div>';
    return;
  }

  list.innerHTML = prefList.map((c, i) => {
    const isFixed = c.isFixed;
    return `
      <li class="pref-item ${isFixed ? 'is-fixed' : ''} ${c.isAspirational ? 'asp-item' : ''}" 
          draggable="${!isFixed}" 
          data-idx="${i}"
          ondragstart="${isFixed ? '' : 'dragStart(event)'}" 
          ondragover="${isFixed ? '' : 'dragOver(event)'}" 
          ondrop="${isFixed ? '' : 'dropItem(event)'}" 
          ondragend="${isFixed ? '' : 'dragEnd(event)'}"
          style="${isFixed ? 'border-left: 4px solid var(--brand); cursor: default' : ''}">
        <div class="pref-grip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/>
            <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
            <circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
        </div>
        <div class="pref-num">${i + 1}</div>
        <div class="pref-info">
          <div class="pref-name">${escH(c.instituteName || c.name)}</div>
          <div class="pref-branch">${escH(c.branch)} <span class="pref-code">${c.code}</span></div>
          <div class="pref-cutoff" style="font-size:11px; color:var(--muted); margin-top:4px">Cutoff: <strong>${c.percentile ? c.percentile.toFixed(2) + '%' : 'N/A'}</strong></div>
        </div>
        <div class="pref-actions">
          ${isFixed ? 
            '<span style="font-size:10px; font-weight:800; color:var(--brand); opacity:0.6; text-transform:uppercase; padding-right:8px">Mandatory</span>' : 
            `<button class="pref-remove" onclick="removePref(${i})" title="Remove">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>`
          }
        </div>
      </li>`;
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
  const prefCodes = new Set(prefList.map(c => c.code + '|' + c.branch));

  // Combine matchedColleges (not in pref) and suggestionPool (not in pref)
  const currentMatches = matchedColleges.filter(c => !prefCodes.has(c.code + '|' + c.branch));
  const poolMatches = suggestionPool.filter(c => !prefCodes.has(c.code + '|' + c.branch));

  const suggs = [...currentMatches, ...poolMatches].slice(0, 12);

  if (!suggs.length) { panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No more suggestions</div>'; return }

  panel.innerHTML = suggs.map((c, i) => `<div class="sugg-item">
    <div class="sugg-info">
      <div class="sugg-name">${escH(c.instituteName || c.name)}</div>
      <div class="sugg-sub">${escH(c.branch)} | ${c.percentile.toFixed(2)}%</div>
      ${c.isMinority ? `<div style="font-size:10px; color:var(--brand); font-weight:600">${escH(c.minorityType)}</div>` : ''}
    </div>
    <button class="sugg-add" onclick="handleAddSuggestion('${c.code}','${c.branch.replace(/'/g, "\\'")}')">+ Add</button>
  </div>`).join('');
}

function handleAddSuggestion(code, branch) {
  // Search in matched pool first
  let c = [...matchedColleges, ...suggestionPool].find(r => r.code === code && r.branch === branch);

  // If not found (manual search), enrich from cutoffData and metadata
  if (!c) {
    const raw = cutoffData.find(r => r.code === code && r.branch === branch);
    if (raw) {
      const metaMap = {}; collegeMetadata.forEach(m => metaMap[m.code] = m);
      const meta = metaMap[code] || {};
      const status = (meta.status || '').toLowerCase();
      c = {
        ...raw, instituteName: meta.name || raw.name, status: meta.status || '',
        isGov: status.includes('government'), isAuto: status.includes('autonomous'),
        isMinority: status.includes('minority'), minorityType: extractMinority(meta.status || ''),
        isAided: status.includes('aided')
      };
    }
  }

  if (c) {
    if (!prefList.some(p => p.code === c.code && p.branch === c.branch)) {
      prefList.push({ ...c });
      pbToast('Added to preference list');
      renderPrefList(); renderAspirational(); renderSuggestions();
      // Update manual search UIs if visible
      if (document.getElementById('manualSearchInput')) searchManualColleges();
      if (document.getElementById('manualSearchInputList')) searchManualCollegesList();
      triggerAutosave();
    } else {
      pbToast('Already in list');
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
  const region = document.getElementById('inRegion').value || 'All Regions';

  // Header
  doc.setFontSize(22);
  doc.setTextColor(220, 38, 38); // Brand Red
  doc.text('College Simplified', 14, 22);
  
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39); // Ink
  doc.text('MHT-CET Preference List 2026', 14, 32);
  
  // Candidate Info
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128); // Muted
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 42);
  
  doc.autoTable({
    startY: 48,
    head: [['Field', 'Details']],
    body: [
      ['Percentile', pct + '%'],
      ['Merit Rank', rank],
      ['Category', cat],
      ['Region Preference', region]
    ],
    theme: 'plain',
    headStyles: { fillColor: [249, 250, 251], textColor: [107, 114, 128], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 }
  });

  // Preference Table
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('Your Preference Order', 14, doc.lastAutoTable.finalY + 15);

  const tableData = prefList.map((c, i) => [
    i + 1,
    c.instituteName || c.name,
    c.branch,
    c.code,
    c.percentile.toFixed(2) + '%'
  ]);

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 20,
    head: [['#', 'Institute Name', 'Branch', 'Code', 'Cutoff']],
    body: tableData,
    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 90 },
      2: { cellWidth: 50 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 }
    }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${i} of ${pageCount} — Created with College Simplified`, 14, doc.internal.pageSize.height - 10);
  }

  doc.save(`MHTCET_Preferences_${rank || 'List'}.pdf`);
  pbToast('PDF Generated Successfully!');
}
function switchSideTab(tab) {
  document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.sidebar-content').forEach(c => c.classList.toggle('active', c.id === 'side-' + tab));
}

/* ══════ UTILS ══════ */
function escH(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function pbToast(msg) {
  let t = document.getElementById('pbToast');
  if (!t) { t = document.createElement('div'); t.id = 'pbToast'; t.className = 'pb-toast'; document.body.appendChild(t) }
  t.textContent = msg; t.style.display = 'flex';
  clearTimeout(t._tid); t._tid = setTimeout(() => t.style.display = 'none', 3000);
}

/* ══════ PREF DATA SAVE/LOAD ══════ */
// Duplicate functions removed and moved to top or merged.

// ── Dashboard Data Loader ──
async function loadSavedPrefData() {
  if (!currentUserId) return;
  const res = await authApi('getPrefData', { userId: currentUserId });
  if (res.ok && res.data) {
    prefDataLoaded = true;
    prefEditCount = res.data.editCount || 0;
    prefLocked = prefEditCount >= 3;
    allForms = res.data.forms || [];

    // Pre-fill fields from the most recent form for convenience
    if (allForms.length > 0) {
      const latest = allForms[0];
      document.getElementById('inPct').value = latest.percentile || '';
      document.getElementById('inRank').value = latest.rank || '';
      if (latest.category) document.getElementById('inCategory').value = latest.category;
      if (latest.region) document.getElementById('inRegion').value = latest.region;
    }

    renderEditStatus();
    
    // Show Dashboard
    const dashSec = document.getElementById('dashboardDrafts');
    const dashList = document.getElementById('dashboardDraftsList');
    if (dashSec && dashList) {
      if (allForms.length > 0) {
        dashSec.style.display = 'block';
        dashList.innerHTML = allForms.map(form => {
          const date = form.updatedAt ? new Date(form.updatedAt.toDate ? form.updatedAt.toDate() : form.updatedAt).toLocaleDateString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : 'Recently';
          return `<div class="col-card dashboard-form-card" style="text-align: left; border: 1px solid var(--stroke); padding: 20px; cursor: default; margin-bottom: 12px">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px">
              <div>
                <div style="font-weight: 800; color: var(--brand); font-size: 17px">Preference List</div>
                <div style="font-size: 11px; color: var(--muted); margin-top: 2px; display: flex; align-items: center; gap: 4px">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  ${date}
                </div>
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
                <span style="font-weight: 800; color: var(--ink)">${form.percentile || '??'}% Percentile</span>
                <span style="font-weight: 700; color: var(--brand); font-size: 11px">Strategy: ${form.colType || 'All Colleges'}</span>
              </div>
              <div style="font-size: 12px; font-weight: 600; color: var(--ink2); padding-top: 8px; border-top: 1px dashed var(--stroke); display: flex; justify-content: space-between">
                <span>Category: ${
                  form.category === 'OBC' ? 'Other Backward Class' :
                  form.category === 'SC' ? 'Scheduled Caste' :
                  form.category === 'ST' ? 'Scheduled Tribe' :
                  form.category === 'VJ/DT' ? 'VJ / DT / NT-A' :
                  form.category === 'EWS' ? 'EWS Section' :
                  form.category === 'TFWS' ? 'TFWS Scheme' :
                  form.category || 'Open Category'
                }</span>
                ${form.minority ? `<span style="color:var(--gold)">${form.minority} Minority</span>` : ''}
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
  if (!wrap) return;
  const remaining = 3 - prefEditCount;

  if (prefLocked) {
    wrap.innerHTML = `<div class="edit-status locked">
      <div class="edit-status-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
      <div class="edit-status-text">
        <strong>Edit Limit Reached (3/3)</strong>
        <span>All edits used. Request admin to unlock your profile.</span>
      </div>
      <button class="pb-btn pb-btn-report" onclick="openReportModal()">
        Report to Admin
      </button>
    </div>`;
  } else if (prefDataLoaded) {
    const cls = remaining <= 1 ? 'critical' : remaining <= 2 ? 'warning' : 'ok';
    wrap.innerHTML = `<div class="edit-status ${cls}">
      <div class="edit-status-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
      <div class="edit-status-text">
        <strong>Profile Saved (Edited ${prefEditCount}/3 times)</strong>
        <span>${remaining} edit${remaining !== 1 ? 's' : ''} remaining. ${remaining === 1 ? '<b>[Warning: Last chance!]</b>' : ''}</span>
      </div>
      <button class="pb-btn pb-btn-edit" onclick="enableEditing()" id="enableEditBtn">
        Edit Profile
      </button>
    </div>`;
    lockProfileFields();
  } else {
    wrap.innerHTML = `<div class="edit-status info">
      <div class="edit-status-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>
      <div class="edit-status-text">
        <strong>New Profile (0/3 Edits)</strong>
        <span>Fill your CET details to start. You get 3 edits total.</span>
      </div>
    </div>`;
    unlockProfileFields(); // Allow first time filling
    let saveWrap = document.getElementById('saveProfileWrap');
    if (saveWrap) saveWrap.style.display = 'flex';
  }
}

function lockProfileFields() {
  ['inPct', 'inRank'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = true; el.style.opacity = '0.6'; el.style.cursor = 'not-allowed'; }
  });
}

function unlockProfileFields() {
  ['inPct', 'inRank'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = false; el.style.opacity = '1'; el.style.cursor = ''; }
  });
}

function enableEditing() {
  const remaining = 3 - prefEditCount;
  if (remaining <= 0) { pbToast('No edits remaining'); return; }

  const msg = remaining === 1 ?
    '⚠️ WARNING: This is your LAST edit! After saving, you will be locked out. Are you sure?' :
    `You have used ${prefEditCount}/3 edits. Are you sure you want to use another edit?`;

  if (!confirm(msg)) return;

  unlockProfileFields();
  // Show save button
  let saveWrap = document.getElementById('saveProfileWrap');
  if (saveWrap) saveWrap.style.display = 'flex';
  document.getElementById('editStatusWrap').style.opacity = '0.4'; // Dim status while editing
}

async function saveProfileData() {
  if (!validateStep1()) return;
  const pct = document.getElementById('inPct').value;
  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;
  const region = document.getElementById('inRegion').value;
  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
  const res = await authApi('savePrefData', { 
    userId: currentUserId, 
    formId: currentFormId,
    percentile: pct, 
    rank: rank, 
    category: cat, 
    region: region,
    prefList: prefList,
    incrementEdit: true 
  });
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save & Lock'; }
  if (res.ok) {
    if (res.data.formId) currentFormId = res.data.formId;
    prefEditCount = res.data.editCount;
    prefDataLoaded = true;
    prefLocked = prefEditCount >= 3;
    document.getElementById('editStatusWrap').style.opacity = '1';
    renderEditStatus();
    lockProfileFields();
    let saveWrap = document.getElementById('saveProfileWrap');
    if (saveWrap) saveWrap.style.display = 'none';
    pbToast('Profile saved! ' + (3 - prefEditCount) + ' edits remaining.');
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
  const msg = (document.getElementById('reportMessage').value || '').trim() || 'Please unlock my preference list edits.';
  const btn = document.getElementById('submitReportBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  const res = await authApi('submitEditRequest', { userId: currentUserId, userName: user.name, userEmail: user.email, message: msg });
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
  const session = initAuth({ requireLogin: true, toolContainerId: 'toolArea' });
  if (!session) return;
  const user = getSession();
  if (user && user.role !== 'admin' && user.role !== 'premium') {
    document.getElementById('toolArea').innerHTML = `<div style="text-align:center;padding:100px 20px">
      <div style="color:var(--gold);margin-bottom:20px"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
      <h2 style="font-family:Lexend,sans-serif;font-weight:800;font-size:28px;margin-bottom:12px">Premium Feature</h2>
      <p style="color:var(--muted);max-width:420px;margin:0 auto 32px;line-height:1.6">The Preference List Builder is available exclusively for Premium members. Upgrade to unlock smart counselling tools.</p>
      <a href="index.html" style="display:inline-flex;align-items:center;gap:10px;padding:16px 32px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#78350f;text-decoration:none;border-radius:14px;font-weight:800">Upgrade to Premium →</a>
    </div>`;
    return;
  }
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
window.exportPDF = exportPDF; window.switchSideTab = switchSideTab;
window.deleteForm = deleteForm;
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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

