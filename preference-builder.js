'use strict';

/* ══════ STATE ══════ */
let cutoffData = [], jeeCutoffData = [], collegeMetadata = [], selectedBranches = new Set(), matchedColleges = [], selectedColleges = [], prefList = [], allBranchNames = [];
let prefEditCount = 0;
let prefLocked = false;
let prefDataLoaded = false;
let currentFormId = null;
let allForms = [];
let currentUserId = null;
let expandedCategories = new Set();
let currentStudentInfo = null;
let cachedUsers = null;
let selectedRegions = []; // Multi-region selection state
window.currentExamType = 'MHT-CET'; // Toggle between MHT-CET and JEE

// Admin Template Editing Mode State
let isAdminTemplateEditingMode = false;
let editingTemplateId = null;
let editingTemplateName = '';
let editingTemplateDesc = '';
let editingTemplateTags = [];
let editingTemplateIsPublished = true;
let editingTemplateFilters = {};

/* ══════ HOME UNIVERSITY MAP ══════ */
const HOME_UNIVERSITY_MAP = {
  'Mumbai': {
    name: 'University of Mumbai (MU)',
    cities: ['mumbai', 'thane', 'raigad', 'palghar', 'ratnagiri', 'sindhudurg', 'navi mumbai', 'panvel', 'ulhasnagar', 'vasai', 'virar', 'badlapur', 'karjat', 'kharghar', 'andheri', 'boisar', 'new panvel', 'khalapur', 'bapsai', 'tal-ambernath']
  },
  'Pune': {
    name: 'Savitribai Phule Pune University (SPPU)',
    cities: ['pune', 'ahmednagar', 'nashik', 'baramati', 'lonavala', 'talegaon', 'kopargaon', 'sangamner', 'narhe', 'wagholi', 'pisoli', 'ravet', 'haveli', 'indapur', 'shegaon', 'malegaon-baramati', 'chincholi', 'swami - chincholi', 'avasari', 'kuran', 'ohar']
  },
  'Nagpur': {
    name: 'RTMNU, Nagpur',
    cities: ['nagpur', 'wardha', 'bhandara', 'gondia', 'gadchiroli', 'chandrapur', 'ramtek', 'sevagram', 'bhadrawati', 'sakoli', 'hingna', 'babulgaon', 'sindhi(meghe)']
  },
  'Aurangabad': {
    name: 'BAMU, Chhatrapati Sambhajinagar',
    cities: ['aurangabad', 'chhatrapati sambhajinagar', 'jalna', 'beed', 'osmanabad', 'ambejogai', 'dharashiv']
  },
  'Kolhapur': {
    name: 'Shivaji University, Kolhapur',
    cities: ['kolhapur', 'sangli', 'satara', 'karad', 'ichalkaranji', 'gadhinglaj', 'jaysingpur', 'warananagar', 'miraj', 'yadrav', 'kankavli']
  },
  'Jalgaon': {
    name: 'KBCNMU, Jalgaon',
    cities: ['jalgaon', 'dhule', 'nandurbar', 'bhusawal', 'chopda', 'shirpur', 'faizpur', 'dondaicha', 'malegaon']
  },
  'Amravati': {
    name: 'SGBAU, Amravati',
    cities: ['amravati', 'akola', 'yavatmal', 'buldhana', 'washim', 'badnera', 'shegaon', 'pusad', 'achalpur']
  },
  'Nanded': {
    name: 'SRTMUN, Nanded',
    cities: ['nanded', 'latur', 'parbhani', 'hingoli', 'tuljapur']
  },
  'Solapur': {
    name: 'Solapur University',
    cities: ['solapur', 'pandharpur', 'barshi', 'sangola', 'akluj']
  }
};

// All available regions for multi-select based on region data (6 DTE regions)
const ALL_REGIONS = ['Amravati', 'Chhatrapati Sambhajinagar', 'Mumbai', 'Nagpur', 'Nashik', 'Pune'];

/**
 * Determine the region of a college based on its institute code prefix.
 */
function getCollegeRegion(code) {
  const codeStr = String(code || '').trim();
  const parsedCode = codeStr.replace(/^0+/, '');
  const checkChar = parsedCode.length === 5 ? parsedCode.charAt(1) : parsedCode.charAt(0);
  if (checkChar === '1') return 'Amravati';
  if (checkChar === '2') return 'Chhatrapati Sambhajinagar';
  if (checkChar === '3') return 'Mumbai';
  if (checkChar === '4') return 'Nagpur';
  if (checkChar === '5') return 'Nashik';
  if (checkChar === '6') return 'Pune';
  return null;
}

/**
 * Determine the Home University key for a college based on its name.
 * Returns the HU key (e.g. 'Mumbai', 'Pune') or null if not matched / autonomous.
 */
function getCollegeHU(collegeName) {
  const nameLower = (collegeName || '').toLowerCase();
  for (const [huKey, huData] of Object.entries(HOME_UNIVERSITY_MAP)) {
    for (const city of huData.cities) {
      if (nameLower.includes(city)) return huKey;
    }
  }
  return null;
}

/**
 * Get the required seat type suffix for a college given the student's home university.
 * - If college is in student's HU region → 'H' (Home)
 * - If college is in a different HU region → 'O' (Other)
 * - If college HU cannot be determined (autonomous/state level) → 'S' (State)
 * - If no HU selected → null (no filtering)
 */
function getSeatSuffix(collegeName, collegeStatus, studentHU) {
  if (!studentHU) return null; // No HU selected, don't filter by suffix
  const statusLower = (collegeStatus || '').toLowerCase();
  // Autonomous and state-level institutes use S seats
  if (statusLower.includes('autonomous') || statusLower.includes('university department')) return 'S';
  const collegeHU = getCollegeHU(collegeName);
  if (!collegeHU) return 'S'; // Can't determine region → treat as state level
  return collegeHU === studentHU ? 'H' : 'O';
}

/**
 * Check if a college matches any of the selected regions based on its institute code.
 */
function matchesSelectedRegions(collegeCode, regions) {
  if (!regions || regions.length === 0) return true; // No region filter
  const collegeRegion = getCollegeRegion(collegeCode);
  if (!collegeRegion) return false;
  return regions.some(r => r.toLowerCase() === collegeRegion.toLowerCase());
}

/**
 * Toggle between MHT-CET and JEE Mains counselling entry paths, hiding/showing relevant fields.
 */
function toggleExamPath(type) {
  const isJee = (type === 'JEE');
  window.currentExamType = type;

  // Find container rows
  const catSelect = document.getElementById('inCategory');
  const huSelect = document.getElementById('inHomeUniv');
  const colTypeSelect = document.getElementById('inColType');
  const minoritySelect = document.getElementById('inMinority');

  if (catSelect) catSelect.closest('.fg').style.display = isJee ? 'none' : 'block';
  if (huSelect) huSelect.closest('.fg').style.display = isJee ? 'none' : 'block';
  if (colTypeSelect) colTypeSelect.closest('.fg').style.display = isJee ? 'none' : 'block';
  if (minoritySelect) minoritySelect.closest('.fg').style.display = isJee ? 'none' : 'block';

  // Update Labels for inputs
  const pctLabel = document.querySelector('#studentPctRankRow .fg:nth-child(1) .fg-label');
  const rankLabel = document.querySelector('#studentPctRankRow .fg:nth-child(2) .fg-label');

  if (pctLabel) {
    pctLabel.innerHTML = isJee ? 'JEE Mains Percentile <span class="fg-optional">Optional</span>' : 'CET Percentile <span class="fg-optional">Optional</span>';
  }
  if (rankLabel) {
    rankLabel.innerHTML = isJee ? 'MHT-CET All India Rank <span class="fg-optional">Optional</span>' : 'CET Rank <span class="fg-optional">Optional</span>';
  }
  
  // Re-run auto-filling logic if needed
  autoFillPctRank();
  triggerAutosave();
}

/**
 * Toggle a region in the multi-select chips UI.
 */
function toggleRegion(region) {
  const idx = selectedRegions.indexOf(region);
  if (idx >= 0) selectedRegions.splice(idx, 1);
  else selectedRegions.push(region);
  renderRegionChips();
  triggerAutosave();
}

function renderRegionChips() {
  const container = document.getElementById('regionChipsContainer');
  if (!container) return;
  container.innerHTML = ALL_REGIONS.map(r => {
    const sel = selectedRegions.includes(r) ? 'selected' : '';
    return `<button type="button" class="region-chip ${sel}" onclick="toggleRegion('${r}')">${r}</button>`;
  }).join('');
}

/**
 * Auto-calculate missing percentile or rank.
 */
function autoFillPctRank() {
  const pctEl = document.getElementById('inPct');
  const rankEl = document.getElementById('inRank');
  const pctVal = pctEl.value.trim();
  const rankVal = rankEl.value.trim();
  const TOTAL_STUDENTS = 520000;

  if (pctVal && !rankVal) {
    const pct = parseFloat(pctVal);
    if (!isNaN(pct) && pct >= 0 && pct <= 100) {
      const rank = Math.max(1, Math.round((100 - pct) / 100 * TOTAL_STUDENTS));
      rankEl.value = rank;
    }
  } else if (rankVal && !pctVal) {
    const rank = parseInt(rankVal);
    if (!isNaN(rank) && rank >= 1) {
      const pct = Math.max(0, 100 - (rank / TOTAL_STUDENTS) * 100);
      pctEl.value = pct.toFixed(4);
    }
  }
}
const CATS = {
  'Computer & IT': ['COMPUTER', 'INFORMATION TECHNOLOGY', 'AI', 'ARTIFICIAL', 'DATA SCIENCE', 'MACHINE LEARNING', 'SOFTWARE', 'CYBER', 'ROBOTICS'],
  'Electronics & Telecom': ['ELECTRONICS', 'TELECOMMUNICATION', 'ENTC', 'COMMUNICATION', 'INSTRUMENTATION'],
  'Core Engineering': ['MECHANICAL', 'CIVIL', 'ELECTRICAL', 'CHEMICAL', 'PRODUCTION', 'METALLURGY', 'AUTOMOBILE', 'TEXTILE', 'MINING'],
  'Biotech & Allied': ['BIOTECHNOLOGY', 'BIO-MEDICAL', 'BIO MEDICAL', 'FOOD', 'AGRICULTURE', 'PHARMACEUTICAL'],
  'Other Branches': []
};
const FIXED_ASPIRATIONAL = [
  { code: '16006', instituteName: 'COEP Technological University', branch: 'Computer Engineering', percentile: 99.98, isFixed: false, isAspirational: true },
  { code: '3012', instituteName: 'Veermata Jijabai Technological Institute (VJTI)', branch: 'Computer Engineering', percentile: 99.95, isFixed: false, isAspirational: true },
  { code: '3012', instituteName: 'Veermata Jijabai Technological Institute (VJTI)', branch: 'Information Technology', percentile: 99.92, isFixed: false, isAspirational: true },
  { code: '16006', instituteName: 'COEP Technological University', branch: 'Artificial Intelligence and Machine Learning', percentile: 99.88, isFixed: false, isAspirational: true },
  { code: '3215', instituteName: 'Sardar Patel Institute of Technology (SPIT)', branch: 'Computer Science and Engineering', percentile: 99.85, isFixed: false, isAspirational: true },
  { code: '3215', instituteName: 'Sardar Patel Institute of Technology (SPIT)', branch: 'Computer Engineering', percentile: 99.82, isFixed: false, isAspirational: true }
];

/* ══════ STEPPER ══════ */
let currentStep = 1;
function goStep(n) {
  if (n < 0 || n > 5) return;
  // Map step 4 to step 3 for backward compatibility
  if (n === 4) n = 3;
  if (n === 2) {
    if (!validateStep1()) return;
    saveNonLockedData();
  }
  if (n === 3 && selectedBranches.size === 0) { pbToast('Select at least one branch'); return }
  if (n === 3) {
    generateMatches();
    initSplitFilters();
    renderPrefList();
    renderSplitPredictorResults();
  }

  // Save progress on every step transition
  if (n > 0 && n <= 3) saveNonLockedData();

  currentStep = n;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const targetPanel = document.getElementById('panel' + n);
  if (targetPanel) targetPanel.classList.add('active');

  // Manage Stepper
  const stepper = document.getElementById('pbStepper');
  if (n === 0 || n === 5) {
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
  selectedBranches = new Set(); // Clear branch selections

  const radios = document.getElementsByName('inExamType');
  for (const r of radios) {
    if (r.value === 'MHT-CET') {
      r.checked = true;
      break;
    }
  }
  toggleExamPath('MHT-CET');

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

  const examTypeVal = form.examType || 'MHT-CET';
  const radios = document.getElementsByName('inExamType');
  for (const r of radios) {
    if (r.value === examTypeVal) {
      r.checked = true;
      break;
    }
  }
  toggleExamPath(examTypeVal);

  let genderVal = form.gender;
  let categoryVal = form.category || 'OPEN';
  if (!genderVal) {
    if (categoryVal.startsWith('L') && categoryVal !== 'L') {
      genderVal = 'Female-only';
      categoryVal = categoryVal.substring(1);
    } else {
      genderVal = 'Gender-Neutral';
    }
  }
  document.getElementById('inCategory').value = categoryVal;
  document.getElementById('inGender').value = genderVal;
  // Restore region (backward compat: old forms had single region string)
  selectedRegions = form.selectedRegions || (form.region ? [form.region] : []);
  renderRegionChips();
  // Restore home university
  const huEl = document.getElementById('inHomeUniv');
  if (huEl) huEl.value = form.homeUniv || '';
  prefList = form.prefList || [];

  // Ensure Fixed Aspirational are present even in old forms
  FIXED_ASPIRATIONAL.forEach(fa => {
    if (!prefList.some(p => p.code === fa.code && p.branch === fa.branch)) {
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
    window._tempKeys = prefList.map(item => item.code + '|' + item.branch);
  }

  if (form.colType) document.getElementById('inColType').value = form.colType;
  if (form.minority) document.getElementById('inMinority').value = form.minority;

  if (prefLocked) lockProfileFields();
  else unlockProfileFields();

  renderBranches();
  renderEditStatus();

  window._isLoadingForm = true;
  // Use saved step if not explicitly provided
  const targetStep = step || form.currentStep || 1;
  goStep(targetStep === 4 ? 3 : targetStep);
  window._isLoadingForm = false;
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
  if (typeof isAdminTemplateEditingMode !== 'undefined' && isAdminTemplateEditingMode) return;
  
  const pct = document.getElementById('inPct').value;
  const rank = document.getElementById('inRank').value;
  const cat = document.getElementById('inCategory').value;
  const gender = document.getElementById('inGender').value;
  const homeUniv = (document.getElementById('inHomeUniv') || {}).value || '';
  const examType = window.currentExamType || 'MHT-CET';

  const res = await authApi('savePrefData', {
    userId: currentUserId,
    formId: currentFormId,
    percentile: pct,
    rank: rank,
    category: cat,
    gender: gender,
    region: selectedRegions.length === 1 ? selectedRegions[0] : '', // backward compat
    selectedRegions: selectedRegions,
    homeUniv: homeUniv,
    examType: examType,
    prefList: prefList,
    selectedBranches: Array.from(selectedBranches),
    selectedCollegeKeys: prefList.filter(p => !p.isFixed).map(p => p.code + '|' + p.branch),
    currentStep: currentStep,
    colType: document.getElementById('inColType').value,
    minority: document.getElementById('inMinority').value,
    studentInfo: currentStudentInfo || null,
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
  if (typeof isAdminTemplateEditingMode !== 'undefined' && isAdminTemplateEditingMode) {
    let pMinVal = document.getElementById('inPctMin').value.trim();
    let pMaxVal = document.getElementById('inPctMax').value.trim();
    let rMinVal = document.getElementById('inRankMin').value.trim();
    let rMaxVal = document.getElementById('inRankMax').value.trim();

    // If only one of the percentile bounds is entered, autocomplete the other
    if (pMinVal !== '' && pMaxVal === '') {
      pMaxVal = '100';
      document.getElementById('inPctMax').value = '100';
    } else if (pMinVal === '' && pMaxVal !== '') {
      pMinVal = '0';
      document.getElementById('inPctMin').value = '0';
    }

    // If only one of the rank bounds is entered, autocomplete the other
    if (rMinVal !== '' && rMaxVal === '') {
      rMaxVal = '1000000';
      document.getElementById('inRankMax').value = '1000000';
    } else if (rMinVal === '' && rMaxVal !== '') {
      rMinVal = '1';
      document.getElementById('inRankMin').value = '1';
    }

    const hasPct = pMinVal !== '' && pMaxVal !== '' && !isNaN(parseFloat(pMinVal)) && !isNaN(parseFloat(pMaxVal));
    const hasRank = rMinVal !== '' && rMaxVal !== '' && !isNaN(parseInt(rMinVal)) && !isNaN(parseInt(rMaxVal));

    if (hasPct && parseFloat(pMinVal) > parseFloat(pMaxVal)) {
      pbToast('Min percentile cannot be greater than Max percentile');
      return false;
    }
    if (hasRank && parseInt(rMinVal) > parseInt(rMaxVal)) {
      pbToast('Min rank cannot be greater than Max rank');
      return false;
    }
    return true;
  }

  const p = document.getElementById('inPct').value.trim(), r = document.getElementById('inRank').value.trim();
  const hasP = p !== '' && !isNaN(parseFloat(p));
  const hasR = r !== '' && !isNaN(parseInt(r));
  if (!hasP && !hasR) { pbToast('Enter either percentile or rank (at least one is required)'); return false }
  // Auto-fill the missing one
  autoFillPctRank();
  return true;
}

/* ══════ DATA LOADING ══════ */
async function loadData() {
  const loader = document.getElementById('dataLoader');
  try {
    loader.innerHTML = '<div class="pb-spinner"></div><span>Loading cutoff data...</span>';
    
    // Fetch data.json, college-data.json, and jee_data.json concurrently
    const [res1, res2, res3] = await Promise.all([
      fetch('data.json'),
      fetch('college-data.json'),
      fetch('jee_data.json')
    ]);
    const j1 = await res1.json();
    const j2 = await res2.json();
    const j3 = await res3.json();

    const raw1 = j1['MHT-CET College Data'] || j1[Object.keys(j1)[0]] || [];
    cutoffData = raw1.map(r => ({
      code: String(r['Institute Code'] || ''), name: r['Institute'] || r['Institute Name'] || '',
      branch: (r['Branch'] || r['Branch Name'] || '').trim(),
      seatType: r['Seat Type'] || '', rank: parseInt(r['Rank']) || 0,
      percentile: parseFloat(r['Percentile']) || 0
    }));

    collegeMetadata = (j2['college-data'] || []).map(c => ({
      code: String(c['Institute Code'] || ''), name: c['Institute Name'] || '',
      status: c['Status'] || '', intake: c['Total Intake'] || 0
    }));

    const raw3 = j3['Cleaned_MHT-CET_Cutoff_Data (1)'] || j3[Object.keys(j3)[0]] || [];
    jeeCutoffData = raw3.map(r => ({
      code: String(r['College Code'] || '').trim().replace(/^0+/, ''),
      name: r['Institute Name'] || '',
      branch: (r['Branch Name'] || '').replace(/\n/g, ' ').trim(),
      seatType: r['Seat Type'] || 'AI',
      rank: parseInt(r['All India Merit'] || r['All India Merit Number']) || 0,
      percentile: parseFloat(r['JEE Percentile']) || 0
    }));
    window.jeeCutoffData = jeeCutoffData;

    // Extract branches from both MHT-CET and JEE Main datasets
    const bSet = new Set();
    cutoffData.forEach(r => { if (r.branch) bSet.add(r.branch) });
    jeeCutoffData.forEach(r => { if (r.branch) bSet.add(r.branch) });
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
  const isTemplate = (typeof isAdminTemplateEditingMode !== 'undefined' && isAdminTemplateEditingMode);

  let pct = 0;
  let rank = 1000000;
  let pctMin = 0, pctMax = 100, rankMin = 0, rankMax = 1000000;
  let hasPctRange = false;
  let hasRankRange = false;

  if (isTemplate) {
    const pMinVal = document.getElementById('inPctMin').value;
    const pMaxVal = document.getElementById('inPctMax').value;
    if (pMinVal !== '' && pMaxVal !== '') {
      pctMin = parseFloat(pMinVal);
      pctMax = parseFloat(pMaxVal);
      hasPctRange = true;
    }

    const rMinVal = document.getElementById('inRankMin').value;
    const rMaxVal = document.getElementById('inRankMax').value;
    if (rMinVal !== '' && rMaxVal !== '') {
      rankMin = parseInt(rMinVal);
      rankMax = parseInt(rMaxVal);
      hasRankRange = true;
    }
  } else {
    pct = parseFloat(document.getElementById('inPct').value);
    rank = parseInt(document.getElementById('inRank').value);
  }

  const isJee = (window.currentExamType === 'JEE');
  const activeCutoffData = isJee ? (jeeCutoffData || []) : cutoffData;

  const regions = selectedRegions; // Multi-region array
  const homeUniv = isJee ? '' : ((document.getElementById('inHomeUniv') || {}).value || '');
  const colType = document.getElementById('inColType').value;
  const minority = isJee ? '' : document.getElementById('inMinority').value;
  const category = isJee ? 'OPEN' : document.getElementById('inCategory').value;
  const gender = document.getElementById('inGender').value;

  const isLadiesSeatSelected = (gender === 'Female-only');
  const baseCategory = category;

  // Build category seat filter
  const catMap = { 'OPEN': 'OPEN', 'OBC': 'OBC', 'SC': 'SC', 'ST': 'ST', 'VJ/DT': 'VJ', 'NT1': 'NT1', 'NT2': 'NT2', 'NT3': 'NT3', 'EWS': 'EWS', 'TFWS': 'TFWS' };
  const searchCat = catMap[baseCategory] || 'OPEN';

  const metaMap = {};
  collegeMetadata.forEach(c => metaMap[c.code] = c);

  // Filter cutoff data
  let filtered = activeCutoffData.filter(r => {
    if (!selectedBranches.has(r.branch)) return false;

    if (isTemplate) {
      if (hasPctRange && (r.percentile < pctMin || r.percentile > pctMax)) return false;
      if (hasRankRange && (r.rank < rankMin || r.rank > rankMax)) return false;
    }

    const meta = metaMap[r.code] || {};
    const collegeName = meta.name || r.name || '';
    const nameLower = collegeName.toLowerCase();
    const statusLower = (meta.status || '').toLowerCase();

    if (!isJee) {
      // Check if this college matches the selected minority preference
      const isMatchingMinorityCollege = minority && 
        statusLower.includes('minority') && 
        statusLower.includes(minority.toLowerCase());

      // For matching minority colleges, use OPEN seats. For others, use user's selected category seats.
      const activeSearchCat = isMatchingMinorityCollege ? 'OPEN' : searchCat;

      if (activeSearchCat !== 'OPEN' && !(r.seatType || '').includes(activeSearchCat)) return false;
      if (activeSearchCat === 'OPEN' && !(r.seatType || '').includes('OPEN')) return false;

      // Home University H/O/S suffix filtering
      if (homeUniv) {
        const suffix = getSeatSuffix(collegeName, meta.status || '', homeUniv);
        const st = r.seatType || '';
        if (suffix === 'H' && !st.endsWith('H')) return false;
        if (suffix === 'O' && !st.endsWith('O')) return false;
        if (suffix === 'S' && !st.endsWith('S')) return false;
      }
    }

    // Gender/Ladies filter:
    const isWomenOnly = nameLower.includes('women') || nameLower.includes('girls') || statusLower.includes('women') || statusLower.includes('girls') || r.code === '3035';
    
    if (isLadiesSeatSelected) {
      if (!isJee) {
        if (!isWomenOnly && !(r.seatType || '').startsWith('L')) return false;
      }
    } else {
      if (!isJee && (r.seatType || '').startsWith('L')) return false;
      if (isWomenOnly) return false;
    }

    return true;
  });

  // Group by institute+branch, pick closest percentile
  const groups = {};
  filtered.forEach(r => {
    const key = r.code + '|' + r.branch;
    if (isTemplate) {
      if (!groups[key] || r.percentile > groups[key].percentile) {
        groups[key] = r;
      }
    } else {
      if (!groups[key] || Math.abs(r.percentile - pct) < Math.abs(groups[key].percentile - pct)) {
        groups[key] = r;
      }
    }
  });

  let results = Object.values(groups);

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
      diff: isTemplate ? 0 : (r.percentile - pct)
    };
  });

  // Helper to filter by minority & region combined (now supports multi-region)
  function filterByMinorityAndRegion(list) {
    return list.filter(r => {
      const isMatchingMinorityCollege = minority && 
        (r.status || '').toLowerCase().includes('minority') && 
        (r.status || '').toLowerCase().includes(minority.toLowerCase());

      if (minority) {
        // Match if it's the specified minority college
        if (isMatchingMinorityCollege) return true;
        
        // Match if it's a general (non-minority) college AND matches region
        if (!r.isMinority) {
          if (regions.length > 0) {
            return matchesSelectedRegions(r.code, regions);
          }
          return true;
        }
        return false;
      } else {
        // No minority preference, standard region filter
        if (regions.length > 0) {
          return matchesSelectedRegions(r.code, regions);
        }
        return true;
      }
    });
  }

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
  reachableList = filterByMinorityAndRegion(reachableList);

  if (isTemplate) {
    matchedColleges = reachableList.sort((a, b) => b.percentile - a.percentile);
  } else {
    function getPercentileRange(p) {
      let V = 20;
      let bucketMax = 100;
      if (p >= 99 && p <= 100) {
        V = (p === 100) ? 2 : 2.5;
        bucketMax = 100;
      } else if (p >= 95 && p < 99) {
        V = 3;
        bucketMax = 99;
      } else if (p >= 90 && p < 95) {
        V = 4;
        bucketMax = 95;
      } else if (p >= 80 && p < 90) {
        V = 6;
        bucketMax = 90;
      } else if (p >= 70 && p < 80) {
        V = 8;
        bucketMax = 80;
      } else if (p >= 60 && p < 70) {
        V = 10;
        bucketMax = 70;
      } else if (p >= 50 && p < 60) {
        V = 10;
        bucketMax = 60;
      } else if (p >= 40 && p < 50) {
        V = 10;
        bucketMax = 50;
      } else if (p >= 30 && p < 40) {
        V = 15;
        bucketMax = 40;
      } else if (p >= 20 && p < 30) {
        V = 20;
        bucketMax = 30;
      } else if (p >= 10 && p < 20) {
        V = 20;
        bucketMax = 20;
      } else {
        V = 20;
        bucketMax = 10;
      }
      return {
        min: Math.max(0, p - V),
        max: bucketMax
      };
    }

    const range = getPercentileRange(pct);
    const minPercentile = range.min;
    const maxPercentile = range.max;

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
    if (regions.length > 0) {
      aspirationalList = aspirationalList.filter(r => matchesSelectedRegions(r.code, regions));
    }

    const reachableMinority = reachableList.filter(r => {
      const isMatchingMinority = minority && 
        (r.status || '').toLowerCase().includes('minority') && 
        (r.status || '').toLowerCase().includes(minority.toLowerCase());
      return isMatchingMinority && r.percentile >= minPercentile;
    });

    const reachableNormal = reachableList.filter(r => {
      const isMatchingMinorityCollege = minority && 
        (r.status || '').toLowerCase().includes('minority') && 
        (r.status || '').toLowerCase().includes(minority.toLowerCase());
      return !isMatchingMinorityCollege && r.percentile <= pct && r.percentile >= minPercentile;
    });

    const reachable = [...reachableMinority, ...reachableNormal];
    reachable.forEach(r => r.isAspirational = false);

    // For aspirational, we take from the list that IGNORES minority status
    const aspirational = aspirationalList.filter(r => r.percentile > pct && r.percentile <= maxPercentile);
    aspirational.forEach(r => r.isAspirational = true);

    matchedColleges = [...aspirational, ...reachable];
    matchedColleges.sort((a, b) => b.percentile - a.percentile);
  }

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
    if (regions.length > 0 && !matchesSelectedRegions(r.code, regions)) return false;

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
  if (!grid || !countEl) {
    renderSplitPredictorResults();
    return;
  }
  let items = matchedColleges;

  if (filter === 'aspirational') items = matchedColleges.filter(r => r.isAspirational);
  else if (filter === 'reachable') items = matchedColleges.filter(r => !r.isAspirational);
  else if (filter === 'government') items = matchedColleges.filter(r => r.isGov);
  else if (filter === 'autonomous') items = matchedColleges.filter(r => r.isAuto);

  countEl.textContent = items.length + ' colleges found (' + selectedColleges.length + ' selected)';

  if (!items.length) {
    const minority = document.getElementById('inMinority').value;
    const region = selectedRegions.join(', ');
    let msg = 'Try adjusting your filters or branch preferences.';
    if (minority) msg = `no colleges found !! for ${minority} ${region ? 'in ' + region : ''}`;

    grid.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><h3>No Matches</h3><p>${msg}</p></div>`;
    return;
  }

  const userSession = getSession();
  const isPremium = userSession && (userSession.role === 'premium' || userSession.role === 'admin');

  const displayItems = isPremium ? items : items.slice(0, 13);

  const tbodyHtml = displayItems.map((c, idx) => {
    const isLocked = !isPremium && idx >= 10;
    
    if (isLocked) {
      return `<tr class="locked-row" style="cursor: default;">
        <td class="excel-td-select" style="text-align: center;">🔒</td>
        <td><span style="filter: blur(2.5px); opacity: 0.5;">0000</span></td>
        <td class="excel-td-name"><span style="filter: blur(4px); opacity: 0.5; font-weight: 600;">••••••••••••••••••••••••••••••••••••</span></td>
        <td><span style="filter: blur(4px); opacity: 0.5; color: var(--muted)">••••••••••••••••••••</span></td>
        <td><span style="filter: blur(4px); opacity: 0.5;">••••</span></td>
        <td class="excel-td-pct"><strong style="filter: blur(2.5px); opacity: 0.5;">••.•%</strong></td>
        <td><span class="col-tag reach-tag" style="filter: blur(2px); opacity: 0.5;">Locked 🔒</span></td>
      </tr>`;
    }

    const realIdx = matchedColleges.indexOf(c);
    const sel = selectedColleges.includes(realIdx);
    const asp = c.isAspirational;

    // Status/type tags
    const statusTags = [];
    if (c.isGov) statusTags.push('Gov');
    if (c.isAuto) statusTags.push('Auto');
    if (c.isMinority) statusTags.push(c.minorityType || 'Minority');
    if (c.isAided) statusTags.push('Aided');
    if (!c.isGov && !c.isAided) statusTags.push('Un-Aided');
    const statusText = statusTags.join(', ');

    return `<tr class="${sel ? 'selected' : ''} ${asp ? 'aspirational' : ''}" onclick="toggleCollegeRow(event, ${realIdx})">
      <td class="excel-td-select"><input type="checkbox" ${sel ? 'checked' : ''} onclick="event.stopPropagation(); toggleCollege(${realIdx})"></td>
      <td>${c.code}</td>
      <td class="excel-td-name" title="${escH(c.instituteName)}">${escH(c.instituteName)}</td>
      <td title="${escH(c.branch)}">${escH(c.branch)}</td>
      <td>${escH(statusText)}</td>
      <td class="excel-td-pct"><strong>${c.percentile.toFixed(2)}%</strong></td>
      <td><span class="col-tag ${asp ? 'asp-tag' : 'reach-tag'}">${asp ? 'Aspirational' : 'Reachable'}</span></td>
    </tr>`;
  }).join('');

  // Header checkbox check state: checked if all items are selected
  const checkItems = isPremium ? items : items.slice(0, 10);
  const allSelected = checkItems.length > 0 && checkItems.every(c => selectedColleges.includes(matchedColleges.indexOf(c)));

  grid.innerHTML = `
    <div class="excel-table-wrap">
      <table class="excel-table">
        <thead>
          <tr>
            <th class="excel-th-select"><input type="checkbox" id="selectAllColleges" ${allSelected ? 'checked' : ''} onchange="toggleSelectAllColleges(this)"></th>
            <th style="width: 80px">Code</th>
            <th>Institute Name</th>
            <th>Branch</th>
            <th>Type</th>
            <th style="width: 100px">Cutoff %</th>
            <th style="width: 130px">Category</th>
          </tr>
        </thead>
        <tbody>
          ${tbodyHtml}
        </tbody>
      </table>
    </div>
  `;

  if (!isPremium && items.length > 10) {
    grid.innerHTML += `
      <div class="lock-paywall-card">
        <div class="lock-icon-container">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h3>Unlock All Matching Colleges</h3>
        <p>Purchase any one course to unlock the full list of matches and export your preference form.</p>
        <a href="https://www.conceptsimplified.in/courses" target="_blank" class="unlock-btn">Unlock Premium Counselling</a>
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

function toggleCollegeRow(event, idx) {
  if (event.target.type === 'checkbox' || event.target.closest('.excel-td-select')) return;
  toggleCollege(idx);
}

function toggleSelectAllColleges(checkboxEl) {
  const isChecked = checkboxEl.checked;
  const activeFilter = document.querySelector('.filter-chip.active')?.dataset.f || 'all';
  let items = matchedColleges;
  if (activeFilter === 'aspirational') items = matchedColleges.filter(r => r.isAspirational);
  else if (activeFilter === 'reachable') items = matchedColleges.filter(r => !r.isAspirational);
  else if (activeFilter === 'government') items = matchedColleges.filter(r => r.isGov);
  else if (activeFilter === 'autonomous') items = matchedColleges.filter(r => r.isAuto);

  const userSession = getSession();
  const isPremium = userSession && (userSession.role === 'premium' || userSession.role === 'admin');
  const targetItems = isPremium ? items : items.slice(0, 10);

  targetItems.forEach(c => {
    const realIdx = matchedColleges.indexOf(c);
    const selIdx = selectedColleges.indexOf(realIdx);
    if (isChecked) {
      if (selIdx === -1) selectedColleges.push(realIdx);
    } else {
      if (selIdx >= 0) selectedColleges.splice(selIdx, 1);
    }
  });

  renderColleges(activeFilter);
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

  // Sort all selected preferences by percentile desc
  userSelected.sort((a, b) => b.percentile - a.percentile);

  // Combine: Fixed -> User Selected
  const combined = [...FIXED_ASPIRATIONAL, ...userSelected];
  
  // Deduplicate based on code + branch, keeping the first occurrence (which preserves fixed/aspirational flags)
  const seen = new Set();
  prefList = combined.filter(c => {
    const key = c.code + '|' + c.branch;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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
    
    const category = document.getElementById('inCategory').value || 'OPEN';
    const minority = document.getElementById('inMinority').value || '';
    const gender = document.getElementById('inGender').value || 'Gender-Neutral';
    const isLadiesSeatSelected = (gender === 'Female-only');
    const baseCategory = category;
    const homeUniv = (document.getElementById('inHomeUniv') || {}).value || '';

    const isJee = (window.currentExamType === 'JEE');
    const activeCutoffData = isJee ? (jeeCutoffData || []) : cutoffData;

    const catMap = { 'OPEN': 'OPEN', 'OBC': 'OBC', 'SC': 'SC', 'ST': 'ST', 'VJ/DT': 'VJ', 'NT1': 'NT1', 'NT2': 'NT2', 'NT3': 'NT3', 'EWS': 'EWS', 'TFWS': 'TFWS' };
    const searchCat = catMap[baseCategory] || 'OPEN';

    const metaMap = {}; collegeMetadata.forEach(c => metaMap[c.code] = c);

    let filtered = activeCutoffData.filter(r => {
      if (!r.code.includes(query) && !(r.name || '').toLowerCase().includes(query) && !(r.branch || '').toLowerCase().includes(query)) return false;

      const meta = metaMap[r.code] || {};
      const nameLower = (meta.name || r.name || '').toLowerCase();
      const statusLower = (meta.status || '').toLowerCase();
      const isWomenOnly = nameLower.includes('women') || nameLower.includes('girls') || statusLower.includes('women') || statusLower.includes('girls') || r.code === '3035';

      if (isLadiesSeatSelected) {
        if (!isJee && !isWomenOnly && !(r.seatType || '').startsWith('L')) return false;
      } else {
        if (!isJee && (r.seatType || '').startsWith('L')) return false;
        if (isWomenOnly) return false;
      }

      if (!isJee && homeUniv) {
        const suffix = getSeatSuffix(meta.name || r.name || '', meta.status || '', homeUniv);
        const st = r.seatType || '';
        if (suffix === 'H' && !st.endsWith('H')) return false;
        if (suffix === 'O' && !st.endsWith('O')) return false;
        if (suffix === 'S' && !st.endsWith('S')) return false;
      }

      return true;
    });
    
    const groups = {};
    filtered.forEach(r => {
      const key = r.code + '|' + r.branch;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    let results = Object.values(groups).map(rows => {
      const meta = metaMap[rows[0].code] || {};
      const statusLower = (meta.status || '').toLowerCase();

      if (isJee) {
        return rows[0]; // For JEE AI seats, there's only 1 row per college+branch
      }

      const isMatchingMinorityCollege = minority && 
        statusLower.includes('minority') && 
        statusLower.includes(minority.toLowerCase());

      const activeSearchCat = isMatchingMinorityCollege ? 'OPEN' : searchCat;

      let matched = rows.filter(r => (r.seatType || '').includes(activeSearchCat));
      if (!matched.length) matched = rows.filter(r => (r.seatType || '').includes('OPEN'));
      if (!matched.length) matched = rows;
      
      let finalRow;
      if (isLadiesSeatSelected) {
        finalRow = matched.find(r => (r.seatType || '').startsWith('L'));
      } else {
        finalRow = matched.find(r => (r.seatType || '').startsWith('G'));
      }
      return finalRow || matched[0];
    });

    results.sort((a, b) => b.percentile - a.percentile);
    const sliced = results.slice(0, 15);

    if (!sliced.length) { resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No colleges found</div>'; return; }

    const inPref = new Set(prefList.map(p => p.code + '|' + p.branch));

    resDiv.innerHTML = sliced.map(r => {
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
        <button class="pb-btn pb-btn-primary" onclick="handleAddSuggestion('${r.code}','${r.branch.replace(/'/g, "\\'")}', true)" style="position:absolute; right:12px; top:12px; width:34px; height:34px; padding:0; border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow: none">
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
    
    const category = document.getElementById('inCategory').value || 'OPEN';
    const minority = document.getElementById('inMinority').value || '';
    const gender = document.getElementById('inGender').value || 'Gender-Neutral';
    const isLadiesSeatSelected = (gender === 'Female-only');
    const baseCategory = category;
    const homeUniv = (document.getElementById('inHomeUniv') || {}).value || '';

    const isJee = (window.currentExamType === 'JEE');
    const activeCutoffData = isJee ? (jeeCutoffData || []) : cutoffData;

    const catMap = { 'OPEN': 'OPEN', 'OBC': 'OBC', 'SC': 'SC', 'ST': 'ST', 'VJ/DT': 'VJ', 'NT1': 'NT1', 'NT2': 'NT2', 'NT3': 'NT3', 'EWS': 'EWS', 'TFWS': 'TFWS' };
    const searchCat = catMap[baseCategory] || 'OPEN';

    const metaMap = {}; collegeMetadata.forEach(c => metaMap[c.code] = c);

    let filtered = activeCutoffData.filter(r => {
      if (!r.code.includes(query) && !(r.name || '').toLowerCase().includes(query) && !(r.branch || '').toLowerCase().includes(query)) return false;

      const meta = metaMap[r.code] || {};
      const nameLower = (meta.name || r.name || '').toLowerCase();
      const statusLower = (meta.status || '').toLowerCase();
      const isWomenOnly = nameLower.includes('women') || nameLower.includes('girls') || statusLower.includes('women') || statusLower.includes('girls') || r.code === '3035';

      if (isLadiesSeatSelected) {
        if (!isJee && !isWomenOnly && !(r.seatType || '').startsWith('L')) return false;
      } else {
        if (!isJee && (r.seatType || '').startsWith('L')) return false;
        if (isWomenOnly) return false;
      }

      if (!isJee && homeUniv) {
        const suffix = getSeatSuffix(meta.name || r.name || '', meta.status || '', homeUniv);
        const st = r.seatType || '';
        if (suffix === 'H' && !st.endsWith('H')) return false;
        if (suffix === 'O' && !st.endsWith('O')) return false;
        if (suffix === 'S' && !st.endsWith('S')) return false;
      }

      return true;
    });
    
    const groups = {};
    filtered.forEach(r => {
      const key = r.code + '|' + r.branch;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    let results = Object.values(groups).map(rows => {
      const meta = metaMap[rows[0].code] || {};
      const statusLower = (meta.status || '').toLowerCase();

      if (isJee) {
        return rows[0]; // For JEE, only one row per college+branch
      }

      const isMatchingMinorityCollege = minority && 
        statusLower.includes('minority') && 
        statusLower.includes(minority.toLowerCase());

      const activeSearchCat = isMatchingMinorityCollege ? 'OPEN' : searchCat;

      let matched = rows.filter(r => (r.seatType || '').includes(activeSearchCat));
      if (!matched.length) matched = rows.filter(r => (r.seatType || '').includes('OPEN'));
      if (!matched.length) matched = rows;
      
      let finalRow;
      if (isLadiesSeatSelected) {
        finalRow = matched.find(r => (r.seatType || '').startsWith('L'));
      } else {
        finalRow = matched.find(r => (r.seatType || '').startsWith('G'));
      }
      return finalRow || matched[0];
    });

    results.sort((a, b) => b.percentile - a.percentile);
    const sliced = results.slice(0, 15);

    if (!sliced.length) { resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No colleges found</div>'; return; }

    const inPref = new Set(prefList.map(p => p.code + '|' + p.branch));

    resDiv.innerHTML = sliced.map(r => {
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
  const fixed = prefList.filter(c => c.isFixed);
  const others = prefList.filter(c => !c.isFixed);
  others.sort((a, b) => b.percentile - a.percentile);
  prefList = [...fixed, ...others];
  renderPrefList();
  pbToast('List sorted by cutoff percentile');
}

function toggleAspirational(code, branch) {
  const key = code + '|' + branch;
  const idx = prefList.findIndex(p => p.code === code && p.branch === branch);
  if (idx >= 0) {
    // Prevent removing fixed/mandatory aspirational
    if (prefList[idx].isFixed || idx < 6) return pbToast('Cannot remove mandatory college');
    prefList.splice(idx, 1);
    pbToast('Removed from preference list');
  } else {
    let c = [...matchedColleges, ...suggestionPool].find(r => r.code === code && r.branch === branch);
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
      const copy = { ...c, isAspirational: true };
      const lastFixedIdx = prefList.reduce((acc, item, i) => item.isFixed ? i : acc, -1);
      prefList.splice(lastFixedIdx + 1, 0, copy);
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

  const tableWrap = document.querySelector('.final-list-table-wrap');
  if (tableWrap) {
    const existing = tableWrap.querySelector('.lock-paywall-card');
    if (existing) existing.remove();
  }

  if (!prefList.length) {
    list.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--muted)">
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
          <td class="pref-num" style="text-align: center; font-weight: 800; width: 60px; vertical-align: middle">${i + 1}</td>
          <td style="width: 80px; vertical-align: middle"><span style="filter: blur(2px); opacity: 0.5;">0000</span></td>
          <td class="pref-name" style="font-weight: 600; color: var(--ink); vertical-align: middle"><span style="filter: blur(4px); opacity: 0.5;">••••••••••••••••••••••••••••••••••••</span></td>
          <td style="vertical-align: middle"><span style="filter: blur(4px); opacity: 0.5;">••••••••••••••••••••</span></td>
          <td style="vertical-align: middle"><span style="filter: blur(4.5px); opacity: 0.5;">••••</span></td>
          <td class="excel-td-pct" style="vertical-align: middle"><strong style="filter: blur(2.5px); opacity: 0.5;">••.••%</strong></td>
          <td style="text-align: center; width: 70px; vertical-align: middle">🔒</td>
        </tr>
      `;
    }

    const isFixed = c.isFixed;
    const isMandatoryVisual = isFixed || (i < 6);
    const badges = [];
    if (c.isAspirational) {
      badges.push('<span class="pref-code asp-badge" style="background:#fff7ed; color:#ea580c; border:1px solid rgba(234, 88, 12, 0.15); font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding: 2px 8px; border-radius: 6px">Aspirational</span>');
    }
    if (isMandatoryVisual) {
      badges.push('<span class="pref-code fixed-badge" style="background:var(--brand-soft); color:var(--brand); border:1px solid var(--brand-ring); font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding: 2px 8px; border-radius: 6px">Mandatory</span>');
    }

    // Look up status from metadata
    const meta = collegeMetadata.find(m => String(m.code) === String(c.code)) || {};
    const status = meta.status || c.status || '';
    const statusTags = [];
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('government')) {
      statusTags.push('<span class="col-tag gov" style="font-size: 9px; padding: 2px 8px">Government</span>');
    }
    if (statusLower.includes('autonomous')) {
      statusTags.push('<span class="col-tag auto" style="font-size: 9px; padding: 2px 8px">Autonomous</span>');
    }
    if (statusLower.includes('minority')) {
      const minType = c.minorityType || (meta.status ? extractMinority(meta.status) : '');
      statusTags.push(`<span class="col-tag minority" style="font-size: 9px; padding: 2px 8px">${escH(minType || 'Minority')}</span>`);
    }
    if (statusLower.includes('aided') && !statusLower.includes('un-aided')) {
      statusTags.push('<span class="col-tag" style="font-size: 9px; padding: 2px 8px">Aided</span>');
    }

    return `
      <tr class="pref-item ${isMandatoryVisual ? 'is-fixed' : ''} ${c.isAspirational ? 'asp-item' : ''}" 
          draggable="false" 
          data-idx="${i}"
          ondragstart="${isMandatoryVisual ? '' : 'dragStart(event)'}" 
          ondragover="dragOver(event)" 
          ondragleave="dragLeave(event)"
          ondrop="dropItem(event)" 
          ondragend="${isMandatoryVisual ? '' : 'dragEnd(event)'}"
          ontouchstart="${isMandatoryVisual ? '' : 'handleTouchStart(event)'}" 
          ontouchmove="${isMandatoryVisual ? '' : 'handleTouchMove(event)'}" 
          ontouchend="${isMandatoryVisual ? '' : 'handleTouchEnd(event)'}"
          style="${isMandatoryVisual ? 'border-left: 4px solid var(--brand);' : ''}">
        <td class="pref-num" 
            style="text-align: center; font-weight: 800; width: 60px; vertical-align: middle; cursor: grab"
            onmousedown="enableRowDrag(event)"
            onmouseup="disableRowDrag(event)"
            onmouseleave="disableRowDrag(event)"
            ontouchstart="enableRowDrag(event)">${i + 1}</td>
        <td style="width: 80px; vertical-align: middle">${c.code}</td>
        <td class="pref-name" style="font-weight: 600; color: var(--ink); vertical-align: middle" title="${escH(c.instituteName || c.name)}">${escH(c.instituteName || c.name)}</td>
        <td style="vertical-align: middle" title="${escH(c.branch)}">${escH(c.branch)}</td>
        <td style="vertical-align: middle">
          <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center">
            ${badges.join('')}
            ${statusTags.join('')}
          </div>
        </td>
        <td class="excel-td-pct" style="vertical-align: middle"><strong>${c.percentile ? c.percentile.toFixed(2) + '%' : 'N/A'}</strong></td>
        <td style="text-align: center; vertical-align: middle">
          <div class="pref-action-cell">
            ${isMandatoryVisual ? `
              <span style="font-size:9px; font-weight:800; color:var(--brand); opacity:0.6; text-transform:uppercase">Mandatory</span>
            ` : `
              <button class="pref-action-btn" onclick="movePrefUp(${i})" title="Move Up" ${i === 6 ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
              </button>
              <button class="pref-action-btn" onclick="movePrefDown(${i})" title="Move Down" ${i === prefList.length - 1 ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <button class="pref-remove" onclick="removePref(${i})" title="Remove" style="background:none; border:none; color:var(--muted); cursor:pointer; padding:4px; border-radius:6px; transition:0.2s">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            `}
          </div>
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
  if (prefList[i] && (prefList[i].isFixed || i < 6)) return pbToast('Cannot remove mandatory college');
  prefList.splice(i, 1);
  renderPrefList();
  triggerAutosave();
}

/* ══════ DRAG & DROP ══════ */
let dragIdx = null;
let draggedPredictorCollege = null;
let hoveredPrefRow = null;

function enableRowDrag(e) {
  const row = e.target.closest('.pref-item');
  if (row && !row.classList.contains('is-fixed')) {
    row.setAttribute('draggable', 'true');
  }
}

function disableRowDrag(e) {
  const row = e.target.closest('.pref-item');
  if (row) {
    row.setAttribute('draggable', 'false');
  }
}

function dragStart(e) { 
  const row = e.target.closest('.pref-item');
  if (!row) return;
  dragIdx = +row.dataset.idx; 
  setTimeout(() => {
    if (dragIdx !== null && row) {
      row.classList.add('dragging'); 
    }
  }, 0);
}

function dragOver(e) { 
  e.preventDefault(); 
  const row = e.target.closest('.pref-item'); 
  if (!row) return;
  
  if (hoveredPrefRow !== row) {
    if (hoveredPrefRow) {
      hoveredPrefRow.classList.remove('drag-over');
    }
    row.classList.add('drag-over');
    hoveredPrefRow = row;
  }
}

function dragLeave(e) {
  const row = e.target.closest('.pref-item');
  if (row && row === hoveredPrefRow) {
    row.classList.remove('drag-over');
    hoveredPrefRow = null;
  }
}

function dragStartPredictor(e, code, branch) {
  draggedPredictorCollege = { code, branch };
  e.dataTransfer.setData('text/plain', code + '|' + branch);
  const card = e.target.closest('.predicted-col-card') || e.target;
  setTimeout(() => {
    if (card) card.classList.add('dragging');
  }, 0);
}

function dragEndPredictor(e) {
  document.querySelectorAll('.predicted-col-card').forEach(el => el.classList.remove('dragging'));
}

function findCollegeInPools(code, branch) {
  let c = matchedColleges.find(r => r.code === code && r.branch === branch);
  if (!c) c = suggestionPool.find(r => r.code === code && r.branch === branch);
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
  return c;
}

function addPredictorCollege(code, branch) {
  const key = code + '|' + branch;
  if (prefList.some(p => (p.code + '|' + p.branch) === key)) {
    pbToast('College already in preference list');
    return;
  }
  const c = findCollegeInPools(code, branch);
  if (c) {
    const pct = parseFloat(document.getElementById('inPct').value) || 0;
    prefList.push({ ...c, isAspirational: c.percentile > pct });
    renderPrefList();
    renderSplitPredictorResults();
    triggerAutosave();
    pbToast('Added ' + c.instituteName);
  }
}

function dropItem(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (hoveredPrefRow) {
    hoveredPrefRow.classList.remove('drag-over');
    hoveredPrefRow = null;
  }
  document.querySelectorAll('.pref-item').forEach(el => el.classList.remove('drag-over', 'dragging'));
  
  const prefRow = e.target.closest('.pref-item');
  if (!prefRow) return;
  let targetIdx = +prefRow.dataset.idx;
  const firstNonFixedIdx = prefList.findIndex(p => !p.isFixed);
  let insertIdx = targetIdx < firstNonFixedIdx ? firstNonFixedIdx : targetIdx;
  
  const isTemplateMode = (typeof isAdminTemplateEditingMode !== 'undefined' && isAdminTemplateEditingMode);
  if (draggedPredictorCollege) {
    if (!isTemplateMode && insertIdx < 6) {
      insertIdx = 6;
    }
    const key = draggedPredictorCollege.code + '|' + draggedPredictorCollege.branch;
    if (prefList.some(p => (p.code + '|' + p.branch) === key)) {
      pbToast('College already in preference list');
      draggedPredictorCollege = null;
      return;
    }
    
    const c = findCollegeInPools(draggedPredictorCollege.code, draggedPredictorCollege.branch);
    if (c) {
      const pct = parseFloat(document.getElementById('inPct').value) || 0;
      prefList.splice(insertIdx, 0, { ...c, isAspirational: c.percentile > pct });
      renderPrefList();
      renderSplitPredictorResults();
      triggerAutosave();
      pbToast('Added ' + c.instituteName);
    }
    draggedPredictorCollege = null;
  } else if (dragIdx !== null) {
    if (!isTemplateMode) {
      if (dragIdx < 6 && insertIdx >= 6) {
        insertIdx = 5;
      } else if (dragIdx >= 6 && insertIdx < 6) {
        insertIdx = 6;
      }
    }
    if (dragIdx === insertIdx) {
      dragIdx = null;
      return;
    }
    const [moved] = prefList.splice(dragIdx, 1);
    prefList.splice(insertIdx, 0, moved);
    dragIdx = null;
    renderPrefList();
    triggerAutosave();
  }
}

function dropOnTbody(e) {
  if (e.target.closest('.pref-item')) return; // handled by dropItem
  e.preventDefault();
  
  if (draggedPredictorCollege) {
    const key = draggedPredictorCollege.code + '|' + draggedPredictorCollege.branch;
    if (prefList.some(p => (p.code + '|' + p.branch) === key)) {
      pbToast('College already in preference list');
      draggedPredictorCollege = null;
      return;
    }
    
    const c = findCollegeInPools(draggedPredictorCollege.code, draggedPredictorCollege.branch);
    if (c) {
      const pct = parseFloat(document.getElementById('inPct').value) || 0;
      prefList.push({ ...c, isAspirational: c.percentile > pct });
      renderPrefList();
      renderSplitPredictorResults();
      triggerAutosave();
      pbToast('Added ' + c.instituteName);
    }
    draggedPredictorCollege = null;
  }
}

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
  
  if (targetItem && targetItem !== touchElement) {
    if (hoveredPrefRow !== targetItem) {
      if (hoveredPrefRow) {
        hoveredPrefRow.classList.remove('drag-over');
      }
      targetItem.classList.add('drag-over');
      hoveredPrefRow = targetItem;
    }
  } else {
    if (hoveredPrefRow) {
      hoveredPrefRow.classList.remove('drag-over');
      hoveredPrefRow = null;
    }
  }
  e.preventDefault();
}
function handleTouchEnd(e) {
  if (!touchElement) return;
  const touch = e.changedTouches[0];
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  const targetItem = target ? target.closest('.pref-item') : null;
  if (targetItem) {
    const targetIdx = parseInt(targetItem.dataset.idx);
    const firstNonFixedIdx = prefList.findIndex(p => !p.isFixed);
    let insertIdx = targetIdx < firstNonFixedIdx ? firstNonFixedIdx : targetIdx;
    
    const isTemplateMode = (typeof isAdminTemplateEditingMode !== 'undefined' && isAdminTemplateEditingMode);
    if (dragIdx !== null) {
      if (!isTemplateMode) {
        if (dragIdx < 6 && insertIdx >= 6) {
          insertIdx = 5;
        } else if (dragIdx >= 6 && insertIdx < 6) {
          insertIdx = 6;
        }
      }
      if (dragIdx !== insertIdx) {
        const [moved] = prefList.splice(dragIdx, 1);
        prefList.splice(insertIdx, 0, moved);
        renderPrefList();
        triggerAutosave();
      }
    }
  }
  if (hoveredPrefRow) {
    hoveredPrefRow.classList.remove('drag-over');
    hoveredPrefRow = null;
  }
  document.querySelectorAll('.pref-item').forEach(el => el.classList.remove('dragging', 'drag-over'));
  touchElement = null; dragIdx = null;
}

function dragEnd(e) { 
  dragIdx = null; 
  draggedPredictorCollege = null;
  if (hoveredPrefRow) {
    hoveredPrefRow.classList.remove('drag-over');
    hoveredPrefRow = null;
  }
  document.querySelectorAll('.pref-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over');
    el.setAttribute('draggable', 'false');
  });
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

function handleAddSuggestion(code, branch, isAspirational = false) {
  // Search in matched pool first
  let c = [...matchedColleges, ...suggestionPool].find(r => r.code === code && r.branch === branch);

  // If not found (manual search), enrich from cutoffData and metadata
  if (!c) {
    const isJee = (window.currentExamType === 'JEE');
    const activeCutoffData = isJee ? (jeeCutoffData || []) : cutoffData;
    const raw = activeCutoffData.find(r => r.code === code && r.branch === branch);
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
  const gender = document.getElementById('inGender').value;
  const region = selectedRegions.length > 0 ? selectedRegions.join(', ') : 'All Regions';
  const isLadies = gender === 'Female-only';
  const catDisplay = (isLadies ? 'Ladies ' : '') + cat;

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
  doc.text('MHT-CET Preference List Report', 14, 28);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  // Include student name in header if available
  let headerLine = `Rank: ${rank} | Category: ${catDisplay} | Region: ${region}`;
  if (currentStudentInfo && currentStudentInfo.name) {
    headerLine = `Student: ${currentStudentInfo.name} | ${headerLine}`;
  }
  doc.text(headerLine, 14, 34);

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
  profileRows.push(['Percentile', pct + '%']);
  profileRows.push(['Merit Rank', rank]);
  profileRows.push(['Category', catDisplay]);
  profileRows.push(['Region Preference', region]);

  doc.autoTable({
    startY: 48,
    head: [['Field', 'Details']],
    body: profileRows,
    theme: 'plain',
    headStyles: { fillColor: [249, 250, 251], textColor: [107, 114, 128], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 }
  });

  // Preference Table
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text('Your Preference Order', 14, doc.lastAutoTable.finalY + 15);

  const user = getSession();
  const isPremium = user && (user.role === 'premium' || user.role === 'admin');
  const itemsToExport = isPremium ? prefList : prefList.slice(0, 10);

  const tableData = itemsToExport.map((c, i) => [
    i + 1,
    c.instituteName || c.name,
    c.branch,
    c.code,
    c.percentile ? c.percentile.toFixed(2) + '%' : 'N/A'
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
    startY: doc.lastAutoTable.finalY + 20,
    head: [['#', 'Institute Name', 'Branch', 'Code', 'Cutoff']],
    body: tableData,
    rowPageBreak: 'avoid',
    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 84 },
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

  const pdfName = currentStudentInfo && currentStudentInfo.name
    ? `MHTCET_Preferences_${currentStudentInfo.name.replace(/\s+/g, '_')}.pdf`
    : `MHTCET_Preferences_${rank || 'List'}.pdf`;
  doc.save(pdfName);
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

/* ══════ STUDENT DETAILS MODAL (Admin) ══════ */
function showStudentModal() {
  currentStudentInfo = null;
  // Reset modal state
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
  // Clear selection when switching
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

    // Cache users list to avoid repeated Firestore calls
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
  // Show selected user card
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
  // Now proceed with the actual form creation
  currentFormId = null;
  prefList = [...FIXED_ASPIRATIONAL];
  selectedColleges = [];
  selectedBranches = new Set();
  if (prefLocked) lockProfileFields();
  else unlockProfileFields();
  renderEditStatus();
  goStep(1);
}

/* ══════ PREF DATA SAVE/LOAD ══════ */
// Duplicate functions removed and moved to top or merged.

// ── Dashboard Data Loader ──
async function loadSavedPrefData() {
  if (!currentUserId) return;
  const res = await authApi('getPrefData', { userId: currentUserId });
  if (res.ok) {
    const user = getSession();
    const isAdmin = user && user.role === 'admin';
    prefDataLoaded = true;
    prefEditCount = res.data.editCount || 0;
    prefLocked = !isAdmin && prefEditCount >= 3;
    allForms = res.data.forms || [];

    // Pre-fill fields from the most recent form for convenience
    if (allForms.length > 0) {
      const latest = allForms[0];
      document.getElementById('inPct').value = latest.percentile || '';
      document.getElementById('inRank').value = latest.rank || '';
      
      let genderVal = latest.gender;
      let categoryVal = latest.category || 'OPEN';
      if (!genderVal) {
        if (categoryVal.startsWith('L') && categoryVal !== 'L') {
          genderVal = 'Female-only';
          categoryVal = categoryVal.substring(1);
        } else {
          genderVal = 'Gender-Neutral';
        }
      }
      document.getElementById('inCategory').value = categoryVal;
      document.getElementById('inGender').value = genderVal;
      selectedRegions = latest.selectedRegions || (latest.region ? [latest.region] : []);
      renderRegionChips();
    }

    renderEditStatus();

    // Show Dashboard
    const dashSec = document.getElementById('dashboardDrafts');
    const dashList = document.getElementById('dashboardDraftsList');
    if (dashSec && dashList) {
      if (allForms.length > 0) {
        dashSec.style.display = 'block';
        dashList.innerHTML = allForms.map(form => {
          const date = form.updatedAt ? new Date(form.updatedAt.toDate ? form.updatedAt.toDate() : form.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recently';
          const studentInfo = form.studentInfo;
          const studentLine = studentInfo && studentInfo.name
            ? `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;font-weight:700;color:var(--ink2)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                ${escH(studentInfo.name)}${studentInfo.email ? ' · ' + escH(studentInfo.email) : ''}
              </div>`
            : '';
          const templateLine = form.sourceTemplate && form.sourceTemplate.templateName
            ? `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;font-weight:700;color:var(--brand)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                From Template: ${escH(form.sourceTemplate.templateName)}
              </div>`
            : '';
          return `<div class="col-card dashboard-form-card" style="text-align: left; border: 1px solid var(--stroke); padding: 20px; cursor: default; margin-bottom: 12px">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px">
              <div>
                <div style="font-weight: 800; color: var(--brand); font-size: 17px">Preference List</div>
                <div style="font-size: 11px; color: var(--muted); margin-top: 2px; display: flex; align-items: center; gap: 4px">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  ${date}
                </div>
                ${studentLine}
                ${templateLine}
              </div>
              <div style="display: flex; gap: 8px; align-items: center">
                <div style="background: var(--brand-soft); color: var(--brand); padding: 3px 10px; border-radius: 6px; font-size: 9px; font-weight: 800; border: 1px solid var(--brand-ring); text-transform: uppercase">ID: ${form.id.slice(-4)}</div>
                <button onclick="deleteForm('${form.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center" title="Delete Draft">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
            
            <div class="dash-card-stats" style="margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 16px; border: 1px solid var(--stroke); display: flex; flex-direction: column; gap: 12px">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px">
                <span style="font-weight: 800; color: var(--ink)">${form.percentile || '??'}% Percentile</span>
                <span style="font-weight: 700; color: var(--brand); font-size: 11px">Strategy: ${form.colType || 'All Colleges'}</span>
              </div>
              <div style="font-size: 12px; font-weight: 600; color: var(--ink2); padding-top: 8px; border-top: 1px dashed var(--stroke); display: flex; justify-content: space-between">
                <span>Category: ${(() => {
                  const catVal = form.category || 'OPEN';
                  const isLadies = form.gender === 'Female-only' || (catVal.startsWith('L') && catVal !== 'L');
                  const base = (catVal.startsWith('L') && catVal !== 'L') ? catVal.substring(1) : catVal;
                  const label = base === 'OBC' ? 'OBC' :
                                base === 'SC' ? 'Scheduled Caste' :
                                base === 'ST' ? 'Scheduled Tribe' :
                                base === 'VJ/DT' ? 'VJ / DT / NT-A' :
                                base === 'NT1' ? 'NT-B' :
                                base === 'NT2' ? 'NT-C' :
                                base === 'NT3' ? 'NT-D' :
                                base === 'EWS' ? 'EWS' :
                                base === 'TFWS' ? 'TFWS' :
                                base === 'OPEN' ? 'Open' : base;
                  return (isLadies ? 'Ladies ' : '') + label;
                })()}</span>
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
    loadDashboardTemplates();
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
  ['inPct', 'inRank'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = false; el.style.opacity = '1'; el.style.cursor = ''; }
  });
}

function enableEditing() {
  const user = getSession();
  const isAdmin = user && user.role === 'admin';
  const remaining = 3 - prefEditCount;
  
  if (isAdmin) {
    unlockProfileFields();
    let saveWrap = document.getElementById('saveProfileWrap');
    if (saveWrap) saveWrap.style.display = 'flex';
    document.getElementById('editStatusWrap').style.opacity = '0.4';
    return;
  }

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
  const gender = document.getElementById('inGender').value;
  const homeUniv = (document.getElementById('inHomeUniv') || {}).value || '';
  const examType = window.currentExamType || 'MHT-CET';
  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
  const res = await authApi('savePrefData', {
    userId: currentUserId,
    formId: currentFormId,
    percentile: pct,
    rank: rank,
    category: cat,
    gender: gender,
    region: selectedRegions.length === 1 ? selectedRegions[0] : '', // backward compat
    selectedRegions: selectedRegions,
    homeUniv: homeUniv,
    examType: examType,
    prefList: prefList,
    selectedBranches: Array.from(selectedBranches),
    selectedCollegeKeys: selectedColleges.map(idx => matchedColleges[idx] ? matchedColleges[idx].code + '|' + matchedColleges[idx].branch : '').filter(Boolean),
    currentStep: currentStep,
    colType: document.getElementById('inColType').value,
    minority: document.getElementById('inMinority').value,
    studentInfo: currentStudentInfo || null,
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

/* ══════ TEMPLATE LIBRARY ══════ */
let loadedTemplates = [];
let loadedAdminTemplates = [];
let currentPreviewTemplateId = null;
let currentEditingTemplateId = null;
let adminTempListColleges = []; // Array of {code, instituteName, branch, percentile, selected}
let currentTplPctFilter = 'all';
let currentTplBranchFilter = 'all';

let tplActiveCategoryKey = null;

async function openTemplateLibrary() {
  goStep(5);
  tplActiveCategoryKey = null; // Reset category view
  const container = document.getElementById('tplLibraryContent');
  if (container) {
    container.innerHTML = '<div class="pb-loader"><div class="pb-spinner"></div><span>Loading templates...</span></div>';
  }
  const res = await authApi('getTemplates', {});
  if (res.ok) {
    loadedTemplates = res.data || [];
    filterTemplates();
  } else {
    if (container) {
      container.innerHTML = `<div style="color:var(--brand);text-align:center;padding:20px">${escH(res.error || 'Failed to load templates')}</div>`;
    }
  }
}

function filterTplByPct(pctRange, btn) {
  currentTplPctFilter = pctRange;
  const parent = document.getElementById('tplPctFilter');
  if (parent) {
    parent.querySelectorAll('.tpl-fchip').forEach(c => c.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  tplActiveCategoryKey = null; // Reset active category key when a filter chip is clicked
  filterTemplates();
}

function filterTplByBranch(branchGroup, btn) {
  currentTplBranchFilter = branchGroup;
  const parent = document.getElementById('tplBranchFilter');
  if (parent) {
    parent.querySelectorAll('.tpl-fchip').forEach(c => c.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  tplActiveCategoryKey = null; // Reset active category key when a filter chip is clicked
  filterTemplates();
}

function areTplFiltersActive() {
  const pct = currentTplPctFilter !== 'all';
  const branch = currentTplBranchFilter !== 'all';
  const regionSelect = document.getElementById('tplRegionFilter');
  const region = regionSelect ? regionSelect.value !== '' : false;
  const specialSelect = document.getElementById('tplSpecialFilter');
  const special = specialSelect ? specialSelect.value !== '' : false;
  return pct || branch || region || special;
}

function getTplCategory(t) {
  if (t.filters?.minority || t.filters?.collegeType === 'Autonomous' || (t.tags || []).some(tag => ['minority', 'muslim', 'jain', 'government', 'autonomous'].includes(tag.toLowerCase()))) {
    return 'special';
  }
  if (t.filters?.region || (t.tags || []).some(tag => ['mumbai', 'pune', 'nagpur', 'nashik', 'aurangabad', 'amravati'].includes(tag.toLowerCase()))) {
    return 'region';
  }
  if ((t.filters?.branchGroup && t.filters.branchGroup !== 'all') || (t.tags || []).some(tag => ['computer', 'electronics', 'core', 'biotech'].includes(tag.toLowerCase()))) {
    return 'branch';
  }
  return 'percentile';
}

function getGradientForTpl(t) {
  const name = (t.name || '').toLowerCase();
  const tags = (t.tags || []).map(tg => tg.toLowerCase());
  
  if (tags.includes('mumbai') || name.includes('mumbai')) {
    return 'linear-gradient(135deg, #1e3a8a, #3b82f6)';
  }
  if (tags.includes('pune') || name.includes('pune')) {
    return 'linear-gradient(135deg, #064e3b, #10b981)';
  }
  if (tags.includes('nagpur') || name.includes('nagpur')) {
    return 'linear-gradient(135deg, #311042, #701a75)';
  }
  if (tags.includes('minority') || name.includes('minority') || tags.includes('muslim') || tags.includes('jain')) {
    return 'linear-gradient(135deg, #78350f, #d97706)';
  }
  if (tags.includes('government') || tags.includes('autonomous') || name.includes('government')) {
    return 'linear-gradient(135deg, #b91c1c, #f87171)';
  }
  
  return 'linear-gradient(135deg, #dc2626, #f43f5e)';
}

function getBadgeForTpl(t) {
  const name = (t.name || '').toLowerCase();
  const tags = (t.tags || []).map(tg => tg.toLowerCase());
  
  if (tags.includes('mumbai') || name.includes('mumbai')) return 'Mumbai Region';
  if (tags.includes('pune') || name.includes('pune')) return 'Pune Region';
  if (tags.includes('nagpur') || name.includes('nagpur')) return 'Nagpur Region';
  if (tags.includes('minority') || name.includes('minority')) return 'Minority Quota';
  if (tags.includes('government') || name.includes('government')) return 'Govt / Aided';
  
  return 'General List';
}

function resetTplFilters() {
  currentTplPctFilter = 'all';
  currentTplBranchFilter = 'all';
  
  document.querySelectorAll('#tplPctFilter .tpl-fchip').forEach(c => c.classList.toggle('active', c.dataset.pct === 'all'));
  document.querySelectorAll('#tplBranchFilter .tpl-fchip').forEach(c => c.classList.toggle('active', c.dataset.bg === 'all'));
  
  const regionSelect = document.getElementById('tplRegionFilter');
  if (regionSelect) regionSelect.value = '';
  
  const specialSelect = document.getElementById('tplSpecialFilter');
  if (specialSelect) specialSelect.value = '';
  
  tplActiveCategoryKey = null;
  filterTemplates();
}

function showCategoryAll(key) {
  tplActiveCategoryKey = key;
  filterTemplates();
}

function getCounselorForTpl(t) {
  const name = (t.name || '').toLowerCase();
  const tags = (t.tags || []).map(tg => tg.toLowerCase());
  
  if (tags.includes('mumbai') || name.includes('mumbai')) {
    return { name: 'Kalpesh Hiwase', badgeBg: '#ea580c' }; // Orange
  }
  if (tags.includes('pune') || name.includes('pune')) {
    return { name: 'Prof. Sandip Kale', badgeBg: '#10b981' }; // Green
  }
  if (tags.includes('electronics') || tags.includes('core') || name.includes('electronics') || name.includes('core')) {
    return { name: 'Prof. Rohan Tamture', badgeBg: '#0891b2' }; // Cyan
  }
  if (tags.includes('minority') || tags.includes('special') || name.includes('minority') || tags.includes('muslim') || tags.includes('jain')) {
    return { name: 'Dr. Umesh Moharil', badgeBg: '#c026d3' }; // Pink
  }
  return { name: 'Prof. Nilima Jagtap', badgeBg: '#e11d48' }; // Rose
}

function renderCardsHtml(list, isScrollable = false) {
  if (list.length === 0) {
    return `<div style="padding:20px; text-align:center; color:var(--muted); font-size:13px; grid-column:1/-1">No templates found in this section.</div>`;
  }
  
  return list.map(t => {
    const colCount = t.prefList?.length || 0;
    const usage = t.usageCount || 0;
    const gradient = getGradientForTpl(t);
    const scrollStyle = isScrollable ? 'style="width: 240px; flex-shrink: 0; scroll-snap-align: start;"' : '';
    const counselor = getCounselorForTpl(t);

    return `<div class="tpl-card-v2" ${scrollStyle} onclick="previewTemplate('${t.id}')">
      <div class="tpl-card-banner" style="background: ${gradient}">
        <div class="tpl-banner-tag">${escH(getBadgeForTpl(t))}</div>
        <div class="tpl-banner-accent">MHT-CET 2026</div>
        <div class="tpl-banner-title" style="max-width: 100%;">${escH(t.name)}</div>
        <div style="z-index: 3; margin-top: 4px;">
          <span style="background: ${counselor.badgeBg}; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${escH(counselor.name)}</span>
        </div>
      </div>
      <div class="tpl-card-body" style="padding: 14px 16px; display: flex; flex-direction: column; flex: 1; min-height: 70px; justify-content: space-between">
        <h4 style="font-family:'Lexend',sans-serif; font-weight: 800; font-size: 13px; color: var(--ink); line-height: 1.4; margin: 0 0 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis">${escH(t.name)}</h4>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--muted); font-weight: 500; border-top: 1px dashed var(--stroke); padding-top: 8px; margin-top: auto">
          <span style="display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg> ${colCount} Colleges</span>
          <span style="display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg> Used ${usage} times</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterTemplates() {
  let filtered = loadedTemplates || [];

  // 1. Percentile filter
  if (currentTplPctFilter !== 'all') {
    filtered = filtered.filter(t => {
      const min = t.filters?.percentileMin || 0;
      const max = t.filters?.percentileMax || 100;
      if (currentTplPctFilter === '95-100') {
        return max >= 95;
      } else if (currentTplPctFilter === '90-95') {
        return min >= 90 && min <= 95;
      } else if (currentTplPctFilter === '85-90') {
        return min >= 85 && min <= 90;
      } else if (currentTplPctFilter === '80-85') {
        return min >= 80 && min <= 85;
      } else if (currentTplPctFilter === '70-80') {
        return min >= 70 && min <= 80;
      }
      return true;
    });
  }

  // 2. Branch Group filter
  if (currentTplBranchFilter !== 'all') {
    filtered = filtered.filter(t => {
      return (t.filters?.branchGroup || '').toLowerCase() === currentTplBranchFilter.toLowerCase();
    });
  }

  // 3. Region filter
  const regionSelect = document.getElementById('tplRegionFilter');
  const regionVal = regionSelect ? regionSelect.value : '';
  if (regionVal) {
    filtered = filtered.filter(t => {
      return (t.filters?.region || '').toLowerCase() === regionVal.toLowerCase();
    });
  }

  // 4. Special filter
  const specialSelect = document.getElementById('tplSpecialFilter');
  const specialVal = specialSelect ? specialSelect.value : '';
  if (specialVal) {
    filtered = filtered.filter(t => {
      const type = (t.filters?.collegeType || '').toLowerCase();
      const mino = (t.filters?.minority || '').toLowerCase();
      if (specialVal === 'minority') {
        return !!mino;
      } else if (specialVal === 'government') {
        return type === 'government' || type === 'aided';
      } else if (specialVal === 'autonomous') {
        return type === 'autonomous';
      }
      return true;
    });
  }

  renderTemplates(filtered);
}

function renderTemplates(templates) {
  const container = document.getElementById('tplLibraryContent');
  if (!container) return;

  const filtersActive = areTplFiltersActive();

  // If filters are active or a single category is being shown, render a grid list
  if (filtersActive || tplActiveCategoryKey) {
    let list = templates;
    let title = 'Search Results';
    
    if (tplActiveCategoryKey) {
      list = templates.filter(t => getTplCategory(t) === tplActiveCategoryKey);
      const catNames = {
        'percentile': 'Percentile-based Templates',
        'region': 'Region-specific Templates',
        'special': 'Minority & Special Lists',
        'branch': 'Branch-focused Templates'
      };
      title = catNames[tplActiveCategoryKey] || 'Templates';
    }

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px">
        <h3 style="font-family:'Lexend',sans-serif; font-weight:800; font-size:18px; color:var(--ink); margin:0">
          ${title} <span style="font-size:13px; font-weight:600; color:var(--muted)">(${list.length} templates)</span>
        </h3>
        <button class="pb-btn pb-btn-ghost" onclick="resetTplFilters()" style="padding:8px 16px; font-size:12px">
          &larr; Back to Categories
        </button>
      </div>
      <div class="tpl-grid" id="tplGrid">
        ${renderCardsHtml(list)}
      </div>
    `;
    return;
  }

  // Otherwise show horizontal scroll categories
  const categories = [
    { key: 'percentile', title: 'Percentile-based Templates', desc: 'Curated preference lists matching specific CET score brackets.' },
    { key: 'region', title: 'Region-specific Templates', desc: 'Highly requested lists focusing on top institutions in Mumbai, Pune, Nagpur, etc.' },
    { key: 'special', title: 'Minority & Special Lists', desc: 'Government, Autonomous, and Religious/Linguistic minority lists.' },
    { key: 'branch', title: 'Branch-focused Templates', desc: 'Sorted preference guides categorized by branch fields.' }
  ];

  let html = '';
  categories.forEach(cat => {
    const catTemplates = templates.filter(t => getTplCategory(t) === cat.key);
    if (catTemplates.length === 0) return;

    html += `
      <div class="tpl-category-section" style="margin-bottom: 36px">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px">
          <h3 style="font-family:'Lexend',sans-serif; font-weight:800; font-size:16px; color:var(--ink); margin:0">${cat.title}</h3>
          <button class="tpl-show-all-btn" onclick="showCategoryAll('${cat.key}')">
            Show All
          </button>
        </div>
        <div class="tpl-row-scroll" style="display:flex; gap:16px; overflow-x:auto; padding: 4px 4px 12px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch">
          ${renderCardsHtml(catTemplates, true)}
        </div>
      </div>
    `;
  });

  container.innerHTML = html || `
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      <h3>No Templates</h3>
      <p>Please contact admin to seed or add templates.</p>
    </div>
  `;
}

function previewTemplate(id) {
  const t = loadedTemplates.find(x => x.id === id);
  if (!t) return;
  currentPreviewTemplateId = id;
  document.getElementById('tplPreviewTitle').textContent = t.name;
  document.getElementById('tplPreviewDesc').textContent = t.description || 'No description.';
  
  const tagsWrap = document.getElementById('tplPreviewTags');
  tagsWrap.innerHTML = (t.tags || []).map(tag => `<span class="tpl-tag">${escH(tag)}</span>`).join('');
  
  const colleges = t.prefList || [];
  document.getElementById('tplPreviewCount').textContent = colleges.length;

  const listWrap = document.getElementById('tplPreviewList');
  if (colleges.length === 0) {
    listWrap.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">No colleges in this template.</div>';
  } else {
    listWrap.innerHTML = colleges.map((c, idx) => {
      const tags = [];
      if (c.isGov) tags.push('<span class="col-tag gov" style="font-size:9px;padding:2px 6px">Govt</span>');
      if (c.isAuto) tags.push('<span class="col-tag auto" style="font-size:9px;padding:2px 6px">Auto</span>');
      return `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--stroke)">
        <div style="min-width:0; flex:1; padding-right:12px">
          <div style="font-size:13px; font-weight:800; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${idx + 1}. ${escH(c.instituteName)}</div>
          <div style="font-size:11px; color:var(--muted); margin-top:3px; display:flex; align-items:center; gap:6px; flex-wrap:wrap">
            <span style="font-weight:700; color:var(--brand)">${escH(c.branch)}</span>
            ${tags.join('')}
          </div>
        </div>
        <div style="font-size:12px; font-weight:800; color:var(--ink); flex-shrink:0; text-align:right">
          <div>${c.percentile ? c.percentile.toFixed(2) + '%' : 'N/A'}</div>
          <div style="font-size:9px; font-weight:500; color:var(--muted); margin-top:2px">Code: ${c.code}</div>
        </div>
      </div>`;
    }).join('');
  }

  const modal = document.getElementById('tplPreviewModal');
  if (modal) modal.classList.add('show');
}

function closeTplPreview() {
  const modal = document.getElementById('tplPreviewModal');
  if (modal) modal.classList.remove('show');
}

function applyCurrentTemplate() {
  if (currentPreviewTemplateId) {
    useTemplate(currentPreviewTemplateId);
  }
}

async function useTemplate(templateId) {
  const user = getSession();
  if (!user) {
    pbToast('Please log in first.');
    return;
  }
  pbToast('Applying template...', 3000);
  const res = await authApi('applyTemplate', { userId: currentUserId, templateId });
  if (res.ok) {
    pbToast('Template applied successfully!');
    closeTplPreview();
    const formId = res.data.formId;
    await loadSavedPrefData();
    loadForm(formId, 3);
  } else {
    pbToast(res.error || 'Failed to apply template.');
  }
}

/* ─── ADMIN TEMPLATE MANAGEMENT ─── */
async function openAdminTemplateManager() {
  const modal = document.getElementById('adminTplManagerModal');
  if (modal) modal.classList.add('show');
  
  const listEl = document.getElementById('adminTplManagerList');
  if (listEl) {
    listEl.innerHTML = '<div class="pb-loader"><div class="pb-spinner"></div><span>Loading all templates...</span></div>';
  }
  
  const res = await authApi('getAllTemplates', {});
  if (res.ok) {
    loadedAdminTemplates = res.data || [];
    renderAdminTemplatesList(loadedAdminTemplates);
  } else {
    if (listEl) listEl.innerHTML = `<div style="color:var(--brand);text-align:center;padding:20px">${escH(res.error || 'Failed to load templates')}</div>`;
  }
}

function closeAdminTplManager() {
  const modal = document.getElementById('adminTplManagerModal');
  if (modal) modal.classList.remove('show');
}



function generateCollegeListForParams(filters) {
  const pctMin = filters.percentileMin !== undefined && filters.percentileMin !== null && filters.percentileMin !== '' ? parseFloat(filters.percentileMin) : 0;
  const pctMax = filters.percentileMax !== undefined && filters.percentileMax !== null && filters.percentileMax !== '' ? parseFloat(filters.percentileMax) : 100;
  const rankMin = filters.rankMin !== undefined && filters.rankMin !== null && filters.rankMin !== '' ? parseInt(filters.rankMin) : 0;
  const rankMax = filters.rankMax !== undefined && filters.rankMax !== null && filters.rankMax !== '' ? parseInt(filters.rankMax) : 1000000;

  const hasPctRange = (filters.percentileMin !== undefined && filters.percentileMin !== null && filters.percentileMin !== '');
  const hasRankRange = (filters.rankMin !== undefined && filters.rankMin !== null && filters.rankMin !== '');

  const bg = filters.branchGroup || 'all';
  const region = filters.region || '';
  const category = filters.category || 'OPEN';
  const colType = filters.collegeType || '';
  const minority = filters.minority || '';

  const catMap = { 'OPEN': 'OPEN', 'OBC': 'OBC', 'SC': 'SC', 'ST': 'ST', 'VJ/DT': 'VJ', 'NT1': 'NT1', 'NT2': 'NT2', 'NT3': 'NT3', 'EWS': 'EWS', 'TFWS': 'TFWS' };
  const searchCat = catMap[category] || 'OPEN';

  const metaMap = {};
  collegeMetadata.forEach(c => metaMap[c.code] = c);

  let filtered = cutoffData.filter(r => {
    if (hasPctRange) {
      if (r.percentile < pctMin || r.percentile > pctMax) return false;
    }
    if (hasRankRange) {
      if (r.rank < rankMin || r.rank > rankMax) return false;
    }
    if (bg !== 'all') {
      const cat = categorizeBranch(r.branch);
      if (bg === 'computer' && cat !== 'Computer & IT') return false;
      if (bg === 'electronics' && cat !== 'Electronics & Telecom') return false;
      if (bg === 'core' && cat !== 'Core Engineering') return false;
      if (bg === 'biotech' && cat !== 'Biotech & Allied') return false;
    }
    const meta = metaMap[r.code] || {};
    const statusLower = (meta.status || '').toLowerCase();
    if (colType) {
      if (colType === 'Government' && !statusLower.includes('government')) return false;
      if (colType === 'Aided' && !statusLower.includes('aided')) return false;
      if (colType === 'Autonomous' && !statusLower.includes('autonomous')) return false;
      if (colType === 'Un-Aided' && (statusLower.includes('government') || statusLower.includes('aided'))) return false;
    }
    if (region) {
      const nameLower = (meta.name || r.name || '').toLowerCase();
      if (!nameLower.includes(region.toLowerCase())) return false;
    }
    if (minority) {
      if (!statusLower.includes('minority') || !statusLower.includes(minority.toLowerCase())) return false;
    }
    const isMatchingMinorityCollege = minority && statusLower.includes('minority') && statusLower.includes(minority.toLowerCase());
    const activeSearchCat = isMatchingMinorityCollege ? 'OPEN' : searchCat;
    if (activeSearchCat !== 'OPEN' && !(r.seatType || '').includes(activeSearchCat)) return false;
    if (activeSearchCat === 'OPEN' && !(r.seatType || '').includes('OPEN')) return false;

    // Exclude women-only and ladies seats from templates
    const isWomenOnly = (meta.name || r.name || '').toLowerCase().includes('women') || (meta.name || r.name || '').toLowerCase().includes('girls') || (meta.status || '').toLowerCase().includes('women') || (meta.status || '').toLowerCase().includes('girls') || r.code === '3035';
    if (isWomenOnly) return false;
    if ((r.seatType || '').startsWith('L')) return false;

    return true;
  });

  const groups = {};
  filtered.forEach(r => {
    const key = r.code + '|' + r.branch;
    if (!groups[key] || r.percentile > groups[key].percentile) {
      groups[key] = r;
    }
  });

  let results = Object.values(groups).map(r => {
    const meta = metaMap[r.code] || {};
    return {
      code: r.code,
      instituteName: meta.name || r.name,
      branch: r.branch,
      percentile: r.percentile,
      isGov: (meta.status || '').toLowerCase().includes('government'),
      isAided: (meta.status || '').toLowerCase().includes('aided'),
      isAuto: (meta.status || '').toLowerCase().includes('autonomous'),
      isMinority: (meta.status || '').toLowerCase().includes('minority'),
      minorityType: extractMinority(meta.status || '')
    };
  });

  results.sort((a, b) => b.percentile - a.percentile);
  return results.slice(0, 35); // 35 colleges max
}



async function deleteTemplate(templateId) {
  if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) return;
  const res = await authApi('deleteTemplate', { templateId });
  if (res.ok) {
    pbToast('Template deleted.');
    const allRes = await authApi('getAllTemplates', {});
    if (allRes.ok) {
      renderAdminTemplatesList(allRes.data);
    }
  } else {
    pbToast('Error deleting template: ' + res.error);
  }
}



async function createNewTemplateInBuilder() {
  // Initialize admin mode variables
  isAdminTemplateEditingMode = true;
  editingTemplateId = null;
  editingTemplateName = '';
  editingTemplateDesc = '';
  editingTemplateTags = [];
  editingTemplateIsPublished = true;
  editingTemplateFilters = {
    percentileMin: 95,
    percentileMax: 99.9,
    branchGroup: 'all',
    region: '',
    category: 'OPEN',
    collegeType: '',
    minority: ''
  };

  // Reset/Initialize Builder State
  prefList = [...FIXED_ASPIRATIONAL];
  selectedBranches = new Set();
  prefList.forEach(c => {
    if (c.branch) selectedBranches.add(c.branch);
  });
  renderBranches();
  selectedColleges = [];
  currentFormId = null;

  // Clear inputs in Step 1
  document.getElementById('inPct').value = '95';
  document.getElementById('inRank').value = '5000';
  document.getElementById('inPctMin').value = '95';
  document.getElementById('inPctMax').value = '99.9';
  document.getElementById('inRankMin').value = '';
  document.getElementById('inRankMax').value = '';
  document.getElementById('inCategory').value = 'OPEN';
  document.getElementById('inGender').value = 'Gender-Neutral';
  selectedRegions = [];
  renderRegionChips();
  document.getElementById('inColType').value = '';
  document.getElementById('inMinority').value = '';

  // Setup Admin Banner & UI
  setupAdminBuilderUI('');

  // Close manager modal & navigate
  closeAdminTplManager();
  goStep(1);
}

function editTemplateInBuilder(id) {
  const allRes = loadedAdminTemplates || [];
  const t = allRes.find(x => x.id === id);
  if (!t) return;

  isAdminTemplateEditingMode = true;
  editingTemplateId = id;
  editingTemplateName = t.name || '';
  editingTemplateDesc = t.description || '';
  editingTemplateTags = t.tags || [];
  editingTemplateIsPublished = t.isPublished !== false;
  editingTemplateFilters = t.filters || {};

  // Load template filters to Step 1 inputs
  document.getElementById('inPct').value = t.filters?.percentileMax || t.filters?.percentileMin || '95';
  document.getElementById('inRank').value = '1000'; // Default placeholder for templates
  document.getElementById('inPctMin').value = t.filters?.percentileMin !== undefined && t.filters?.percentileMin !== null ? t.filters.percentileMin : '';
  document.getElementById('inPctMax').value = t.filters?.percentileMax !== undefined && t.filters?.percentileMax !== null ? t.filters.percentileMax : '';
  document.getElementById('inRankMin').value = t.filters?.rankMin !== undefined && t.filters?.rankMin !== null ? t.filters.rankMin : '';
  document.getElementById('inRankMax').value = t.filters?.rankMax !== undefined && t.filters?.rankMax !== null ? t.filters.rankMax : '';

  document.getElementById('inCategory').value = t.filters?.category || 'OPEN';
  document.getElementById('inGender').value = 'Gender-Neutral';
  selectedRegions = t.filters?.selectedRegions || (t.filters?.region ? [t.filters.region] : []);
  renderRegionChips();
  document.getElementById('inColType').value = t.filters?.collegeType || '';
  document.getElementById('inMinority').value = t.filters?.minority || '';

  // Setup builder state with template's colleges
  prefList = t.prefList || [];
  
  // Pre-select branches matching template's colleges
  selectedBranches = new Set();
  prefList.forEach(c => {
    if (c.branch) selectedBranches.add(c.branch);
  });
  renderBranches(); // Update checkboxes in Step 2

  // Restore matched colleges selection keys for Step 3
  window._tempKeys = prefList.map(c => c.code + '|' + c.branch);
  selectedColleges = [];

  setupAdminBuilderUI(t.name);

  // Close manager modal & navigate
  closeAdminTplManager();
  goStep(1);
}

function setupAdminBuilderUI(name) {
  const banner = document.getElementById('adminModeBanner');
  if (banner) {
    banner.style.display = 'flex';
    document.getElementById('adminModeTplName').textContent = name || 'New Template';
  }

  // Update complete button in Step 4
  const saveBtn = document.getElementById('completeSaveBtn');
  if (saveBtn) {
    saveBtn.innerHTML = `Save Template <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:10px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
    saveBtn.setAttribute('onclick', 'saveTemplateFromBuilder()');
  }

  // Toggle rows
  const userRow = document.getElementById('studentPctRankRow');
  const tplRow = document.getElementById('adminTplRangeRow');
  if (userRow) userRow.style.display = 'none';
  if (tplRow) tplRow.style.display = 'block';

  // Show and populate metadata fields in Step 4
  const metaSection = document.getElementById('adminTemplateMetaSection');
  if (metaSection) {
    metaSection.style.display = 'block';
    document.getElementById('adminMetaName').value = editingTemplateName || '';
    document.getElementById('adminMetaDesc').value = editingTemplateDesc || '';
    document.getElementById('adminMetaTags').value = (editingTemplateTags || []).join(', ');
    document.getElementById('adminMetaPublished').checked = editingTemplateIsPublished !== false;
  }
}

function updateAdminModeTplName(val) {
  editingTemplateName = val;
  const nameEl = document.getElementById('adminModeTplName');
  if (nameEl) {
    nameEl.textContent = val.trim() || 'New Template';
  }
}

async function saveTemplateFromBuilder() {
  const nameInput = document.getElementById('adminMetaName');
  const descInput = document.getElementById('adminMetaDesc');
  const tagsInput = document.getElementById('adminMetaTags');
  const pubInput = document.getElementById('adminMetaPublished');

  const name = nameInput ? nameInput.value.trim() : '';
  const description = descInput ? descInput.value.trim() : '';
  const tagsStr = tagsInput ? tagsInput.value : '';
  const isPublished = pubInput ? pubInput.checked : true;

  if (!name) {
    pbToast('Template name is required.');
    return;
  }

  const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);

  const pctMinVal = document.getElementById('inPctMin').value;
  const pctMaxVal = document.getElementById('inPctMax').value;
  const rankMinVal = document.getElementById('inRankMin').value;
  const rankMaxVal = document.getElementById('inRankMax').value;

  const filters = {
    percentileMin: pctMinVal !== '' ? parseFloat(pctMinVal) : null,
    percentileMax: pctMaxVal !== '' ? parseFloat(pctMaxVal) : null,
    rankMin: rankMinVal !== '' ? parseInt(rankMinVal) : null,
    rankMax: rankMaxVal !== '' ? parseInt(rankMaxVal) : null,
    branchGroup: editingTemplateFilters.branchGroup || 'all',
    region: selectedRegions.length === 1 ? selectedRegions[0] : '', // backward compat
    selectedRegions: selectedRegions,
    category: document.getElementById('inCategory').value,
    collegeType: document.getElementById('inColType').value,
    minority: document.getElementById('inMinority').value
  };

  // The college list is the active prefList!
  const selectedColleges = prefList.map(c => {
    return {
      code: c.code,
      instituteName: c.instituteName,
      branch: c.branch,
      percentile: c.percentile,
      isGov: c.isGov || false,
      isAided: c.isAided || false,
      isAuto: c.isAuto || false,
      isMinority: c.isMinority || false,
      minorityType: c.minorityType || ''
    };
  });

  if (selectedColleges.length === 0) {
    pbToast('Please add at least one college to the template.');
    return;
  }

  const payload = {
    templateId: editingTemplateId,
    name,
    description,
    filters,
    tags,
    prefList: selectedColleges,
    isPublished
  };

  pbToast('Saving template...', 3000);
  const res = await authApi('saveTemplate', payload);
  if (res.ok) {
    pbToast('Template saved successfully!');
    exitAdminTemplateEditingMode();
    const params = new URLSearchParams(window.location.search);
    if (params.has('editTemplate') || params.has('newTemplate')) {
      window.location.href = 'admin.html?tab=templates';
    } else {
      goStep(0);
      openAdminTemplateManager();
    }
  } else {
    pbToast(res.error || 'Failed to save template.');
  }
}

function exitAdminTemplateEditingMode() {
  isAdminTemplateEditingMode = false;
  editingTemplateId = null;
  editingTemplateName = '';
  editingTemplateDesc = '';
  editingTemplateTags = [];
  editingTemplateIsPublished = true;
  editingTemplateFilters = {};
  
  // Hide the admin banner
  const banner = document.getElementById('adminModeBanner');
  if (banner) banner.style.display = 'none';

  // Restore the Step 4 button text/onclick
  const saveBtn = document.getElementById('completeSaveBtn');
  if (saveBtn) {
    saveBtn.innerHTML = `Complete & Save List <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:10px"><path d="M20 6 9 17 4 12"/></svg>`;
    saveBtn.setAttribute('onclick', 'returnToDashboard()');
  }

  // Toggle rows back
  const userRow = document.getElementById('studentPctRankRow');
  const tplRow = document.getElementById('adminTplRangeRow');
  if (userRow) userRow.style.display = 'flex';
  if (tplRow) tplRow.style.display = 'none';

  // Hide metadata fields in Step 4
  const metaSection = document.getElementById('adminTemplateMetaSection');
  if (metaSection) metaSection.style.display = 'none';
}

function handleExitAdminMode() {
  exitAdminTemplateEditingMode();
  const params = new URLSearchParams(window.location.search);
  if (params.has('editTemplate') || params.has('newTemplate')) {
    window.location.href = 'admin.html?tab=templates';
  } else {
    goStep(0);
    openAdminTemplateManager();
  }
}

function renderAdminTemplatesList(templates) {
  const listEl = document.getElementById('adminTplManagerList');
  document.getElementById('adminTplTotalCount').textContent = templates.length + ' templates';
  
  if (templates.length === 0) {
    listEl.innerHTML = '<div style="padding:30px; text-align:center; color:var(--muted)">No templates created yet. Click "New Template" or "Seed Defaults" to start.</div>';
    return;
  }
  
  listEl.innerHTML = templates.map(t => {
    const pubBadge = t.isPublished ? 
      '<span style="background:#dcfce7; color:#16a34a; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px">Published</span>' :
      '<span style="background:#f1f5f9; color:#64748b; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px">Draft</span>';
    
    return `<div class="tpl-mgmt-item">
      <div class="tpl-mgmt-info">
        <div class="tpl-mgmt-name">${escH(t.name)}</div>
        <div class="tpl-mgmt-meta">
          <span>${t.prefList?.length || 0} colleges</span>
          <span>·</span>
          <span>Used ${t.usageCount || 0} times</span>
          <span>·</span>
          ${pubBadge}
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button class="pb-btn pb-btn-ghost" onclick="editTemplateInBuilder('${t.id}')" style="padding:6px 12px; font-size:12px; border-color:var(--brand); color:var(--brand)">Edit</button>
        <button class="pb-btn" onclick="deleteTemplate('${t.id}')" style="padding:6px 12px; font-size:12px; background:none; color:#ef4444; border:1px solid rgba(239, 68, 68, 0.2)">Delete</button>
      </div>
    </div>`;
  }).join('');
}

async function seedDefaultTemplates() {
  if (!confirm('Are you sure you want to seed 12 default templates? This will generate and publish them in the database.')) return;
  
  const seedDefs = [
    {
      name: "Top Computer & IT — Mumbai (95-99%ile)",
      description: "Ideal preference list for high-scoring students seeking CS/IT branches in top-tier Mumbai colleges (VJTI, SPIT, DJ Sanghvi, etc.).",
      tags: ["Mumbai", "Computer", "95-99%ile", "Premium"],
      filters: { percentileMin: 95, percentileMax: 100, branchGroup: "computer", region: "Mumbai", category: "OPEN", collegeType: "", minority: "" }
    },
    {
      name: "Top Computer & IT — Pune (95-99%ile)",
      description: "Ideal preference list for high-scoring students seeking CS/IT branches in top-tier Pune colleges (COEP, PICT, VIT Pune, etc.).",
      tags: ["Pune", "Computer", "95-99%ile", "Premium"],
      filters: { percentileMin: 95, percentileMax: 100, branchGroup: "computer", region: "Pune", category: "OPEN", collegeType: "", minority: "" }
    },
    {
      name: "Mid-Range CS/IT — Mumbai (90-95%ile)",
      description: "Curated preference list for students seeking CS/IT branches in reputable Mumbai colleges.",
      tags: ["Mumbai", "Computer", "90-95%ile", "Premium"],
      filters: { percentileMin: 90, percentileMax: 95, branchGroup: "computer", region: "Mumbai", category: "OPEN", collegeType: "", minority: "" }
    },
    {
      name: "Mid-Range CS/IT — Pune (90-95%ile)",
      description: "Curated preference list for students seeking CS/IT branches in reputable Pune colleges.",
      tags: ["Pune", "Computer", "90-95%ile", "Premium"],
      filters: { percentileMin: 90, percentileMax: 95, branchGroup: "computer", region: "Pune", category: "OPEN", collegeType: "", minority: "" }
    },
    {
      name: "Government & Autonomous Colleges — Maharashtra",
      description: "A comprehensive list focusing on highly reputed Government and Autonomous engineering colleges across all regions.",
      tags: ["Maharashtra", "Government", "Autonomous", "Premium"],
      filters: { percentileMin: 85, percentileMax: 100, branchGroup: "all", region: "", category: "OPEN", collegeType: "Autonomous", minority: "" }
    },
    {
      name: "Electronics & Telecomm — Pune & Mumbai (85-95%ile)",
      description: "Preference list for students looking for Electronics / ENTC / Instrumentation branches in Mumbai and Pune's best colleges.",
      tags: ["Pune", "Mumbai", "Electronics", "85-95%ile"],
      filters: { percentileMin: 85, percentileMax: 95, branchGroup: "electronics", region: "", category: "OPEN", collegeType: "", minority: "" }
    },
    {
      name: "Muslim Minority Colleges — Mumbai Region",
      description: "Edge-case preference list for Muslim minority candidates seeking admission in Mumbai colleges (MH Saboo Siddik, Anjuman-I-Islam, etc.) under minority quota.",
      tags: ["Mumbai", "Muslim", "Minority"],
      filters: { percentileMin: 75, percentileMax: 98, branchGroup: "computer", region: "Mumbai", category: "OPEN", collegeType: "", minority: "Muslim" }
    },
    {
      name: "Jain Minority Colleges — Pune & Mumbai",
      description: "Edge-case preference list for Jain minority candidates in Pune (e.g. GH Raisoni) and Mumbai colleges under minority quota.",
      tags: ["Jain", "Minority"],
      filters: { percentileMin: 75, percentileMax: 98, branchGroup: "computer", region: "", category: "OPEN", collegeType: "", minority: "Jain" }
    },
    {
      name: "Core Engineering Branches — Top Colleges (85-95%ile)",
      description: "Preference list focusing on Mechanical, Electrical, and Civil engineering in top colleges across Mumbai and Pune.",
      tags: ["Core", "Mechanical", "Electrical", "85-95%ile"],
      filters: { percentileMin: 85, percentileMax: 95, branchGroup: "core", region: "", category: "OPEN", collegeType: "", minority: "" }
    },
    {
      name: "Biotech & Allied Sciences — Top Colleges",
      description: "Specialized preference list focusing on Biotechnology and Biomedical engineering departments in Maharashtra.",
      tags: ["Biotech", "Biomedical", "Allied"],
      filters: { percentileMin: 75, percentileMax: 98, branchGroup: "biotech", region: "", category: "OPEN", collegeType: "", minority: "" }
    },
    {
      name: "Nagpur Region Top Colleges (80-95%ile)",
      description: "A comprehensive preference list of the best engineering institutions in the Nagpur region (RCOEM, VNIT, YCCE, etc.).",
      tags: ["Nagpur", "80-95%ile"],
      filters: { percentileMin: 80, percentileMax: 95, branchGroup: "computer", region: "Nagpur", category: "OPEN", collegeType: "", minority: "" }
    },
    {
      name: "Lower-Mid Range CS/IT — Mumbai & Pune (70-85%ile)",
      description: "Practical preference list for students scoring 70-85 percentile targeting CS/IT branches in Pune and Mumbai.",
      tags: ["Mumbai", "Pune", "70-85%ile"],
      filters: { percentileMin: 70, percentileMax: 85, branchGroup: "computer", region: "", category: "OPEN", collegeType: "", minority: "" }
    }
  ];

  pbToast('Seeding templates... please wait');
  
  for (const t of seedDefs) {
    const pList = generateCollegeListForParams(t.filters);
    await authApi('saveTemplate', {
      name: t.name,
      description: t.description,
      filters: t.filters,
      tags: t.tags,
      prefList: pList,
      isPublished: true
    });
  }
  
  pbToast('12 default templates seeded successfully!');
  if (document.getElementById('adminTplManagerModal').classList.contains('show')) {
    const res = await authApi('getAllTemplates', {});
    if (res.ok) renderAdminTemplatesList(res.data);
  }
}

/* ══════ BOOT ══════ */
async function boot() {
  const session = initAuth({ requireLogin: true, requirePremium: true, toolContainerId: 'toolArea' });
  if (!session) return;
  const user = getSession();
  if (user) currentUserId = user.id;
  if (user && user.role === 'admin') {
    const adminBtn = document.getElementById('adminTemplateBtn');
    if (adminBtn) adminBtn.style.display = 'block';
  }
  await loadData();
  await loadSavedPrefData();

  if (user && user.role === 'admin') {
    const params = new URLSearchParams(window.location.search);
    const editTplId = params.get('editTemplate');
    const newTpl = params.get('newTemplate');

    if (editTplId) {
      const res = await authApi('getAllTemplates', {});
      if (res.ok) {
        loadedAdminTemplates = res.data || [];
        editTemplateInBuilder(editTplId);
      }
    } else if (newTpl) {
      createNewTemplateInBuilder();
    }
  }
}

/* ─── TEMPLATES TAB (IN BUILDER) ─── */
async function loadTemplatesTab() {
  const container = document.getElementById('tabTplGridContainer');
  if (!container) return;
  
  if (loadedTemplates.length === 0) {
    container.innerHTML = '<div class="pb-loader"><div class="pb-spinner"></div><span>Loading templates...</span></div>';
    const res = await authApi('getTemplates', {});
    if (res.ok) {
      loadedTemplates = res.data || [];
    } else {
      container.innerHTML = `<div style="color:var(--brand);text-align:center;padding:20px">${escH(res.error || 'Failed to load templates')}</div>`;
      return;
    }
  }
  
  // Reset the sub-tabs active state when loading
  const parent = document.getElementById('tabTplCategories');
  if (parent) {
    parent.querySelectorAll('.tpl-sub-tab-btn').forEach(b => {
      const isAll = b.dataset.cat === 'all';
      b.classList.toggle('active', isAll);
      b.style.background = isAll ? 'var(--brand-soft)' : 'transparent';
      b.style.color = isAll ? 'var(--brand)' : 'var(--muted)';
    });
  }
  
  renderTemplatesInTab('all');
}

function switchTabTplCategory(catKey, btn) {
  const parent = document.getElementById('tabTplCategories');
  if (parent) {
    parent.querySelectorAll('.tpl-sub-tab-btn').forEach(b => {
      b.classList.remove('active');
      b.style.background = 'transparent';
      b.style.color = 'var(--muted)';
    });
  }
  if (btn) {
    btn.classList.add('active');
    btn.style.background = 'var(--brand-soft)';
    btn.style.color = 'var(--brand)';
  }
  renderTemplatesInTab(catKey);
}

function renderTemplatesInTab(catKey) {
  const container = document.getElementById('tabTplGridContainer');
  if (!container) return;
  
  let filtered = loadedTemplates || [];
  if (catKey !== 'all') {
    filtered = filtered.filter(t => getTplCategory(t) === catKey);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:40px 20px; text-align:center; color:var(--muted); font-size:13px; grid-column:1/-1">No templates found in this section.</div>`;
    return;
  }
  
  container.innerHTML = filtered.map(t => {
    const colCount = t.prefList?.length || 0;
    const usage = t.usageCount || 0;
    const gradient = getGradientForTpl(t);
    const counselor = getCounselorForTpl(t);

    return `<div class="tpl-card-v2" onclick="previewTemplate('${t.id}')" style="max-width:100%">
      <div class="tpl-card-banner" style="background: ${gradient}; height:110px; padding:12px;">
        <div class="tpl-banner-tag" style="font-size:7.5px; padding:2px 6px;">${escH(getBadgeForTpl(t))}</div>
        <div class="tpl-banner-accent" style="top:12px; right:12px; font-size:7.5px;">MHT-CET 2026</div>
        <div class="tpl-banner-title" style="font-size:12px; max-width: 100%; margin-bottom: 2px;">${escH(t.name)}</div>
        <div style="z-index: 3; margin-top: 2px;">
          <span style="background: ${counselor.badgeBg}; color: #ffffff; padding: 1px 4px; border-radius: 4px; font-size: 7px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${escH(counselor.name)}</span>
        </div>
      </div>
      <div class="tpl-card-body" style="padding: 10px 12px; display: flex; flex-direction: column; flex: 1; min-height: 50px; justify-content: space-between">
        <h4 style="font-family:'Lexend',sans-serif; font-weight: 800; font-size: 12px; color: var(--ink); line-height: 1.3; margin: 0 0 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis">${escH(t.name)}</h4>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--muted); font-weight: 500; border-top: 1px dashed var(--stroke); padding-top: 6px; margin-top: auto">
          <span style="display: inline-flex; align-items: center; gap: 4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg> ${colCount} Colleges</span>
          <span style="display: inline-flex; align-items: center; gap: 4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg> Used ${usage}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ─── DASHBOARD TEMPLATES LIBRARY ─── */
async function loadDashboardTemplates() {
  const container = document.getElementById('dashTplGridContainer');
  if (!container) return;
  
  if (loadedTemplates.length === 0) {
    container.innerHTML = '<div class="pb-loader"><div class="pb-spinner"></div><span>Loading templates...</span></div>';
    const res = await authApi('getTemplates', {});
    if (res.ok) {
      loadedTemplates = res.data || [];
    } else {
      container.innerHTML = `<div style="color:var(--brand);text-align:center;padding:20px">${escH(res.error || 'Failed to load templates')}</div>`;
      return;
    }
  }
  
  // Reset active state for dashboard sub-tabs
  const parent = document.getElementById('dashTplCategories');
  if (parent) {
    parent.querySelectorAll('.tpl-sub-tab-btn').forEach(b => {
      const isAll = b.dataset.cat === 'all';
      b.classList.toggle('active', isAll);
      b.style.background = isAll ? 'var(--brand-soft)' : 'transparent';
      b.style.color = isAll ? 'var(--brand)' : 'var(--muted)';
    });
  }
  
  renderTemplatesInDashboard('all');
}

function switchDashTplCategory(catKey, btn) {
  const parent = document.getElementById('dashTplCategories');
  if (parent) {
    parent.querySelectorAll('.tpl-sub-tab-btn').forEach(b => {
      b.classList.remove('active');
      b.style.background = 'transparent';
      b.style.color = 'var(--muted)';
    });
  }
  if (btn) {
    btn.classList.add('active');
    btn.style.background = 'var(--brand-soft)';
    btn.style.color = 'var(--brand)';
  }
  renderTemplatesInDashboard(catKey);
}

function renderTemplatesInDashboard(catKey) {
  const container = document.getElementById('dashTplGridContainer');
  if (!container) return;
  
  let filtered = loadedTemplates || [];
  if (catKey !== 'all') {
    filtered = filtered.filter(t => getTplCategory(t) === catKey);
  }
  
  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding:40px 20px; text-align:center; color:var(--muted); font-size:13px; grid-column:1/-1">No templates found in this section.</div>`;
    return;
  }
  
  // Show only first 3 templates in dashboard preview
  const previewList = filtered.slice(0, 3);
  
  container.innerHTML = previewList.map(t => {
    const colCount = t.prefList?.length || 0;
    const usage = t.usageCount || 0;
    const gradient = getGradientForTpl(t);
    const counselor = getCounselorForTpl(t);

    return `<div class="tpl-card-v2" onclick="previewTemplate('${t.id}')" style="max-width:100%">
      <div class="tpl-card-banner" style="background: ${gradient}; height:110px; padding:12px;">
        <div class="tpl-banner-tag" style="font-size:7.5px; padding:2px 6px;">${escH(getBadgeForTpl(t))}</div>
        <div class="tpl-banner-accent" style="top:12px; right:12px; font-size:7.5px;">MHT-CET 2026</div>
        <div class="tpl-banner-title" style="font-size:12px; max-width: 100%; margin-bottom: 2px;">${escH(t.name)}</div>
        <div style="z-index: 3; margin-top: 2px;">
          <span style="background: ${counselor.badgeBg}; color: #ffffff; padding: 1px 4px; border-radius: 4px; font-size: 7px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${escH(counselor.name)}</span>
        </div>
      </div>
      <div class="tpl-card-body" style="padding: 10px 12px; display: flex; flex-direction: column; flex: 1; min-height: 50px; justify-content: space-between">
        <h4 style="font-family:'Lexend',sans-serif; font-weight: 800; font-size: 12px; color: var(--ink); line-height: 1.3; margin: 0 0 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis">${escH(t.name)}</h4>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--muted); font-weight: 500; border-top: 1px dashed var(--stroke); padding-top: 6px; margin-top: auto">
          <span style="display: inline-flex; align-items: center; gap: 4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg> ${colCount} Colleges</span>
          <span style="display: inline-flex; align-items: center; gap: 4px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg> Used ${usage}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}


/* ══════ SPLIT SCREEN PREFERENCE BUILDER HELPERS ══════ */
function initSplitFilters() {
  const examType = window.currentExamType || 'MHT-CET';
  const examRadios = document.getElementsByName('splitExamType');
  for (const r of examRadios) {
    r.checked = (r.value === examType);
  }
  
  const pct = document.getElementById('inPct').value;
  const rank = document.getElementById('inRank').value;
  document.getElementById('splitScoreInput').value = pct;
  document.getElementById('splitRankInput').value = rank;
  
  updateSplitScoreLabels(examType);
  
  document.getElementById('splitCategorySelect').value = document.getElementById('inCategory').value || 'OPEN';
  document.getElementById('splitGenderSelect').value = document.getElementById('inGender').value || 'Gender-Neutral';
  document.getElementById('splitHomeUnivSelect').value = document.getElementById('inHomeUniv').value || '';
  document.getElementById('splitColTypeSelect').value = document.getElementById('inColType').value || '';
  document.getElementById('splitMinoritySelect').value = document.getElementById('inMinority').value || '';
  
  renderSplitRegionsDropdown();
  renderSplitBranchesCollapse();
}

function updateSplitScoreLabels(examType) {
  const isJee = (examType === 'JEE');
  const pctLabel = document.getElementById('splitScoreLabel');
  const rankLabel = document.getElementById('splitRankLabel');
  
  if (pctLabel) pctLabel.textContent = isJee ? 'JEE Percentile' : 'CET Percentile';
  if (rankLabel) rankLabel.textContent = isJee ? 'AI Rank' : 'CET Rank';
  
  const catWrap = document.getElementById('splitCategoryWrap');
  const huWrap = document.getElementById('splitHomeUnivWrap');
  const minWrap = document.getElementById('splitMinorityWrap');
  
  if (catWrap) catWrap.style.display = isJee ? 'none' : 'block';
  if (huWrap) huWrap.style.display = isJee ? 'none' : 'block';
  if (minWrap) minWrap.style.display = isJee ? 'none' : 'block';
}

function changeSplitFilter(filterType, value) {
  if (filterType === 'examType') {
    window.currentExamType = value;
    const radios = document.getElementsByName('inExamType');
    for (const r of radios) {
      if (r.value === value) r.checked = true;
    }
    toggleExamPath(value);
    updateSplitScoreLabels(value);
    autoFillPctRankSplit();
  }
  else if (filterType === 'score') {
    document.getElementById('inPct').value = value;
    autoFillPctRankSplit('score');
  }
  else if (filterType === 'rank') {
    document.getElementById('inRank').value = value;
    autoFillPctRankSplit('rank');
  }
  else if (filterType === 'category') {
    document.getElementById('inCategory').value = value;
  }
  else if (filterType === 'gender') {
    document.getElementById('inGender').value = value;
  }
  else if (filterType === 'homeUniv') {
    document.getElementById('inHomeUniv').value = value;
  }
  else if (filterType === 'colType') {
    document.getElementById('inColType').value = value;
  }
  else if (filterType === 'minority') {
    document.getElementById('inMinority').value = value;
  }
  
}

function autoFillPctRankSplit(source = 'score') {
  const pctEl = document.getElementById('splitScoreInput');
  const rankEl = document.getElementById('splitRankInput');
  const pctVal = pctEl.value.trim();
  const rankVal = rankEl.value.trim();
  const TOTAL_STUDENTS = 520000;

  if (source === 'score' && pctVal) {
    const pct = parseFloat(pctVal);
    if (!isNaN(pct) && pct >= 0 && pct <= 100) {
      const rank = Math.max(1, Math.round((100 - pct) / 100 * TOTAL_STUDENTS));
      rankEl.value = rank;
      document.getElementById('inRank').value = rank;
    }
  } else if (source === 'rank' && rankVal) {
    const rank = parseInt(rankVal);
    if (!isNaN(rank) && rank >= 1) {
      const pct = Math.max(0, 100 - (rank / TOTAL_STUDENTS) * 100);
      pctEl.value = pct.toFixed(4);
      document.getElementById('inPct').value = pct.toFixed(4);
    }
  }
}

function renderSplitRegionsDropdown() {
  const container = document.getElementById('splitRegionsDropdown');
  if (!container) return;
  
  container.innerHTML = ALL_REGIONS.map(r => {
    const checked = selectedRegions.includes(r) ? 'checked' : '';
    return `
      <label class="split-regions-dropdown-item">
        <input type="checkbox" value="${r}" ${checked} onchange="toggleSplitRegion('${r}', this.checked)">
        <span>${r}</span>
      </label>
    `;
  }).join('');
  
  updateSplitRegionsBtnText();
}

function toggleSplitRegion(region, isChecked) {
  const idx = selectedRegions.indexOf(region);
  if (isChecked) {
    if (idx === -1) selectedRegions.push(region);
  } else {
    if (idx >= 0) selectedRegions.splice(idx, 1);
  }
  
  updateSplitRegionsBtnText();
  renderRegionChips();
}

function updateSplitRegionsBtnText() {
  const btnText = document.getElementById('splitRegionsBtnText');
  if (!btnText) return;
  
  if (selectedRegions.length === 0) {
    btnText.textContent = 'All Regions';
  } else if (selectedRegions.length === 1) {
    btnText.textContent = selectedRegions[0];
  } else if (selectedRegions.length === ALL_REGIONS.length) {
    btnText.textContent = 'All Regions';
  } else {
    btnText.textContent = selectedRegions.length + ' Regions';
  }
}

function toggleSplitRegionsDropdown() {
  const dropdown = document.getElementById('splitRegionsDropdown');
  if (!dropdown) return;
  
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';
  
  if (!isVisible) {
    const closeHandler = (e) => {
      if (!e.target.closest('#splitRegionsDropdown') && !e.target.closest('button[onclick="toggleSplitRegionsDropdown()"]')) {
        dropdown.style.display = 'none';
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }
}

function toggleSplitBranchesCollapse() {
  const content = document.getElementById('splitBranchesCollapseContent');
  const arrow = document.getElementById('splitBranchArrow');
  if (!content || !arrow) return;
  
  const isVisible = content.style.display === 'block';
  content.style.display = isVisible ? 'none' : 'block';
  arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
}

function renderSplitBranchesCollapse() {
  const container = document.getElementById('splitBranchesCollapseContent');
  const countSpan = document.getElementById('splitBranchCount');
  if (!container || !countSpan) return;
  
  countSpan.textContent = selectedBranches.size;
  
  const grouped = {};
  Object.keys(CATS).forEach(c => grouped[c] = []);
  allBranchNames.forEach(b => { const cat = categorizeBranch(b); grouped[cat].push(b) });
  
  let html = `
    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
      <button type="button" class="pb-btn pb-btn-ghost" onclick="toggleAllBranchesSplit(true)" style="padding: 4px 8px; font-size: 10px; border-radius: 6px; height: auto;">Select All</button>
      <button type="button" class="pb-btn pb-btn-ghost" onclick="toggleAllBranchesSplit(false)" style="padding: 4px 8px; font-size: 10px; border-radius: 6px; height: auto;">Clear All</button>
    </div>
  `;
  
  Object.entries(grouped).forEach(([cat, branches]) => {
    if (!branches.length) return;
    const catSelCount = branches.filter(b => selectedBranches.has(b)).length;
    html += `
      <div style="margin-bottom: 8px; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px;">
          <span style="font-size: 11px; font-weight: 700; color: var(--brand);">${cat} (${catSelCount}/${branches.length})</span>
          <button type="button" class="branch-cat-toggle" onclick="toggleCategorySplit('${cat.replace(/'/g, "\\'")}')" style="font-size: 9px; padding: 2px 8px; border-radius: 4px; border: none; font-family: inherit; font-weight: 700; color: var(--brand); background: var(--brand-soft); cursor: pointer; transition: 0.2s; white-space: nowrap;">Select All</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 4px; padding-left: 8px;">
    `;
    branches.forEach(b => {
      const checked = selectedBranches.has(b) ? 'checked' : '';
      html += `
        <label class="split-branches-dropdown-item">
          <input type="checkbox" value="${b}" ${checked} onchange="toggleBranchSplit('${b.replace(/'/g, "\\'")}', this.checked)">
          <span style="font-size: 11px;">${b}</span>
        </label>
      `;
    });
    html += `
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function toggleBranchSplit(b, isChecked) {
  if (isChecked) {
    selectedBranches.add(b);
  } else {
    selectedBranches.delete(b);
  }
  
  document.getElementById('splitBranchCount').textContent = selectedBranches.size;
  renderBranches();
}

function toggleAllBranchesSplit(selectAll) {
  if (selectAll) {
    allBranchNames.forEach(b => selectedBranches.add(b));
  } else {
    selectedBranches.clear();
  }
  
  renderSplitBranchesCollapse();
  renderBranches();
}

function toggleCategorySplit(cat) {
  const grouped = {};
  Object.keys(CATS).forEach(c => grouped[c] = []);
  allBranchNames.forEach(b => { grouped[categorizeBranch(b)].push(b) });
  const branches = grouped[cat] || [];
  const allSel = branches.every(b => selectedBranches.has(b));
  branches.forEach(b => { if (allSel) selectedBranches.delete(b); else selectedBranches.add(b) });
  
  renderSplitBranchesCollapse();
  renderBranches();
}

function renderSplitPredictorResults() {
  const container = document.getElementById('splitPredictedList');
  const countEl = document.getElementById('splitMatchCount');
  if (!container || !countEl) return;
  
  const inPref = new Set(prefList.map(p => p.code + '|' + p.branch));
  let items = matchedColleges || [];
  
  countEl.textContent = items.length + ' colleges found';
  
  if (!items.length) {
    const minority = document.getElementById('inMinority').value;
    const regionsStr = selectedRegions.join(', ');
    let msg = 'Try adjusting your filters or branch preferences.';
    if (minority) msg = `No colleges found for ${minority} ${regionsStr ? 'in ' + regionsStr : ''}`;
    
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <h4 style="font-size: 14px; margin-bottom: 4px;">No Matches Found</h4>
        <p style="font-size: 12px;">${msg}</p>
      </div>
    `;
    return;
  }
  
  const userSession = getSession();
  const isPremium = userSession && (userSession.role === 'premium' || userSession.role === 'admin');
  const displayItems = isPremium ? items : items.slice(0, 13);
  
  container.innerHTML = displayItems.map((c, idx) => {
    const isLocked = !isPremium && idx >= 10;
    if (isLocked) {
      return `
        <div class="predicted-col-card locked" style="filter: blur(2px); opacity: 0.5; cursor: not-allowed;">
          <div class="predicted-col-card-name">••••••••••••••••••••••••••••••••••••</div>
          <div class="predicted-col-card-meta">
            <span class="predicted-col-card-tag">••••</span>
          </div>
          <div class="predicted-col-card-bottom">
            <span class="predicted-col-card-pct">••.••%</span>
            <span class="predicted-col-card-code">Code: ••••</span>
          </div>
        </div>
      `;
    }
    
    const isAdded = inPref.has(c.code + '|' + c.branch);
    const asp = c.isAspirational;
    
    const statusTags = [];
    if (c.isGov) statusTags.push('Gov');
    if (c.isAuto) statusTags.push('Auto');
    if (c.isMinority) statusTags.push(c.minorityType || 'Minority');
    if (c.isAided) statusTags.push('Aided');
    if (!c.isGov && !c.isAided) statusTags.push('Un-Aided');
    const statusText = statusTags.join(', ');
    
    return `
      <div class="predicted-col-card ${asp ? 'aspirational' : ''} ${isAdded ? 'added' : ''}" 
           draggable="${!isAdded}" 
           ondragstart="dragStartPredictor(event, '${c.code}', '${c.branch.replace(/'/g, "\\'")}')"
           ondragend="dragEndPredictor(event)">
        <div class="predicted-col-card-name" title="${escH(c.instituteName)}">${escH(c.instituteName)}</div>
        <div class="predicted-col-card-meta">
          <span class="predicted-col-card-tag branch" title="${escH(c.branch)}">${escH(c.branch)}</span>
          <span class="predicted-col-card-tag">${escH(statusText)}</span>
        </div>
        <div class="predicted-col-card-bottom">
          <span class="predicted-col-card-pct ${asp ? 'aspirational' : ''}"><strong>${c.percentile.toFixed(2)}%</strong></span>
          <span class="predicted-col-card-code">Code: ${c.code}</span>
        </div>
        ${isAdded ? 
          `<button class="predicted-col-card-add-btn added" disabled title="Already in list">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
           </button>` : 
          `<button class="predicted-col-card-add-btn" onclick="addPredictorCollege('${c.code}', '${c.branch.replace(/'/g, "\\'")}')" title="Add to preference list">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
           </button>`
        }
      </div>
    `;
  }).join('');
  
  if (!isPremium && items.length > 10) {
    container.innerHTML += `
      <div class="lock-paywall-card" style="padding: 20px; margin-top: 16px;">
        <div class="lock-icon-container" style="width: 48px; height: 48px; margin-bottom: 12px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h4 style="font-size: 15px; font-weight: 800; color: var(--ink); margin-bottom: 4px;">Unlock All Matches</h4>
        <p style="font-size: 11px; color: var(--muted); margin-bottom: 16px;">Purchase premium counselling to unlock the full list of predicted colleges.</p>
        <a href="https://www.conceptsimplified.in/courses" target="_blank" class="unlock-btn" style="padding: 8px 20px; font-size: 11px;">Unlock Premium</a>
      </div>
    `;
  }
}

function switchSplitRightTab(tabName) {
  document.querySelectorAll('#panel3 .split-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('#panel3 .sidebar-tab-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById('split-tab-' + tabName).classList.add('active');
  document.getElementById('btn-tab-' + tabName).classList.add('active');
  
  if (tabName === 'templates') {
    loadSplitTemplatesTab();
  }
}

let splitSearchTimeout = null;
function searchManualCollegesSplit() {
  clearTimeout(splitSearchTimeout);
  splitSearchTimeout = setTimeout(async () => {
    const query = (document.getElementById('splitManualSearchInput').value || '').toLowerCase().trim();
    const resDiv = document.getElementById('splitManualSearchResults');
    if (!query) { resDiv.innerHTML = ''; return; }
    resDiv.innerHTML = '<div class="pb-spinner" style="margin:20px auto"></div>';
    
    const category = document.getElementById('inCategory').value || 'OPEN';
    const minority = document.getElementById('inMinority').value || '';
    const gender = document.getElementById('inGender').value || 'Gender-Neutral';
    const isLadiesSeatSelected = (gender === 'Female-only');
    const baseCategory = category;
    const homeUniv = (document.getElementById('inHomeUniv') || {}).value || '';

    const isJee = (window.currentExamType === 'JEE');
    const activeCutoffData = isJee ? (jeeCutoffData || []) : cutoffData;

    const catMap = { 'OPEN': 'OPEN', 'OBC': 'OBC', 'SC': 'SC', 'ST': 'ST', 'VJ/DT': 'VJ', 'NT1': 'NT1', 'NT2': 'NT2', 'NT3': 'NT3', 'EWS': 'EWS', 'TFWS': 'TFWS' };
    const searchCat = catMap[baseCategory] || 'OPEN';

    const metaMap = {}; collegeMetadata.forEach(c => metaMap[c.code] = c);

    let filtered = activeCutoffData.filter(r => {
      if (!r.code.includes(query) && !(r.name || '').toLowerCase().includes(query) && !(r.branch || '').toLowerCase().includes(query)) return false;

      const meta = metaMap[r.code] || {};
      const nameLower = (meta.name || r.name || '').toLowerCase();
      const statusLower = (meta.status || '').toLowerCase();
      const isWomenOnly = nameLower.includes('women') || nameLower.includes('girls') || statusLower.includes('women') || statusLower.includes('girls') || r.code === '3035';

      if (isLadiesSeatSelected) {
        if (!isJee && !isWomenOnly && !(r.seatType || '').startsWith('L')) return false;
      } else {
        if (!isJee && (r.seatType || '').startsWith('L')) return false;
        if (isWomenOnly) return false;
      }

      if (!isJee && homeUniv) {
        const suffix = getSeatSuffix(meta.name || r.name || '', meta.status || '', homeUniv);
        const st = r.seatType || '';
        if (suffix === 'H' && !st.endsWith('H')) return false;
        if (suffix === 'O' && !st.endsWith('O')) return false;
        if (suffix === 'S' && !st.endsWith('S')) return false;
      }

      return true;
    });
    
    const groups = {};
    filtered.forEach(r => {
      const key = r.code + '|' + r.branch;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    let results = Object.values(groups).map(rows => {
      const meta = metaMap[rows[0].code] || {};
      const statusLower = (meta.status || '').toLowerCase();

      if (isJee) {
        return rows[0];
      }

      const isMatchingMinorityCollege = minority && 
        statusLower.includes('minority') && 
        statusLower.includes(minority.toLowerCase());

      const activeSearchCat = isMatchingMinorityCollege ? 'OPEN' : searchCat;

      let matched = rows.filter(r => (r.seatType || '').includes(activeSearchCat));
      if (!matched.length) matched = rows.filter(r => (r.seatType || '').includes('OPEN'));
      if (!matched.length) matched = rows;
      
      let finalRow;
      if (isLadiesSeatSelected) {
        finalRow = matched.find(r => (r.seatType || '').startsWith('L'));
      } else {
        finalRow = matched.find(r => (r.seatType || '').startsWith('G'));
      }
      return finalRow || matched[0];
    });

    results.sort((a, b) => b.percentile - a.percentile);
    const sliced = results.slice(0, 15);

    if (!sliced.length) { resDiv.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No colleges found</div>'; return; }

    const inPref = new Set(prefList.map(p => p.code + '|' + p.branch));

    resDiv.innerHTML = sliced.map(r => {
      const meta = metaMap[r.code] || {};
      const status = (meta.status || '').toLowerCase();
      const isAdded = inPref.has(r.code + '|' + r.branch);
      const tags = [];
      if (status.includes('government')) tags.push('Gov');
      if (status.includes('autonomous')) tags.push('Auto');
      if (status.includes('aided') && !status.includes('un-aided')) tags.push('Aided');
      if (!status.includes('government') && !status.includes('aided')) tags.push('Un-Aided');
      const statusText = tags.join(', ');

      return `
        <div class="predicted-col-card ${isAdded ? 'added' : ''}" 
             draggable="${!isAdded}"
             ondragstart="dragStartPredictor(event, '${r.code}', '${r.branch.replace(/'/g, "\\'")}')"
             ondragend="dragEndPredictor(event)">
          <div class="predicted-col-card-name" title="${escH(meta.name || r.name)}">${escH(meta.name || r.name)}</div>
          <div class="predicted-col-card-meta">
            <span class="predicted-col-card-tag branch" title="${escH(r.branch)}">${escH(r.branch)}</span>
            <span class="predicted-col-card-tag">${escH(statusText)}</span>
          </div>
          <div class="predicted-col-card-bottom">
            <span class="predicted-col-card-pct"><strong>${r.percentile.toFixed(2)}%</strong></span>
            <span class="predicted-col-card-code">Code: ${r.code}</span>
          </div>
          ${isAdded ? 
            `<button class="predicted-col-card-add-btn added" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
             </button>` : 
            `<button class="predicted-col-card-add-btn" onclick="addPredictorCollege('${r.code}','${r.branch.replace(/'/g, "\\'")}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
             </button>`
          }
        </div>`;
    }).join('');
  }, 300);
}

let currentSplitTplCategory = 'all';
async function loadSplitTemplatesTab() {
  const container = document.getElementById('splitTplGridContainer');
  if (!container) return;
  
  container.innerHTML = '<div class="pb-loader"><div class="pb-spinner"></div><span>Loading templates...</span></div>';
  
  if (!loadedTemplates || loadedTemplates.length === 0) {
    const res = await authApi('getTemplates', {});
    if (res.ok) {
      loadedTemplates = res.data || [];
    } else {
      container.innerHTML = `<div style="color:var(--brand);text-align:center;padding:20px">Error loading templates: ${escH(res.error)}</div>`;
      return;
    }
  }
  
  renderSplitTemplates();
}

function renderSplitTemplates() {
  const container = document.getElementById('splitTplGridContainer');
  if (!container) return;
  
  let templates = loadedTemplates || [];
  if (currentSplitTplCategory !== 'all') {
    templates = templates.filter(t => getTplCategory(t) === currentSplitTplCategory);
  }
  
  if (!templates.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No templates found in this category.</div>';
    return;
  }
  
  container.innerHTML = templates.map(t => {
    return `
      <div class="predicted-col-card" style="cursor: pointer;" onclick="previewTemplate('${t.id}')">
        <div class="predicted-col-card-name">${escH(t.name)}</div>
        <div class="predicted-col-card-meta" style="margin-top: 4px;">
          ${(t.tags || []).slice(0, 3).map(tag => `<span class="predicted-col-card-tag">${escH(tag)}</span>`).join('')}
        </div>
        <div class="predicted-col-card-bottom" style="margin-top: 8px;">
          <span style="font-size: 11px; font-weight: 700; color: var(--muted);">${t.prefList ? t.prefList.length : 0} choices</span>
          <span style="font-size: 11px; font-weight: 800; color: var(--brand);">Preview &rarr;</span>
        </div>
      </div>
    `;
  }).join('');
}

function switchSplitTplCategory(cat, btnEl) {
  document.querySelectorAll('#splitTplCategories .tpl-sub-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.background = 'transparent';
    btn.style.color = 'var(--muted)';
  });
  
  btnEl.classList.add('active');
  btnEl.style.background = 'var(--brand-soft)';
  btnEl.style.color = 'var(--brand)';
  
  currentSplitTplCategory = cat;
  renderSplitTemplates();
}

// Expose globals
window.initSplitFilters = initSplitFilters;
window.changeSplitFilter = changeSplitFilter;
window.toggleSplitRegionsDropdown = toggleSplitRegionsDropdown;
window.toggleSplitRegion = toggleSplitRegion;
window.toggleSplitBranchesCollapse = toggleSplitBranchesCollapse;
window.toggleBranchSplit = toggleBranchSplit;
window.toggleAllBranchesSplit = toggleAllBranchesSplit;
window.toggleCategorySplit = toggleCategorySplit;
window.switchSplitRightTab = switchSplitRightTab;
window.searchManualCollegesSplit = searchManualCollegesSplit;
window.addPredictorCollege = addPredictorCollege;
window.dragStartPredictor = dragStartPredictor;
window.dragEndPredictor = dragEndPredictor;
window.dropOnTbody = dropOnTbody;
window.switchSplitTplCategory = switchSplitTplCategory;
window.goStep = goStep; window.toggleBranch = toggleBranch; window.toggleCategory = toggleCategory;
window.toggleAllBranches = toggleAllBranches; window.toggleCatCollapse = toggleCatCollapse;
window.toggleCollege = toggleCollege; window.filterColleges = filterColleges;
window.removePref = removePref; window.handleAddSuggestion = handleAddSuggestion;
window.returnToDashboard = returnToDashboard;
window.exportPDF = exportPDF; window.switchSideTab = switchSideTab;
window.toggleExamPath = toggleExamPath;
window.toggleCollegeRow = toggleCollegeRow;
window.toggleSelectAllColleges = toggleSelectAllColleges;
function runPredictor() {
  generateMatches();
  renderSplitPredictorResults();
  triggerAutosave();
  pbToast('Predictions updated successfully!');
}

function movePrefUp(i) {
  if (i <= 6) return;
  const temp = prefList[i];
  prefList[i] = prefList[i - 1];
  prefList[i - 1] = temp;
  renderPrefList();
  triggerAutosave();
}

function movePrefDown(i) {
  if (i < 6 || i >= prefList.length - 1) return;
  const temp = prefList[i];
  prefList[i] = prefList[i + 1];
  prefList[i + 1] = temp;
  renderPrefList();
  triggerAutosave();
}

window.runPredictor = runPredictor;
window.movePrefUp = movePrefUp;
window.movePrefDown = movePrefDown;
window.deleteForm = deleteForm;
window.dragStart = dragStart; window.dragOver = dragOver; window.dragLeave = dragLeave; window.dropItem = dropItem; window.dragEnd = dragEnd;
window.enableRowDrag = enableRowDrag; window.disableRowDrag = disableRowDrag;
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
window.showStudentModal = showStudentModal;
window.closeStudentModal = closeStudentModal;
window.switchStudentMode = switchStudentMode;
window.searchExistingUsers = searchExistingUsers;
window.selectExistingUser = selectExistingUser;
window.submitStudentInfo = submitStudentInfo;

// Expose template functions to window
window.openTemplateLibrary = openTemplateLibrary;
window.loadTemplatesTab = loadTemplatesTab;
window.switchTabTplCategory = switchTabTplCategory;
window.loadDashboardTemplates = loadDashboardTemplates;
window.switchDashTplCategory = switchDashTplCategory;
window.filterTplByPct = filterTplByPct;
window.filterTplByBranch = filterTplByBranch;
window.filterTemplates = filterTemplates;
window.previewTemplate = previewTemplate;
window.closeTplPreview = closeTplPreview;
window.applyCurrentTemplate = applyCurrentTemplate;
window.openAdminTemplateManager = openAdminTemplateManager;
window.closeAdminTplManager = closeAdminTplManager;
window.deleteTemplate = deleteTemplate;
window.seedDefaultTemplates = seedDefaultTemplates;
window.useTemplate = useTemplate;
window.resetTplFilters = resetTplFilters;
window.showCategoryAll = showCategoryAll;
window.createNewTemplateInBuilder = createNewTemplateInBuilder;
window.editTemplateInBuilder = editTemplateInBuilder;
window.saveTemplateFromBuilder = saveTemplateFromBuilder;
window.exitAdminTemplateEditingMode = exitAdminTemplateEditingMode;
window.handleExitAdminMode = handleExitAdminMode;
window.updateAdminModeTplName = updateAdminModeTplName;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();


