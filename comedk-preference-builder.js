'use strict';

/* ══════ STATE ══════ */
let allData = [], selectedBranches = new Set(), matchedColleges = [], selectedColleges = [], prefList = [], allBranchNames = [];
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
  'Computer & IT': ['COMPUTER', 'INFORMATION', 'DATA SCIENCE', 'ARTIFICIAL', 'MACHINE LEARNING', 'SOFTWARE', 'CYBER', 'DEVOPS', 'BIG DATA', 'BLOCK CHAIN', 'IOT', 'INTERNET OF THINGS', 'CLOUD'],
  'Electronics & Telecom': ['ELECTRONICS', 'TELECOMMUNICATION', 'ELECTRICAL', 'VLSI', 'COMMUNICATION', 'INSTRUMENTATION'],
  'Core Engineering': ['MECHANICAL', 'CIVIL', 'ELECTRICAL', 'CHEMICAL', 'PRODUCTION', 'METALLURGY', 'AUTOMOBILE', 'TEXTILE', 'MINING', 'AERONAUTICAL', 'AGRICULTURAL', 'AUTOMATION', 'AEROSPACE', 'AUTOMOBILE', 'AUTOMOTIVE', 'DESIGN', 'PLANNING', 'CONSTRUCTION', 'MARINE', 'MECHATRONICS', 'ROBOTICS', 'MANUFACTURING', 'INDUSTRIAL', 'POLYMER'],
  'Biotech & Allied': ['BIOTECHNOLOGY', 'BIO-MEDIA', 'BIO MEDICAL', 'FOOD', 'AGRICULTURE', 'PHARMACEUTICAL', 'MEDICAL ELECTRONICS'],
  'Other Branches': []
};

const FIXED_ASPIRATIONAL = [];

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
        const idx = matchedColleges.findIndex(c => (c.code + '|' + c.branch) === key);
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

  if (isAdmin && !currentStudentInfo) {
    showStudentModal();
    return;
  }

  currentFormId = null;
  prefList = [...FIXED_ASPIRATIONAL];
  selectedColleges = [];
  selectedBranches = new Set();
  
  document.getElementById('inRank').value = '';
  document.getElementById('inCategory').value = 'GM';

  // Auto select all branches by default
  allBranchNames.forEach(b => selectedBranches.add(b));
  
  renderBranches();
  renderEditStatus();
  goStep(1);
}

function loadForm(formId, step = 1) {
  const form = allForms.find(f => f.id === formId);
  if (!form) return;
  currentFormId = formId;
  currentStudentInfo = form.studentInfo || null;
  
  document.getElementById('inCategory').value = form.category || 'GM';
  document.getElementById('inRank').value = form.rank || '';

  prefList = form.prefList || [];
  selectedBranches = new Set(form.selectedBranches || []);
  window._tempKeys = form.selectedCollegeKeys || [];

  renderBranches();
  renderEditStatus();

  window._isLoadingForm = true;
  const targetStep = step || form.currentStep || 1;
  goStep(targetStep);
  window._isLoadingForm = false;
}

async function deleteForm(formId) {
  if (!confirm('Are you sure you want to delete this preference list? This action cannot be undone.')) return;
  const res = await authApi('deleteComedkPrefForm', { userId: currentUserId, formId });
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
  
  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;

  const res = await authApi('saveComedkPrefData', {
    userId: currentUserId,
    formId: currentFormId,
    rank: rank,
    category: cat,
    prefList: prefList,
    selectedBranches: Array.from(selectedBranches),
    selectedCollegeKeys: selectedColleges.map(idx => matchedColleges[idx] ? matchedColleges[idx].code + '|' + matchedColleges[idx].branch : '').filter(Boolean),
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

function validateStep1() {
  const r = document.getElementById('inRank').value.trim();

  if (!r || isNaN(parseInt(r))) {
    pbToast('Please enter your COMEDK UGET Rank');
    return false;
  }
  return true;
}

/* ══════ DATA LOADING ══════ */
async function loadData() {
  const loader = document.getElementById('dataLoader');
  try {
    loader.innerHTML = '<div class="pb-spinner"></div><span>Loading COMEDK Round 1 cutoff data...</span>';
    
    const [res1, res2] = await Promise.all([
      fetch('COMEDK/COMEDK_GM_CUTOFF.json'),
      fetch('COMEDK/COMEDK_KKR_CUTOFF.json')
    ]);
    const j1 = await res1.json();
    const j2 = await res2.json();

    const rawGM = j1['COMEDK_GM_CUTOFF'] || [];
    const rawKKR = j2['COMEDK_KKR_CUTOFF'] || [];

    const gmParsed = rawGM.map(r => parseRow(r, 'GM'));
    const kkrParsed = rawKKR.map(r => parseRow(r, 'KKR'));

    allData = [...gmParsed, ...kkrParsed].filter(Boolean);

    const bSet = new Set();
    allData.forEach(r => { if (r.branch) bSet.add(r.branch) });
    allBranchNames = Array.from(bSet).sort();

    renderBranches();
    loader.style.display = 'none';
    document.getElementById('predictBtn').disabled = false;
  } catch (e) {
    console.error(e);
    loader.innerHTML = '<span style="color:var(--brand)">Failed to load data. Please refresh.</span>';
  }
}

function parseRow(r, cat) {
  const rawCollege = r['College'] || '';
  if (!rawCollege) return null;
  const rawParts = rawCollege.split('\n');
  const collegeName = rawParts[0].replace(/\s+/g, ' ').trim();
  const branch = (r['Branch'] || '').trim();
  if (!collegeName || !branch) return null;

  // Round 1 Rank
  const r1Str = r['Round 1'] || '';
  if (!r1Str || r1Str === '–' || r1Str === '-') return null;
  const r1Rank = parseInt(r1Str.replace(/,/g, ''), 10);
  if (isNaN(r1Rank)) return null;

  return {
    code: collegeName.slice(0, 4), // Simple placeholder code or first 4 chars
    name: collegeName,
    branch: branch,
    rank: r1Rank,
    category: cat
  };
}

/* ══════ BRANCH RENDERING ══════ */
function categorizeBranch(b) {
  const u = b.toUpperCase();
  for (const [cat, kws] of Object.entries(CATS)) {
    if (cat === 'Other Branches') continue;
    if (kws.some(k => u.includes(k))) return cat;
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
  row.innerHTML = Array.from(selectedBranches).map(b => `<span class="bchip">${b.split('(')[0].trim()}<span class="bchip-x" onclick="toggleBranch('${b.replace(/'/g, "\\'")}')">×</span></span>`).join('');
}

/* ══════ COMEDK COLLEGE MATCHING (Step 3) ══════ */
function generateMatches() {
  const userRank = parseInt(document.getElementById('inRank').value) || 999999;
  const cat = document.getElementById('inCategory').value;

  // Filter cutoff records
  let filtered = allData.filter(r => {
    // 1. Category check
    if (r.category !== cat) return false;

    // 2. Branch check
    if (!selectedBranches.has(r.branch)) return false;

    return true;
  });

  // Group by institute name + branch, keep the one with best cutoff rank
  const groups = {};
  filtered.forEach(r => {
    const key = r.name + '|' + r.branch;
    if (!groups[key] || r.rank < groups[key].rank) groups[key] = r;
  });
  let results = Object.values(groups);

  // Map to enriched options
  results = results.map(r => {
    // Aspirational flag (cutoff rank is lower than user's, making it harder to get)
    const isAsp = r.rank < userRank;

    return {
      ...r,
      instituteName: r.name,
      status: r.category,
      isAspirational: isAsp
    };
  });

  // Sort: Reachable (user cutoff is >= college cutoff) vs Aspirational
  // Reachable: rank desc (higher rank shown first)
  const reachable = results.filter(r => !r.isAspirational).sort((a, b) => b.rank - a.rank).slice(0, 40);
  const aspirational = results.filter(r => r.isAspirational).sort((a, b) => a.rank - b.rank).slice(0, 6);

  matchedColleges = [...aspirational, ...reachable];

  // Build suggestion pool
  suggestionPool = results.filter(r => {
    return !matchedColleges.some(m => m.name === r.name && m.branch === r.branch);
  }).sort((a, b) => b.rank - a.rank);

  // Auto select all (limit to 10 for guest/standard)
  const userSession = getSession();
  const isPremium = userSession && (userSession.role === 'premium' || userSession.role === 'admin');
  selectedColleges = isPremium 
    ? matchedColleges.map((_, i) => i) 
    : matchedColleges.slice(0, 10).map((_, i) => i);

  renderColleges();
}

function renderColleges(filter = 'all') {
  const grid = document.getElementById('collegeGrid');
  const countEl = document.getElementById('matchCount');
  let items = matchedColleges;

  if (filter === 'aspirational') items = matchedColleges.filter(r => r.isAspirational);
  else if (filter === 'reachable') items = matchedColleges.filter(r => !r.isAspirational);

  const userSession = getSession();
  const isPremium = userSession && (userSession.role === 'premium' || userSession.role === 'admin');
  const displayItems = isPremium ? items : items.slice(0, 13);

  countEl.textContent = items.length + ' colleges found (' + selectedColleges.length + ' selected)';

  if (!displayItems.length) {
    grid.innerHTML = `<div class="empty-state"><h3>No Matches</h3><p>Adjust your score or branches.</p></div>`;
    return;
  }

  grid.innerHTML = displayItems.map((c, idx) => {
    const isLocked = !isPremium && idx >= 10;
    if (isLocked) {
      return `<div class="col-card locked" style="cursor: default; opacity: 0.7; pointer-events: none; position: relative;">
        <div class="col-chk">🔒</div>
        <div class="col-name" style="filter: blur(4px); user-select: none;">••••••••••••••••••••••••••••••••••••</div>
        <div class="col-meta" style="filter: blur(3px); user-select: none;">
          <span class="col-tag">•••••</span>
        </div>
        <div class="col-pct" style="filter: blur(3.5px); user-select: none;"><strong>Rank: ••••</strong> <small>Category: ••</small></div>
      </div>`;
    }

    const realIdx = matchedColleges.indexOf(c);
    const sel = selectedColleges.includes(realIdx);
    const asp = c.isAspirational ? 'aspirational' : '';

    return `<div class="col-card ${sel ? 'selected' : ''} ${asp}" onclick="toggleCollege(${realIdx})">
      <div class="col-chk">${sel ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
      <div class="col-name">${escH(c.instituteName)}</div>
      <div class="col-meta">
        <span class="col-tag branch-tag">${escH(c.branch)}</span>
      </div>
      <div class="col-pct"><strong>Rank: ${c.rank.toLocaleString()}</strong> <small>Category: ${c.category}</small></div>
    </div>`;
  }).join('');

  if (!isPremium && items.length > 10) {
    grid.innerHTML += `
      <div class="lock-paywall-card" style="grid-column: 1 / -1; margin-top: 16px; width: 100%;">
        <div class="lock-icon-container">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h3>Unlock All Matching Colleges</h3>
        <p>Purchase any one course to view and select from all matches in your list.</p>
        <a href="https://www.conceptsimplified.in/courses" target="_blank" class="unlock-btn">Unlock All Choices</a>
      </div>
    `;
  }
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
  const userSelected = matchedColleges.filter((c, i) => selectedColleges.includes(i));
  
  // Sort user selected by rank asc (lower rank / more competitive first)
  userSelected.sort((a, b) => a.rank - b.rank);

  const combined = [...FIXED_ASPIRATIONAL, ...userSelected];
  const seen = new Set();
  prefList = combined.filter(c => {
    const key = c.name + '|' + c.branch;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  renderPrefList();
  renderSuggestions();
  renderAspirational();
}

function renderPrefList() {
  const list = document.getElementById('prefListTbody');
  const count = document.getElementById('prefCount');
  if (!count) return;
  count.textContent = prefList.length + ' colleges';

  const tableWrap = document.querySelector('.final-list-table-wrap');
  if (tableWrap) {
    const existing = tableWrap.querySelector('.lock-paywall-card');
    if (existing) existing.remove();
  }

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

  const userSession = getSession();
  const isPremium = userSession && (userSession.role === 'premium' || userSession.role === 'admin');
  const displayPref = isPremium ? prefList : prefList.slice(0, 13);

  list.innerHTML = displayPref.map((c, i) => {
    const isLocked = !isPremium && i >= 10;
    if (isLocked) {
      return `
        <tr class="pref-item locked-row" draggable="false" data-idx="${i}" style="cursor: default;">
          <td class="pref-grip" style="text-align: center; width: 40px; vertical-align: middle">🔒</td>
          <td class="pref-num" style="text-align: center; font-weight: 800; width: 60px; vertical-align: middle">${i + 1}</td>
          <td class="pref-name" style="font-weight: 600; color: var(--ink); vertical-align: middle"><span style="filter: blur(4px); opacity: 0.5;">••••••••••••••••••••••••••••••••••••</span></td>
          <td style="vertical-align: middle"><span style="filter: blur(4px); opacity: 0.5;">••••••••••••••••••••</span></td>
          <td style="vertical-align: middle"><span style="filter: blur(4.5px); opacity: 0.5;">••••</span></td>
          <td class="excel-td-pct" style="vertical-align: middle"><strong style="filter: blur(2.5px); opacity: 0.5;">Rank: ••••</strong></td>
          <td style="text-align: center; width: 70px; vertical-align: middle">🔒</td>
        </tr>
      `;
    }

    const isFixed = c.isFixed;
    const badges = [];
    if (c.isAspirational) {
      badges.push('<span class="pref-code asp-badge" style="background:#fff7ed; color:#ea580c; border:1px solid rgba(234, 88, 12, 0.15); font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding: 2px 8px; border-radius: 6px">Aspirational</span>');
    }
    if (isFixed) {
      badges.push('<span class="pref-code fixed-badge" style="background:var(--brand-soft); color:var(--brand); border:1px solid var(--brand-ring); font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding: 2px 8px; border-radius: 6px">Mandatory</span>');
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
        <td class="pref-name" style="font-weight: 600; color: var(--ink); vertical-align: middle" title="${escH(c.instituteName || c.name)}">${escH(c.instituteName || c.name)}</td>
        <td style="vertical-align: middle" title="${escH(c.branch)}">${escH(c.branch)}</td>
        <td style="vertical-align: middle">
          <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center">
            <span class="col-tag auto" style="font-size: 9px; padding: 2px 8px">${escH(c.category)}</span>
            ${badges.join('')}
          </div>
        </td>
        <td class="excel-td-pct" style="vertical-align: middle"><strong>Rank: ${c.rank ? c.rank.toLocaleString() : 'N/A'}</strong></td>
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

  if (!isPremium && prefList.length > 10) {
    if (tableWrap) {
      const paywallHtml = `
        <div class="lock-paywall-card" style="margin: 16px; border: 1px dashed var(--brand);">
          <div class="lock-icon-container">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h3>Unlock Full Preference List</h3>
          <p>Purchase any one course to organize, sort, and export a complete preference list.</p>
          <a href="https://www.conceptsimplified.in/courses" target="_blank" class="unlock-btn">Unlock All Choices</a>
        </div>
      `;
      tableWrap.insertAdjacentHTML('beforeend', paywallHtml);
    }
  }
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

/* ══════ ASPIRATIONAL TAB ══════ */
function renderAspirational() {
  const grid = document.getElementById('aspGrid');
  const suggGrid = document.getElementById('aspSuggestions');
  if (!grid) return;
  const userRank = parseInt(document.getElementById('inRank').value) || 999999;

  const allAsp = prefList.filter(c => c.isAspirational);
  grid.innerHTML = allAsp.map(c => {
    return `<div class="col-card selected aspirational" onclick="toggleAspirational('${c.name.replace(/'/g, "\\'")}','${c.branch.replace(/'/g, "\\'")}')">
      <div class="col-chk"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="col-name">${escH(c.instituteName)}</div>
      <div class="col-meta"><span class="col-tag branch-tag">${escH(c.branch)}</span></div>
      <div class="col-pct"><strong>Rank: ${c.rank.toLocaleString()}</strong> <small>Category: ${c.category}</small></div>
    </div>`;
  }).join('');

  if (!allAsp.length) grid.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No aspirational colleges added</div>';

  if (suggGrid) {
    const inPref = new Set(prefList.map(p => p.name + '|' + p.branch));
    const pool = suggestionPool.filter(c => !inPref.has(c.name + '|' + c.branch) && c.rank < userRank).slice(0, 8);
    suggGrid.innerHTML = pool.map(c => `<div class="col-card aspirational" onclick="toggleAspirational('${c.name.replace(/'/g, "\\'")}','${c.branch.replace(/'/g, "\\'")}')">
      <div class="col-chk"></div>
      <div class="col-name">${escH(c.instituteName)}</div>
      <div class="col-meta"><span class="col-tag">${escH(c.branch)}</span></div>
      <div class="col-pct">Rank: ${c.rank.toLocaleString()}<small>Category: ${c.category}</small></div>
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

    let filtered = allData.filter(r => {
      if (!r.name.toLowerCase().includes(query) && !r.branch.toLowerCase().includes(query)) return false;
      return true;
    });

    const groups = {};
    filtered.forEach(r => {
      const key = r.name + '|' + r.branch;
      if (!groups[key] || r.rank < groups[key].rank) groups[key] = r;
    });
    let results = Object.values(groups).map(r => {
      return {
        ...r, instituteName: r.name
      };
    });

    results.sort((a, b) => a.rank - b.rank);
    const sliced = results.slice(0, 15);

    if (!sliced.length) { resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No colleges found</div>'; return; }

    const inPref = new Set(prefList.map(p => p.name + '|' + p.branch));

    resDiv.innerHTML = sliced.map(r => {
      const isSel = inPref.has(r.name + '|' + r.branch);

      return `<div class="col-card ${isSel ? 'selected' : ''}" style="margin-bottom:12px; cursor: default">
        <div class="col-name" style="padding-right:50px">${escH(r.instituteName)}</div>
        <div class="col-meta">
          <span class="col-tag branch-tag">${escH(r.branch)}</span>
        </div>
        <div class="col-pct"><strong>Rank: ${r.rank.toLocaleString()}</strong> <small>Category: ${r.category}</small></div>
        <button class="pb-btn pb-btn-primary" onclick="handleAddSuggestion('${r.name.replace(/'/g, "\\'")}','${r.branch.replace(/'/g, "\\'")}', true)" style="position:absolute; right:12px; top:12px; width:34px; height:34px; padding:0; border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow: none">
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

    let filtered = allData.filter(r => {
      if (!r.name.toLowerCase().includes(query) && !r.branch.toLowerCase().includes(query)) return false;
      return true;
    });

    const groups = {};
    filtered.forEach(r => {
      const key = r.name + '|' + r.branch;
      if (!groups[key] || r.rank < groups[key].rank) groups[key] = r;
    });
    let results = Object.values(groups).map(r => {
      return {
        ...r, instituteName: r.name
      };
    });

    results.sort((a, b) => a.rank - b.rank);
    const sliced = results.slice(0, 15);

    if (!sliced.length) { resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No colleges found</div>'; return; }

    const inPref = new Set(prefList.map(p => p.name + '|' + p.branch));

    resDiv.innerHTML = sliced.map(r => {
      const isSel = inPref.has(r.name + '|' + r.branch);

      return `<div class="col-card ${isSel ? 'selected' : ''}" style="margin-bottom:12px; cursor: default">
        <div class="col-name" style="padding-right:50px">${escH(r.instituteName)}</div>
        <div class="col-meta">
          <span class="col-tag branch-tag">${escH(r.branch)}</span>
        </div>
        <div class="col-pct"><strong>Rank: ${r.rank.toLocaleString()}</strong> <small>Category: ${r.category}</small></div>
        <button class="pb-btn pb-btn-primary" onclick="handleAddSuggestion('${r.name.replace(/'/g, "\\'")}','${r.branch.replace(/'/g, "\\'")}')" style="position:absolute; right:12px; top:12px; width:34px; height:34px; padding:0; border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow: none">
          ${isSel ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'}
        </button>
      </div>`;
    }).join('');
  }, 300);
}

function sortPrefList() {
  const fixed = prefList.filter(c => c.isFixed);
  const others = prefList.filter(c => !c.isFixed);
  others.sort((a, b) => a.rank - b.rank);
  prefList = [...fixed, ...others];
  renderPrefList();
  pbToast('List sorted by cutoff rank');
}

function toggleAspirational(name, branch) {
  const idx = prefList.findIndex(p => p.name === name && p.branch === branch);
  if (idx >= 0) {
    if (prefList[idx].isFixed) return pbToast('Cannot remove fixed college');
    prefList.splice(idx, 1);
    pbToast('Removed from preference list');
  } else {
    let c = [...matchedColleges, ...suggestionPool].find(r => r.name === name && r.branch === branch);
    if (!c) {
      const raw = allData.find(r => r.name === name && r.branch === branch);
      if (raw) {
        c = {
          ...raw, instituteName: raw.name
        };
      }
    }
    if (c) {
      const copy = { ...c, isAspirational: true };
      const lastFixedIdx = prefList.reduce((acc, item, i) => item.isFixed ? i : acc, -1);
      prefList.splice(lastFixedIdx + 1, 0, copy);
      pbToast('Added to preference list');
    }
  }
  renderPrefList(); renderAspirational(); renderSuggestions();
  triggerAutosave();
}

function handleAddSuggestion(name, branch, isAspirational = false) {
  let c = [...matchedColleges, ...suggestionPool].find(r => r.name === name && r.branch === branch);

  if (!c) {
    const raw = allData.find(r => r.name === name && r.branch === branch);
    if (raw) {
      c = {
        ...raw, instituteName: raw.name
      };
    }
  }

  if (c) {
    const idx = prefList.findIndex(p => p.name === c.name && p.branch === c.branch);
    if (idx < 0) {
      const copy = { ...c };
      if (isAspirational) {
        copy.isAspirational = true;
      }
      if (copy.isAspirational) {
        const lastFixedIdx = prefList.reduce((acc, item, i) => item.isFixed ? i : acc, -1);
        prefList.splice(lastFixedIdx + 1, 0, copy);
      } else {
        prefList.push(copy);
      }
      pbToast('Added to preference list');
      renderPrefList(); renderAspirational(); renderSuggestions();
      if (document.getElementById('manualSearchInput')) searchManualColleges();
      if (document.getElementById('manualSearchInputList')) searchManualCollegesList();
      triggerAutosave();
    } else {
      if (prefList[idx].isFixed) return pbToast('Cannot remove fixed college');
      prefList.splice(idx, 1);
      pbToast('Removed from preference list');
      renderPrefList(); renderAspirational(); renderSuggestions();
      if (document.getElementById('manualSearchInput')) searchManualColleges();
      if (document.getElementById('manualSearchInputList')) searchManualCollegesList();
      triggerAutosave();
    }
  }
}

/* ══════ SUGGESTIONS ══════ */
function renderSuggestions() {
  const panel = document.getElementById('suggList');
  if (!panel) return;
  const prefCodes = new Set(prefList.map(c => c.name + '|' + c.branch));

  const currentMatches = matchedColleges.filter(c => !prefCodes.has(c.name + '|' + c.branch));
  const poolMatches = suggestionPool.filter(c => !prefCodes.has(c.name + '|' + c.branch));
  const suggs = [...currentMatches, ...poolMatches].slice(0, 12);

  if (!suggs.length) { panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No more suggestions</div>'; return }

  panel.innerHTML = suggs.map(c => `<div class="sugg-item">
    <div class="sugg-info">
      <div class="sugg-name">${escH(c.instituteName)}</div>
      <div class="sugg-sub">${escH(c.branch)} | Rank: ${c.rank.toLocaleString()}</div>
    </div>
    <button class="sugg-add" onclick="handleAddSuggestion('${c.name.replace(/'/g, "\\")}','${c.branch.replace(/'/g, "\\")}')">+ Add</button>
  </div>`).join('');
}

/* ══════ COMEDK FIRESTORE INTEGRATION ══════ */
async function loadSavedPrefData() {
  if (!currentUserId) return;
  const res = await authApi('getComedkPrefData', { userId: currentUserId });
  if (res.ok && res.data) {
    prefDataLoaded = true;
    prefEditCount = res.data.editCount || 0;
    const user = getSession();
    const isAdmin = user && user.role === 'admin';
    prefLocked = !isAdmin && prefEditCount >= 3;
    allForms = res.data.forms || [];

    if (allForms.length > 0) {
      const latest = allForms[0];
      document.getElementById('inCategory').value = latest.category || 'GM';
      document.getElementById('inRank').value = latest.rank || '';
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
                <div style="font-weight: 800; color: var(--brand); font-size: 17px">COMEDK Choice List</div>
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
                <span style="font-weight: 800; color: var(--ink)">Rank: ${form.rank ? form.rank.toLocaleString() : '??'}</span>
                <span style="font-weight: 700; color: var(--brand); font-size: 11px">Category: ${form.category || 'GM'}</span>
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

function unlockProfileFields() {
  const el = document.getElementById('inRank');
  if (el) { el.disabled = false; el.style.opacity = '1'; }
}

async function saveProfileData() {
  if (!validateStep1()) return;
  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;

  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  const res = await authApi('saveComedkPrefData', { 
    userId: currentUserId, 
    formId: currentFormId,
    rank: rank, 
    category: cat,
    prefList: prefList,
    incrementEdit: true 
  });
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save & Lock'; }

  if (res.ok) {
    if (res.data.formId) currentFormId = res.data.formId;
    prefEditCount = res.data.editCount;
    prefDataLoaded = true;
    pbToast('Profile saved!');
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
  const msg = (document.getElementById('reportMessage').value || '').trim() || 'Please unlock my COMEDK preference list edits.';
  const btn = document.getElementById('submitReportBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  const res = await authApi('submitEditRequest', { userId: currentUserId, userName: user.name, userEmail: user.email, message: msg, tool: 'comedk-pref-builder' });
  if (btn) { btn.disabled = false; btn.textContent = 'Send Request'; }
  if (res.ok) {
    pbToast('Request sent! Admin will review it shortly.');
    closeReportModal();
  } else {
    pbToast(res.error || 'Failed to send request');
  }
}

/* ══════ PDF EXPORT ══════ */
function exportPDF() {
  if (!prefList.length) return pbToast('List is empty');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(220, 38, 38);
  doc.text('College', 14, 20);

  doc.setFont("Helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  const brandWidth = doc.getTextWidth('College ');
  doc.text('Simplified', 14 + brandWidth, 20);

  doc.setFontSize(14);
  doc.text('COMEDK Option Form Choice Report', 14, 28);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`COMEDK Rank: ${rank || 'N/A'} | Category: ${cat}`, 14, 34);

  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(1);
  doc.line(14, 38, 196, 38);

  const user = getSession();
  const isPremium = user && (user.role === 'premium' || user.role === 'admin');
  const itemsToExport = isPremium ? prefList : prefList.slice(0, 10);

  const tableData = itemsToExport.map((c, i) => [
    i + 1,
    c.instituteName || c.name,
    c.branch,
    c.category,
    c.rank ? c.rank.toLocaleString() : 'N/A'
  ]);

  if (!isPremium && prefList.length > 10) {
    tableData.push([
      '•',
      '🔒 Upgrade to Premium Counselling to unlock remaining options',
      'www.conceptsimplified.in/courses',
      'LOCKED',
      '—'
    ]);
  }

  doc.autoTable({
    startY: 48,
    head: [['#', 'Institute Name', 'Branch', 'Category', 'Cutoff Rank (R1)']],
    body: tableData,
    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    styles: { fontSize: 9 }
  });

  doc.save(`COMEDK_Preferences_${rank || 'List'}.pdf`);
  pbToast('PDF Generated Successfully!');
}

/* ══════ EXCEL EXPORT ══════ */
function exportExcel() {
  if (!prefList.length) return pbToast('List is empty');
  const user = getSession();
  const isPremium = user && (user.role === 'premium' || user.role === 'admin');
  const itemsToExport = isPremium ? prefList : prefList.slice(0, 10);

  const wsData = [
    ['Choice Number', 'Institute Name', 'Branch Name', 'Category', 'Closing Cutoff Rank']
  ];
  itemsToExport.forEach((c, idx) => {
    wsData.push([
      idx + 1,
      c.instituteName || c.name,
      c.branch,
      c.category,
      c.rank || 'N/A'
    ]);
  });

  if (!isPremium && prefList.length > 10) {
    wsData.push([
      '•',
      '🔒 Upgrade to Premium Counselling to unlock remaining options',
      'www.conceptsimplified.in/courses',
      'LOCKED',
      '—'
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "COMEDK Preferences");
  XLSX.writeFile(wb, `COMEDK_Preferences_${Date.now()}.xlsx`);
  pbToast('Excel Generated Successfully!');
}

/* ══════ STUDENT DETAILS MODAL (Admin) ══════ */
function showStudentModal() {
  currentStudentInfo = null;
  const searchInput = document.getElementById('studentSearchInput');
  const resultsDiv = document.getElementById('studentSearchResults');
  const selectedCard = document.getElementById('studentSelectedCard');
  if (searchInput) searchInput.value = '';
  if (resultsDiv) resultsDiv.innerHTML = '';
  if (selectedCard) { selectedCard.style.display = 'none'; selectedCard.innerHTML = ''; }
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
    const q = (document.getElementById('studentSearchInput').value || '').toLowerCase().trim();
    const resultsDiv = document.getElementById('studentSearchResults');
    if (!q) { resultsDiv.innerHTML = ''; return; }
    
    resultsDiv.innerHTML = '<div class="pb-spinner" style="margin:10px auto"></div>';
    
    if (!cachedUsers) {
      const res = await authApi('getUsers');
      if (res.ok) cachedUsers = res.data || [];
      else { resultsDiv.innerHTML = '<div style="padding:10px;font-size:12px;color:red">Failed to load users</div>'; return; }
    }

    const filtered = cachedUsers.filter(u => 
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );

    if (filtered.length === 0) {
      resultsDiv.innerHTML = '<div style="padding:12px;font-size:12.5px;color:var(--muted)">No matching users found</div>';
      return;
    }

    resultsDiv.innerHTML = filtered.map(u => `
      <div class="student-search-item" onclick="selectExistingUser('${u.id}')" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--stroke); font-size:12.5px; font-weight:600; display:flex; flex-direction:column; gap:2px">
        <div style="color:var(--ink)">${escH(u.name)}</div>
        <div style="font-size:11px;color:var(--muted)">${escH(u.email)} · ${escH(u.phone)}</div>
      </div>
    `).join('');
  }, 250);
}

function selectExistingUser(userId) {
  if (!cachedUsers) return;
  const u = cachedUsers.find(x => x.id === userId);
  if (!u) return;
  currentStudentInfo = { name: u.name, email: u.email, phone: u.phone };
  
  const card = document.getElementById('studentSelectedCard');
  card.innerHTML = `
    <div style="font-size:12px;color:var(--brand);font-weight:800;text-transform:uppercase;margin-bottom:4px">Selected Student</div>
    <div style="font-weight:700;color:var(--ink)">${escH(u.name)}</div>
    <div style="font-size:11px;color:var(--ink2)">${escH(u.email)} · ${escH(u.phone)}</div>
  `;
  card.style.display = 'block';
  document.getElementById('studentSearchResults').innerHTML = '';
}

function submitStudentInfo() {
  const existingWrap = document.getElementById('studentExistingWrap');
  if (existingWrap.style.display === 'none') {
    const name = (document.getElementById('studentName').value || '').trim();
    const email = (document.getElementById('studentEmail').value || '').trim();
    const phone = (document.getElementById('studentPhone').value || '').trim();
    if (!name) return pbToast('Name is required');
    currentStudentInfo = { name, email, phone };
  } else {
    if (!currentStudentInfo) return pbToast('Please select a student from search');
  }
  closeStudentModal();
  currentFormId = null;
  prefList = [...FIXED_ASPIRATIONAL];
  selectedColleges = [];
  selectedBranches = new Set();
  
  document.getElementById('inRank').value = '';
  document.getElementById('inCategory').value = 'GM';

  renderEditStatus();
  goStep(1);
}

function switchSideTab(tab) {
  document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.sidebar-content').forEach(c => c.classList.toggle('active', c.id === 'side-' + tab));
}

/* ══════ UTILS ══════ */
function escH(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function escAttr(s) { return String(s || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;') }
function pbToast(msg) {
  let t = document.getElementById('pbToast');
  if (!t) { t = document.createElement('div'); t.id = 'pbToast'; t.className = 'pb-toast'; document.body.appendChild(t) }
  t.textContent = msg; t.style.display = 'flex';
  clearTimeout(t._tid); t._tid = setTimeout(() => t.style.display = 'none', 3000);
}

/* ══════ BOOT ══════ */
async function boot() {
  const session = initAuth({ requireLogin: true, toolContainerId: 'toolArea' });
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
window.saveProfileData = saveProfileData;
window.openReportModal = openReportModal; window.closeReportModal = closeReportModal;
window.submitEditRequest = submitEditRequest;
window.searchManualColleges = searchManualColleges;
window.searchManualCollegesList = searchManualCollegesList;
window.sortPrefList = sortPrefList;
window.handleTouchStart = handleTouchStart;
window.handleTouchMove = handleTouchMove;
window.handleTouchEnd = handleTouchEnd;
window.showStudentModal = showStudentModal;
window.closeStudentModal = closeStudentModal;
window.switchStudentMode = switchStudentMode;
window.searchExistingUsers = searchExistingUsers;
window.selectExistingUser = selectExistingUser;
window.submitStudentInfo = submitStudentInfo;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
