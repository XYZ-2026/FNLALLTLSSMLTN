const fs = require('fs');
const path = require('path');

// Simulate DOM
const dom = {
  elements: {
    cutoffTabContent: { classList: { add: () => {}, remove: () => {} } },
    explorerTabContent: { classList: { add: () => {}, remove: () => {} } },
    expCode: { textContent: '' },
    expTotalSeats: { textContent: '' },
    expCategorySeats: { innerHTML: '' },
    expFeeRange: { textContent: '' },
    expSearch: { value: '' },
    expSort: { value: '' },
    explorerTableBody: { innerHTML: '' },
    explorerNoData: { classList: { add: () => {}, remove: () => {} } },
    cBranch: { value: 'AERONAUTICAL ENGINEERING', options: [{ value: 'AERONAUTICAL ENGINEERING' }], innerHTML: '', selectedIndex: 0 },
    cCategory: { value: 'GM' },
    trendChart: { getContext: () => ({}) },
    summaryTableBody: { innerHTML: '' },
    masterCutoffTableBody: { innerHTML: '' },
    masterLoadMore: { classList: { add: () => {}, remove: () => {} } },
    tblRound: { value: '1' },
    tblCategory: { value: 'GM' },
    tblSearch: { value: '' },
    colName: { textContent: '' },
    collegeSection: { classList: { add: () => {}, remove: () => {} } },
    collegeDetailsContent: { classList: { add: () => {}, remove: () => {} } },
    collegePageLoader: { classList: { add: () => {}, remove: () => {} } },
    statsRow: { innerHTML: '' }
  },
  getElementById(id) {
    if (!this.elements[id]) {
      console.log(`Warning: getElementById(${id}) requested but not simulated.`);
      return { classList: { add: () => {}, remove: () => {} }, style: {} };
    }
    return this.elements[id];
  }
};

// Mirror functions from page
const COLLEGE_NAME_MAP = {
  "Karavali Institute of Technology-Kottara, Mangaluru": "Karavali Institute of Technology, Mangaluru",
  "KLE Technological University Formerly called as KLE Dr. M.S. Sheshgiri College of Engineering and Technology-Udyambag, Belagavi": "KLE Technological University, Belagavi Campus. Formerly known as KLE Dr. M.S. Sheshgiri College of Engineering and Technology-Udyambag, Belagavi",
  "Seshadripuram Institute of Technology - Jaipura Hobli, Mysuru": "Seshadripuram Institute of Technology - Kadakola Industrial Area, Mysuru",
  "Yenepoya Institute of Technology formerly known as Dr. M V Shetty Institute of Technology-Moodbidri, Mangaluru": "Yenepoya Institute of Technology, NH-13, Thodar, Moodbidri, Mangaluru",
  "Amruta Institute of Engineering and Management Science-Bidadi, Ramnagar Taluk, Bengaluru Rural": "Amruta Institute of Engineering and Management Science-Bidadi,",
  "New Ebenezer Institute of Technology - Kothanur, Bangalore": "Vijaya Vittala Institution of Technology-Kothanur, Bengaluru"
};

function normalizeCollegeName(name) {
  if (!name) return '';
  let clean = name.split('\n')[0].replace(/\s+/g, ' ').trim().toLowerCase();
  clean = clean.replace(/^(dr\.|sri|shri|smt\.|the)\s+/g, '');
  return clean.replace(/[^a-z0-9]/g, '');
}

const DETAILS_BY_NORM_NAME = new Map();

function getDetailsForCollege(collegeName) {
  let targetName = collegeName;
  if (COLLEGE_NAME_MAP[collegeName]) {
    targetName = COLLEGE_NAME_MAP[collegeName];
  }
  const norm = normalizeCollegeName(targetName);
  return DETAILS_BY_NORM_NAME.get(norm) || null;
}

let ALL_DATA = [];
const ROUND_FIELDS = ['Round 1', 'Round 2', 'Round 3', 'Round 4'];

function parseRank(val) {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed === '–' || trimmed === '-' || trimmed === '') return null;
  const cleaned = trimmed.replace(/,/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function cleanCollegeName(raw) {
  if (!raw) return '';
  const parts = raw.split('\n');
  return parts[0].replace(/\s+/g, ' ').trim();
}

let selectedCollegeName = '';
let selectedCollegeData = {};
let currentExplorerBranches = [];
let tableLimit = 30;
let tableFilteredRows = [];

function selectCollege(collegeName) {
  selectedCollegeName = collegeName;

  dom.getElementById('collegeDetailsContent').classList.add('hidden');
  dom.getElementById('collegePageLoader').classList.remove('hidden');
  
  dom.getElementById('colName').textContent = collegeName;

  selectedCollegeData = {};
  for (let r = 1; r <= 4; r++) {
    selectedCollegeData[r] = [];
  }

  const collegeEntries = ALL_DATA.filter(e => e.college.toLowerCase() === collegeName.toLowerCase());
  collegeEntries.forEach(entry => {
    for (let r = 1; r <= 4; r++) {
      selectedCollegeData[r].push({
        branch: entry.branch,
        category: entry.category,
        rank: entry.rounds[r - 1]
      });
    }
  });

  const details = getDetailsForCollege(collegeName);
  const explorerContent = dom.getElementById('explorerTabContent');
  const cutoffContent = dom.getElementById('cutoffTabContent');
  
  cutoffContent.classList.remove('hidden');

  if (details) {
    explorerContent.classList.remove('hidden');
    renderCollegeExplorer(details);
    applyExplorerFilters();
  } else {
    explorerContent.classList.add('hidden');
  }

  initializeCollegeAnalytics();
}

function renderCollegeExplorer(details) {
  dom.getElementById('expCode').textContent = details.code || '—';
  
  let totalSeats = 0;
  let totalGM = 0;
  let totalKKR = 0;
  let minFee = Infinity;
  let maxFee = -Infinity;
  
  details.branches.forEach(b => {
    totalSeats += b.totalSeats;
    totalGM += b.gmSeats;
    totalKKR += b.kkrSeats;
    
    const feeStr = b.totalFee || '';
    const parsed = parseInt(feeStr.replace(/,/g, '').trim(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      if (parsed < minFee) minFee = parsed;
      if (parsed > maxFee) maxFee = parsed;
    }
  });
  
  dom.getElementById('expTotalSeats').textContent = totalSeats.toLocaleString('en-IN');
  dom.getElementById('expCategorySeats').innerHTML = `GM: ${totalGM} | KKR: ${totalKKR}`;
  
  let feeRangeStr = '—';
  if (minFee !== Infinity && maxFee !== -Infinity) {
    if (minFee === maxFee) {
      feeRangeStr = `₹${minFee.toLocaleString('en-IN')}`;
    } else {
      feeRangeStr = `₹${minFee.toLocaleString('en-IN')} - ₹${maxFee.toLocaleString('en-IN')}`;
    }
  }
  dom.getElementById('expFeeRange').textContent = feeRangeStr;
  
  currentExplorerBranches = details.branches || [];
  dom.getElementById('expSearch').value = '';
  dom.getElementById('expSort').value = 'name_asc';
}

function applyExplorerFilters() {
  const q = dom.getElementById('expSearch').value.toLowerCase().trim();
  const sortVal = dom.getElementById('expSort').value;
  
  let filtered = currentExplorerBranches.filter(b => {
    return !q || b.courseCodeName.toLowerCase().includes(q);
  });
  
  filtered.sort((a, b) => {
    if (sortVal === 'name_asc') {
      return a.courseCodeName.localeCompare(b.courseCodeName);
    } else if (sortVal === 'seats_desc') {
      return b.totalSeats - a.totalSeats;
    } else if (sortVal === 'fee_asc') {
      const feeA = parseInt((a.totalFee || '0').replace(/,/g, '').trim(), 10) || 0;
      const feeB = parseInt((b.totalFee || '0').replace(/,/g, '').trim(), 10) || 0;
      return feeA - feeB;
    } else if (sortVal === 'fee_desc') {
      const feeA = parseInt((a.totalFee || '0').replace(/,/g, '').trim(), 10) || 0;
      const feeB = parseInt((b.totalFee || '0').replace(/,/g, '').trim(), 10) || 0;
      return feeB - feeA;
    }
    return 0;
  });
  
  renderExplorerTable(filtered);
}

function renderExplorerTable(branches) {
  const tbody = dom.getElementById('explorerTableBody');
  const noData = dom.getElementById('explorerNoData');
  
  if (!branches.length) {
    tbody.innerHTML = '';
    noData.classList.remove('hidden');
    return;
  }
  noData.classList.add('hidden');
  tbody.innerHTML = 'rendered';
}

function initializeCollegeAnalytics() {
  const branches = new Set();
  for (let r = 1; r <= 4; r++) {
    selectedCollegeData[r].forEach(row => {
      if (row.branch) branches.add(row.branch.trim());
    });
  }

  const branchSel = dom.getElementById('cBranch');
  branchSel.innerHTML = 'populated';

  dom.getElementById('collegePageLoader').classList.add('hidden');
  dom.getElementById('collegeDetailsContent').classList.remove('hidden');

  renderCollegeStats();
  renderChartAndSummary();
  applyTableFilters();
}

function renderCollegeStats() {
  dom.getElementById('statsRow').innerHTML = 'populated';
}

function renderChartAndSummary() {
  const branch = dom.getElementById('cBranch').value;
  const category = dom.getElementById('cCategory').value;
  console.log(`Inside renderChartAndSummary: branch="${branch}", category="${category}"`);
}

function applyTableFilters() {
  tableLimit = 30;
  const round = parseInt(dom.getElementById('tblRound').value);
  const category = dom.getElementById('tblCategory').value;
  const search = dom.getElementById('tblSearch').value.toLowerCase().trim();
}

// Load data and run
try {
  const details = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'COMEDK', 'COMDEK_CLG_DETAILS.json'), 'utf8'));
  const detailsRows = details['COMDEK_CLG_DETAILS'] || [];
  detailsRows.forEach(row => {
    let rawName = row['College Name'] || '';
    if (!rawName) return;
    rawName = rawName.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    const normName = normalizeCollegeName(rawName);
    
    if (!DETAILS_BY_NORM_NAME.has(normName)) {
      DETAILS_BY_NORM_NAME.set(normName, {
        code: row['College Code'] || '',
        name: rawName,
        branches: []
      });
    }

    DETAILS_BY_NORM_NAME.get(normName).branches.push({
      courseCodeName: row['Course Code & Course Name'] || '',
      totalSeats: parseInt((row['Total Seats'] || '0').replace(/,/g, ''), 10) || 0,
      gmSeats: parseInt((row['GM\nSeats'] || '0').replace(/,/g, ''), 10) || 0,
      kkrSeats: parseInt((row['KKR\nSeats'] || '0').replace(/,/g, ''), 10) || 0,
      tuitionFee: row['Tuition Fee\n₹'] || '—',
      otherFee: row['Other Fee\n₹'] || '—',
      totalFee: row['Total Fee\n₹'] || '—'
    });
  });

  const gmJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'COMEDK', 'COMEDK_GM_CUTOFF.json'), 'utf8'));
  const gmRows = gmJson['COMEDK_GM_CUTOFF'] || [];
  gmRows.forEach(row => {
    const rawCollege = row['College'] || '';
    const college = cleanCollegeName(rawCollege);
    const branch = (row['Branch'] || '').trim();
    if (!college || !branch) return;
    const rounds = ROUND_FIELDS.map(field => parseRank(row[field]));
    ALL_DATA.push({ college, branch, category: 'GM', rounds });
  });

  console.log("Simulating selectCollege for AGM Rural College...");
  selectCollege("A.G.M Rural College of Engineering and Technology-Varur, Hubballi");
  console.log("Success! No runtime exceptions.");

} catch (err) {
  console.error("Runtime exception caught:");
  console.error(err);
}
