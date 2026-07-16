#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════
 *  College Simplified — SEO Blog Generator
 *  Generates static HTML blog pages for each engineering college
 *  Run: node generate-blogs.js
 * ══════════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Configuration ──────────────────────────────────────────────
const CONFIG = {
  BATCH_SIZE: 20,
  OUTPUT_DIR: path.join(__dirname, 'blogs'),
  PROGRESS_FILE: path.join(__dirname, 'blogs', '.progress.json'),
  BASE_URL: 'https://counselling.collegesimplified.in',
  SITE_NAME: 'College Simplified',
  YEAR: '2026',
  CUTOFF_YEAR: '2025',
};

// ── Utility: CSV Parser ────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else if (ch !== '\r') {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
    data.push(obj);
  }
  return data;
}

// ── Utility: Text helpers ──────────────────────────────────────
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getRegion(codeStr) {
  const clean = String(codeStr).trim().replace(/^0+/, '');
  if (!clean) return 'Maharashtra';
  const char = clean.length === 5 ? clean.charAt(1) : clean.charAt(0);
  const regions = { '1': 'Amravati', '2': 'Aurangabad', '3': 'Mumbai', '4': 'Nagpur', '5': 'Nashik', '6': 'Pune' };
  return regions[char] || 'Maharashtra';
}

function normName(name) {
  return String(name || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatRank(r) {
  const n = parseInt(r);
  if (!n && n !== 0) return '—';
  return n.toLocaleString('en-IN');
}

function formatPct(p) {
  const n = parseFloat(p);
  if (isNaN(n)) return '—';
  return n.toFixed(4) + '%';
}

function isRowEmpty(rounds) {
  if (!rounds) return true;
  for (const roundKey of ['R1', 'R2', 'R3', 'R4']) {
    const roundObj = rounds[roundKey];
    if (roundObj) {
      const rankVal = String(roundObj.rank || '').trim();
      const pctVal = String(roundObj.percentile || '').trim();
      if ((rankVal && rankVal !== '—' && rankVal !== '0') || (pctVal && pctVal !== '—' && pctVal !== '0')) {
        return false;
      }
    }
  }
  return true;
}

// ── Data Loading ───────────────────────────────────────────────
function loadAllData() {
  console.log('📂 Loading data sources...');

  const collegeDataRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'college-data.json'), 'utf8'));
  const collegeList = (collegeDataRaw['college-data'] || []).map(c => ({
    code: parseInt(c['Institute Code']),
    name: c['Institute Name'] || 'Unknown College',
    status: c['Status'] || '',
    totalIntake: parseInt(c['Total Intake']) || 0,
    region: getRegion(c['Institute Code']),
  }));
  console.log(`   ✓ college-data.json: ${collegeList.length} colleges`);

  const placementRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'ALL_CLG_PLACEMENT_TIER.json'), 'utf8'));
  const placements = placementRaw['ALL_CLG_PLACEMENT_TIER'] || [];
  console.log(`   ✓ ALL_CLG_PLACEMENT_TIER.json: ${placements.length} entries`);

  const seatsText = fs.readFileSync(path.join(__dirname, 'MHT_CET_Seats.csv'), 'utf8');
  const seatsData = parseCSV(seatsText);
  console.log(`   ✓ MHT_CET_Seats.csv: ${seatsData.length} rows`);

  console.log('   ⏳ Loading cleaned_cet_data.json (large file)...');
  const cetData = JSON.parse(fs.readFileSync(path.join(__dirname, 'cleaned_cet_data.json'), 'utf8'));
  console.log(`   ✓ cleaned_cet_data.json: ${cetData.length} entries`);

  const jeeData = JSON.parse(fs.readFileSync(path.join(__dirname, 'cleaned_jee_data.json'), 'utf8'));
  console.log(`   ✓ cleaned_jee_data.json: ${jeeData.length} entries`);

  const seoLines = fs.readFileSync(path.join(__dirname, 'college_seo.txt'), 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.toLowerCase().startsWith('mhtcet'));
  console.log(`   ✓ college_seo.txt: ${seoLines.length} ranked colleges`);

  return { collegeList, placements, seatsData, cetData, jeeData, seoLines };
}

// ── College Matching ───────────────────────────────────────────
function findCollegeByName(seoName, collegeList) {
  const target = normName(seoName);
  // Exact normalized match
  let found = collegeList.find(c => normName(c.name) === target);
  if (found) return found;

  // Substring match
  found = collegeList.find(c => normName(c.name).includes(target) || target.includes(normName(c.name)));
  if (found) return found;

  // Word overlap scoring
  const targetWords = target.split(' ').filter(w => w.length > 2);
  let bestScore = 0, bestMatch = null;
  for (const c of collegeList) {
    const cWords = normName(c.name).split(' ').filter(w => w.length > 2);
    const overlap = targetWords.filter(w => cWords.includes(w)).length;
    const score = overlap / Math.max(targetWords.length, cWords.length);
    if (score > bestScore && score > 0.45) {
      bestScore = score;
      bestMatch = c;
    }
  }
  return bestMatch;
}

function findPlacement(collegeName, code, placements) {
  const cleanCode = String(code).trim().replace(/^0+/, '');
  let match = placements.find(p => {
    const pCode = p['College Code'] ? String(p['College Code']).trim().replace(/^0+/, '') : '';
    return pCode === cleanCode;
  });
  if (!match) {
    const target = normName(collegeName);
    match = placements.find(p => {
      const pn = normName(p['College Name'] || '');
      return pn === target || pn.includes(target) || target.includes(pn);
    });
  }
  if (!match) {
    // Partial word matching
    const targetWords = normName(collegeName).split(' ').filter(w => w.length > 3);
    let best = 0, bestM = null;
    for (const p of placements) {
      const pw = normName(p['College Name'] || '').split(' ').filter(w => w.length > 3);
      const overlap = targetWords.filter(w => pw.includes(w)).length;
      if (overlap > best && overlap >= 2) { best = overlap; bestM = p; }
    }
    match = bestM;
  }
  return {
    avgPackage: match ? (match['Avg Package (LPA)'] || '—') : '—',
    tier: match ? (match['Tier'] || '—') : '—',
  };
}

// ── Data Extraction for a College ──────────────────────────────
function getCollegeSeats(code, seatsData) {
  return seatsData.filter(row => parseInt(row.College_Code) === code);
}

function getCollegeCET(code, cetData) {
  const clean = String(code).trim().replace(/^0+/, '');
  return cetData.filter(row => {
    const rc = row.instituteCode ? String(row.instituteCode).trim().replace(/^0+/, '') : '';
    return rc === clean;
  });
}

function getCollegeJEE(code, jeeData) {
  const clean = String(code).trim().replace(/^0+/, '');
  return jeeData.filter(row => {
    const rc = row.instituteCode ? String(row.instituteCode).trim().replace(/^0+/, '') : '';
    return rc === clean;
  });
}

function buildBranches(seats) {
  const groups = {};
  seats.forEach(row => {
    const key = row.Choice_Code;
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  return Object.values(groups).map(rows => {
    const primary = rows.find(r => r.Row_Type === 'State Level') ||
      rows.find(r => r.Row_Type === 'HU') ||
      rows.find(r => r.Row_Type === 'OHU') || rows[0];
    return {
      choiceCode: primary.Choice_Code,
      courseName: primary.Course_Name || 'Unknown Branch',
      si: parseInt(primary.SI) || 0,
      ms: parseInt(primary.MS_Seats) || 0,
      allIndia: parseInt(primary.All_India) || 0,
      minority: parseInt(primary.Minority_Seats) || 0,
      institute: parseInt(primary.Institute_Seats) || 0,
      cap: (parseInt(primary.MS_Seats) || 0) + (parseInt(primary.All_India) || 0),
      rows,
    };
  }).sort((a, b) => b.si - a.si);
}

function buildCETCutoffByBranch(cetEntries) {
  const grouped = {};
  cetEntries.forEach(entry => {
    const branch = (entry.branch || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (!branch) return;
    if (!grouped[branch]) grouped[branch] = [];
    grouped[branch].push(entry);
  });
  return grouped;
}

function buildJEECutoffByBranch(jeeEntries) {
  const grouped = {};
  jeeEntries.forEach(entry => {
    const branch = (entry.branch || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (!branch) return;
    if (!grouped[branch]) grouped[branch] = [];
    grouped[branch].push(entry);
  });
  return grouped;
}

// ── Template Definitions ───────────────────────────────────────
const TEMPLATES = [
  {
    name: 'classic',
    accent: '#dc2626', accentSoft: '#fef2f2', accentRing: 'rgba(220,38,38,0.15)',
    heroBg: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)',
    heroText: '#111827', headingFont: "'Lexend', sans-serif",
    cardRadius: '16px', specialCSS: '',
  },
  {
    name: 'modern',
    accent: '#dc2626', accentSoft: '#fef2f2', accentRing: 'rgba(220,38,38,0.15)',
    heroBg: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
    heroText: '#ffffff', headingFont: "'Lexend', sans-serif",
    cardRadius: '24px',
    specialCSS: `.blog-card { backdrop-filter: blur(8px); background: rgba(255,255,255,0.92); }`,
  },
  {
    name: 'bold',
    accent: '#dc2626', accentSoft: '#fef2f2', accentRing: 'rgba(220,38,38,0.15)',
    heroBg: 'linear-gradient(135deg, #111827 0%, #dc2626 100%)',
    heroText: '#ffffff', headingFont: "'Lexend', sans-serif",
    cardRadius: '20px',
    specialCSS: `h1 { font-size: 2.8rem !important; } .blog-hero { min-height: 280px; }`,
  },
  {
    name: 'minimal',
    accent: '#dc2626', accentSoft: '#fef2f2', accentRing: 'rgba(220,38,38,0.15)',
    heroBg: '#ffffff',
    heroText: '#111827', headingFont: "Georgia, 'Times New Roman', serif",
    cardRadius: '12px',
    specialCSS: `.blog-card { border: 1px solid #e5e7eb; box-shadow: none; } h2, h3 { font-family: Georgia, 'Times New Roman', serif; }`,
  },
];

// ── Category Info ──────────────────────────────────────────────
const CAT_DATA = [
  { label: 'OPEN', g: 'OPEN_G', l: 'OPEN_L' },
  { label: 'SC', g: 'SC_G', l: 'SC_L' },
  { label: 'ST', g: 'ST_G', l: 'ST_L' },
  { label: 'VJ/DT', g: 'VJ/DT_G', l: 'VJ/DT_L' },
  { label: 'NT-B', g: 'NTB_G', l: 'NTB_L' },
  { label: 'NT-C', g: 'NTC_G', l: 'NTC_L' },
  { label: 'NT-D', g: 'NTD_G', l: 'NTD_L' },
  { label: 'OBC', g: 'OBC_G', l: 'OBC_L' },
  { label: 'SEBC', g: 'SEBC_G', l: 'SEBC_L' },
];

// ── FAQ Generator ──────────────────────────────────────────────
function generateFAQs(college, placement, branches, cetByBranch, jeeByBranch) {
  const faqs = [];
  const name = college.name;
  const code = String(college.code).padStart(4, '0');

  faqs.push({
    q: `What is the total intake capacity of ${name}?`,
    a: `${name} (Code: ${code}) has a total sanctioned intake of ${college.totalIntake} seats across ${branches.length} engineering branches for the academic year ${CONFIG.YEAR}.`,
  });

  if (placement.avgPackage !== '—') {
    faqs.push({
      q: `What is the average placement package at ${name}?`,
      a: `The average placement package at ${name} is approximately ${placement.avgPackage} LPA. The college is classified as a ${placement.tier} institution based on placement performance.`,
    });
  }

  faqs.push({
    q: `How many branches does ${name} offer?`,
    a: `${name} offers ${branches.length} engineering branches including ${branches.slice(0, 4).map(b => b.courseName).join(', ')}${branches.length > 4 ? ', and more' : ''}.`,
  });

  const isAuto = college.status.toLowerCase().includes('autonomous');
  faqs.push({
    q: `Is ${name} an autonomous college?`,
    a: isAuto
      ? `Yes, ${name} is an autonomous institution. The college status is: ${college.status}.`
      : `No, ${name} is not autonomous. The college status is: ${college.status}.`,
  });

  const isMinority = college.status.toLowerCase().includes('minority');
  if (isMinority) {
    faqs.push({
      q: `Does ${name} have a minority quota?`,
      a: `Yes, ${name} operates under a minority quota. Status: ${college.status}. Minority quota seats are available in addition to regular CAP seats.`,
    });
  }

  const topBranch = branches[0];
  if (topBranch) {
    faqs.push({
      q: `How many seats are available in ${topBranch.courseName} at ${name}?`,
      a: `${topBranch.courseName} at ${name} has ${topBranch.si} total seats (Sanctioned Intake), with ${topBranch.cap} CAP seats (${topBranch.ms} Maharashtra + ${topBranch.allIndia} All India).`,
    });
  }

  const cetBranches = Object.keys(cetByBranch);
  if (cetBranches.length > 0) {
    const firstBranch = cetBranches[0];
    const firstEntries = cetByBranch[firstBranch];
    const openEntry = firstEntries.find(e => (e.category || '').includes('GOPEN'));
    if (openEntry && openEntry.rounds && openEntry.rounds.R1) {
      faqs.push({
        q: `What is the MHT-CET cutoff for ${firstBranch} at ${name}?`,
        a: `For the GOPEN category in Round 1, the MHT-CET cutoff for ${firstBranch} at ${name} was rank ${formatRank(openEntry.rounds.R1.rank)} (percentile: ${formatPct(openEntry.rounds.R1.percentile)}). Cutoffs vary by round and category — see the detailed tables above.`,
      });
    }
  }

  faqs.push({
    q: `In which region is ${name} located?`,
    a: `${name} is located in the ${college.region} region of Maharashtra. The institute code is ${code}.`,
  });

  if (Object.keys(jeeByBranch).length > 0) {
    faqs.push({
      q: `Does ${name} accept JEE Mains scores for All India quota?`,
      a: `Yes, ${name} has All India quota seats filled through JEE Mains counselling. Detailed JEE Mains cutoff data for all branches is provided in the tables above.`,
    });
  }

  return faqs;
}

// ── HTML Generation ────────────────────────────────────────────
function generateBlogHTML(college, placement, branches, cetByBranch, jeeByBranch, template, allSlugs) {
  const slug = slugify(college.name);
  const code = String(college.code).padStart(4, '0');
  const faqs = generateFAQs(college, placement, branches, cetByBranch, jeeByBranch);
  const t = template;

  const statusParts = college.status.split(',').map(s => s.trim());
  const isAutonomous = college.status.toLowerCase().includes('autonomous');
  const isMinority = college.status.toLowerCase().includes('minority');
  const isGovt = college.status.toLowerCase().includes('government');

  // About paragraph
  const collegeType = isGovt ? 'a government' : 'a private';
  const autoText = isAutonomous ? 'an autonomous' : 'a non-autonomous';
  const minorityText = isMinority ? ` It operates under a minority quota (${statusParts.filter(s => s.toLowerCase().includes('minority')).join(', ')}).` : '';
  const aboutText = `${college.name} is ${collegeType}, ${autoText} engineering institute located in the ${college.region} region of Maharashtra, India. With a total sanctioned intake of ${college.totalIntake} students across ${branches.length} engineering branches, it is a significant institution for engineering education.${minorityText} The institute code is ${code} and it participates in the MHT-CET CAP counselling process for admissions.`;

  // Generate seat matrix tables HTML
  let seatMatrixHTML = '';
  branches.forEach(branch => {
    const stateRow = branch.rows.find(r => r.Row_Type === 'State Level');
    const huRow = branch.rows.find(r => r.Row_Type === 'HU');
    const ohuRow = branch.rows.find(r => r.Row_Type === 'OHU');
    const ewsRow = branch.rows.find(r => r.Row_Type === 'EWS');

    let categoryHTML = '';
    const renderCatSection = (row, title) => {
      if (!row) return '';
      let html = `<h4 class="cat-section-title">${escHtml(title)}</h4><div class="cat-grid">`;
      CAT_DATA.forEach(cat => {
        const g = parseInt(row[cat.g]) || 0;
        const l = parseInt(row[cat.l]) || 0;
        if (g > 0 || l > 0) {
          html += `<div class="cat-cell"><span class="cat-label">${cat.label}</span><span class="cat-g" title="General">${g}</span><span class="cat-l" title="Ladies">${l}</span></div>`;
        }
      });
      html += '</div>';
      return html;
    };

    categoryHTML += renderCatSection(stateRow, 'State Level Seats');
    categoryHTML += renderCatSection(huRow, 'Home University (HU) Seats');
    categoryHTML += renderCatSection(ohuRow, 'Other Home University (OHU) Seats');

    // Special quotas
    let specialHTML = '';
    if (ewsRow) {
      const ewsCount = parseInt(ewsRow['Total_G+L']) || 0;
      if (ewsCount > 0) specialHTML += `<span class="special-badge ews">EWS: ${ewsCount}</span>`;
    }
    const pwdRow = branch.rows.find(r => r.Row_Type === 'PWD');
    if (pwdRow) {
      let pwdTotal = 0;
      Object.keys(pwdRow).forEach(k => { if (k.endsWith('_G') || k.endsWith('_L')) pwdTotal += parseInt(pwdRow[k]) || 0; });
      if (pwdTotal > 0) specialHTML += `<span class="special-badge pwd">PWD: ${pwdTotal}</span>`;
    }
    const defRow = branch.rows.find(r => r.Row_Type === 'DEF');
    if (defRow) {
      let defTotal = 0;
      Object.keys(defRow).forEach(k => { if (k.endsWith('_G') || k.endsWith('_L')) defTotal += parseInt(defRow[k]) || 0; });
      if (defTotal > 0) specialHTML += `<span class="special-badge def">DEF: ${defTotal}</span>`;
    }

    seatMatrixHTML += `
    <div class="branch-card blog-card">
      <h3>${escHtml(branch.courseName)} <span class="choice-code">${escHtml(branch.choiceCode)}</span></h3>
      <div class="seat-summary-row">
        <div class="seat-pill"><strong>${branch.si}</strong> Total (SI)</div>
        <div class="seat-pill"><strong>${branch.cap}</strong> CAP</div>
        <div class="seat-pill"><strong>${branch.ms}</strong> MH State</div>
        <div class="seat-pill"><strong>${branch.allIndia}</strong> All India</div>
        ${branch.minority > 0 ? `<div class="seat-pill minority"><strong>${branch.minority}</strong> Minority</div>` : ''}
        ${branch.institute > 0 ? `<div class="seat-pill"><strong>${branch.institute}</strong> ILS/Mgmt</div>` : ''}
      </div>
      ${categoryHTML ? `<div class="category-breakdown"><div class="cat-legend"><span class="cat-g-legend">■ General (G)</span> <span class="cat-l-legend">■ Ladies (L)</span></div>${categoryHTML}</div>` : ''}
      ${specialHTML ? `<div class="special-quotas">${specialHTML}</div>` : ''}
    </div>`;
  });

  // Generate MHT-CET cutoff tables
  let cetCutoffHTML = '';
  const cetBranchNames = Object.keys(cetByBranch).sort();
  cetBranchNames.forEach(branchName => {
    const entries = cetByBranch[branchName];
    let tableRows = '';
    entries.forEach(entry => {
      const r = entry.rounds || {};
      if (isRowEmpty(r)) return;
      const cat = entry.category || '—';
      tableRows += `<tr>
        <td class="cat-col">${escHtml(cat)}</td>
        <td>${formatRank(r.R1?.rank)}</td><td class="pct">${formatPct(r.R1?.percentile)}</td>
        <td>${formatRank(r.R2?.rank)}</td><td class="pct">${formatPct(r.R2?.percentile)}</td>
        <td>${formatRank(r.R3?.rank)}</td><td class="pct">${formatPct(r.R3?.percentile)}</td>
        <td>${formatRank(r.R4?.rank)}</td><td class="pct">${formatPct(r.R4?.percentile)}</td>
      </tr>`;
    });

    if (tableRows) {
      cetCutoffHTML += `
      <div class="cutoff-card blog-card">
        <h3>${escHtml(branchName)} — MHT-CET CAP Round Cutoffs</h3>
        <div class="table-scroll">
          <table class="cutoff-table">
            <thead><tr>
              <th>Category</th>
              <th>R1 Rank</th><th>R1 %ile</th>
              <th>R2 Rank</th><th>R2 %ile</th>
              <th>R3 Rank</th><th>R3 %ile</th>
              <th>R4 Rank</th><th>R4 %ile</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>`;
    }
  });

  // Generate JEE cutoff tables
  let jeeCutoffHTML = '';
  const jeeBranchNames = Object.keys(jeeByBranch).sort();
  jeeBranchNames.forEach(branchName => {
    const entries = jeeByBranch[branchName];
    let tableRows = '';
    entries.forEach(entry => {
      const r = entry.rounds || {};
      if (isRowEmpty(r)) return;
      const seatType = entry.seatType || 'AI';
      const allocType = entry.type || 'AI to AI';
      tableRows += `<tr>
        <td>${escHtml(entry.choiceCode || '—')}</td>
        <td>${escHtml(seatType)}</td>
        <td>${escHtml(allocType)}</td>
        <td>${formatRank(r.R1?.rank)}</td><td class="pct">${formatPct(r.R1?.percentile)}</td>
        <td>${formatRank(r.R2?.rank)}</td><td class="pct">${formatPct(r.R2?.percentile)}</td>
        <td>${formatRank(r.R3?.rank)}</td><td class="pct">${formatPct(r.R3?.percentile)}</td>
        <td>${formatRank(r.R4?.rank)}</td><td class="pct">${formatPct(r.R4?.percentile)}</td>
      </tr>`;
    });

    if (tableRows) {
      jeeCutoffHTML += `
      <div class="cutoff-card blog-card">
        <h3>${escHtml(branchName)} — JEE Mains All India Cutoffs</h3>
        <div class="table-scroll">
          <table class="cutoff-table">
            <thead><tr>
              <th>Choice Code</th><th>Seat Type</th><th>Allocation</th>
              <th>R1 Rank</th><th>R1 %ile</th>
              <th>R2 Rank</th><th>R2 %ile</th>
              <th>R3 Rank</th><th>R3 %ile</th>
              <th>R4 Rank</th><th>R4 %ile</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>`;
    }
  });

  // FAQ HTML
  const faqHTML = faqs.map(f => `
    <div class="faq-item">
      <h3 class="faq-q">${escHtml(f.q)}</h3>
      <p class="faq-a">${escHtml(f.a)}</p>
    </div>`).join('');

  // FAQ Schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  // Article Schema
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${college.name} — Cutoffs, Seat Matrix & Placements ${CONFIG.YEAR}`,
    description: `Complete guide to ${college.name} (${code}): MHT-CET & JEE cutoffs, seat matrix, branch-wise details, placements (${placement.avgPackage} LPA avg), and admission info for ${CONFIG.YEAR}.`,
    author: { '@type': 'Organization', name: CONFIG.SITE_NAME, url: CONFIG.BASE_URL },
    publisher: { '@type': 'Organization', name: CONFIG.SITE_NAME, url: CONFIG.BASE_URL },
    datePublished: new Date().toISOString().split('T')[0],
    dateModified: new Date().toISOString().split('T')[0],
    url: `${CONFIG.BASE_URL}/blogs/${slug}.html`,
  };

  // Breadcrumb Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: CONFIG.BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'College Blogs', item: `${CONFIG.BASE_URL}/blogs/` },
      { '@type': 'ListItem', position: 3, name: college.name, item: `${CONFIG.BASE_URL}/blogs/${slug}.html` },
    ],
  };

  // Related colleges
  const related = allSlugs
    .filter(s => s.slug !== slug)
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);
  const relatedHTML = related.map(r => `<a href="${r.slug}.html" class="related-link">${escHtml(r.name)}</a>`).join('');

  // Title & description for SEO
  const pageTitle = `${college.name} — MHT-CET Cutoffs, Seat Matrix & Placements ${CONFIG.YEAR} | ${CONFIG.SITE_NAME}`;
  const pageDesc = `Detailed info on ${college.name} (${code}): MHT-CET ${CONFIG.CUTOFF_YEAR} cutoffs, branch-wise seat matrix, JEE Mains cutoffs, placement packages (${placement.avgPackage} LPA avg), ${placement.tier}. Region: ${college.region}. ${branches.length} branches, ${college.totalIntake} total intake.`;
  const keywords = [
    college.name, `${college.name} cutoff`, `${college.name} seat matrix`, `${college.name} placement`,
    `${code} college`, `${college.name} admission ${CONFIG.YEAR}`, `${college.name} MHT CET cutoff`,
    `${college.name} branches`, `mhtcet cutoff ${college.region}`,
    ...branches.slice(0, 5).map(b => `${b.courseName} cutoff ${college.name}`),
  ].join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(pageTitle)}</title>
  <meta name="description" content="${escHtml(pageDesc.substring(0, 300))}">
  <meta name="keywords" content="${escHtml(keywords)}">
  <link rel="canonical" href="${CONFIG.BASE_URL}/blogs/${slug}.html">
  <link rel="icon" type="image/png" href="../favicon.png">

  <meta property="og:title" content="${escHtml(pageTitle)}">
  <meta property="og:description" content="${escHtml(pageDesc.substring(0, 200))}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${CONFIG.BASE_URL}/blogs/${slug}.html">
  <meta property="og:site_name" content="${CONFIG.SITE_NAME}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escHtml(pageTitle)}">
  <meta name="twitter:description" content="${escHtml(pageDesc.substring(0, 200))}">

  <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lexend:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --accent: ${t.accent};
      --accent-soft: ${t.accentSoft};
      --accent-ring: ${t.accentRing};
      --ink: #111827; --ink2: #374151; --muted: #6b7280;
      --bg: #f8f9fb; --card: #ffffff; --stroke: #e5e7eb;
      --green: #16a34a; --blue: #2563eb; --orange: #d97706;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--ink); line-height: 1.6; padding-top: 64px; -webkit-font-smoothing: antialiased; }

    /* ── Static Navbar ── */
    .blog-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 500; height: 64px; background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--stroke); }
    .blog-nav-inner { max-width: 1200px; margin: 0 auto; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }
    .blog-logo { font-family: 'Lexend', sans-serif; font-weight: 800; font-size: 1.25rem; color: var(--accent); text-decoration: none; display: flex; align-items: center; gap: 4px; flex-shrink: 0; white-space: nowrap; line-height: 1; }
    .blog-logo span { color: var(--ink); }
    .blog-nav-links { display: flex; align-items: center; gap: 8px; }
    .blog-nav-links a { text-decoration: none; font-size: 13px; font-weight: 600; color: var(--muted); padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
    .blog-nav-links a:hover { background: var(--accent-soft); color: var(--accent); }
    @media (max-width: 600px) {
      body { padding-top: 88px; }
      .blog-nav { height: auto; padding: 10px 0; }
      .blog-nav-inner { flex-direction: column; gap: 8px; align-items: center; }
      .blog-logo { font-size: 1.1rem; gap: 2px; }
      .blog-logo span { font-size: 1.1rem; }
      .blog-nav-links { gap: 6px; }
      .blog-nav-links a { font-size: 11px; padding: 4px 8px; }
    }

    /* ── Breadcrumb ── */
    .breadcrumb { max-width: 1200px; margin: 20px auto 0; padding: 0 20px; font-size: 13px; color: var(--muted); }
    .breadcrumb a { color: var(--accent); text-decoration: none; font-weight: 600; }
    .breadcrumb a:hover { text-decoration: underline; }
    .breadcrumb span { margin: 0 6px; }

    /* ── Hero ── */
    .blog-hero { background: ${t.heroBg}; padding: 48px 20px 40px; margin-bottom: 32px; }
    .blog-hero-inner { max-width: 1200px; margin: 0 auto; }
    .blog-hero h1 { font-family: ${t.headingFont}; font-weight: 800; font-size: clamp(1.6rem, 4vw, 2.4rem); color: ${t.heroText}; line-height: 1.2; margin-bottom: 16px; }
    .hero-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .hero-badge { font-size: 11px; font-weight: 700; padding: 5px 14px; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.5px; }
    .hero-badge.code { background: ${t.heroText === '#ffffff' ? 'rgba(255,255,255,0.15)' : t.accentSoft}; color: ${t.heroText === '#ffffff' ? '#ffffff' : t.accent}; border: 1px solid ${t.heroText === '#ffffff' ? 'rgba(255,255,255,0.25)' : t.accentRing}; }
    .hero-badge.region { background: ${t.heroText === '#ffffff' ? 'rgba(255,255,255,0.15)' : '#f0fdf4'}; color: ${t.heroText === '#ffffff' ? '#a7f3d0' : '#16a34a'}; }
    .hero-badge.status { background: ${t.heroText === '#ffffff' ? 'rgba(255,255,255,0.15)' : '#eff6ff'}; color: ${t.heroText === '#ffffff' ? '#93c5fd' : '#2563eb'}; }
    .hero-badge.tier { background: ${t.heroText === '#ffffff' ? 'rgba(255,255,255,0.15)' : '#fef9c3'}; color: ${t.heroText === '#ffffff' ? '#fde68a' : '#b45309'}; }

    /* ── Content ── */
    .blog-wrap { max-width: 1200px; margin: 0 auto; padding: 0 20px 80px; }

    /* ── Stats Grid ── */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: var(--card); border: 1px solid var(--stroke); border-radius: ${t.cardRadius}; padding: 24px; text-align: center; }
    .stat-card .stat-val { font-family: 'Lexend', sans-serif; font-size: 28px; font-weight: 800; color: var(--accent); margin-bottom: 4px; }
    .stat-card .stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); letter-spacing: 1px; }

    /* ── Section Headers ── */
    .section-hdr { margin: 48px 0 24px; padding-bottom: 12px; border-bottom: 2px solid var(--stroke); }
    .section-hdr h2 { font-family: ${t.headingFont}; font-size: 22px; font-weight: 800; color: var(--ink); }
    .section-hdr p { font-size: 13.5px; color: var(--muted); margin-top: 4px; }

    /* ── Blog Cards ── */
    .blog-card { background: var(--card); border: 1px solid var(--stroke); border-radius: ${t.cardRadius}; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
    .blog-card h3 { font-family: 'Lexend', sans-serif; font-size: 17px; font-weight: 700; color: var(--ink); margin-bottom: 16px; border-left: 3.5px solid var(--accent); padding-left: 12px; line-height: 1.3; }
    .choice-code { font-size: 11px; font-weight: 700; background: var(--accent-soft); color: var(--accent); padding: 2px 8px; border-radius: 6px; margin-left: 8px; vertical-align: middle; }

    /* ── About ── */
    .about-text { font-size: 15px; color: var(--ink2); line-height: 1.8; background: var(--card); border: 1px solid var(--stroke); border-radius: ${t.cardRadius}; padding: 28px; }

    /* ── Seat Summary ── */
    .seat-summary-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
    .seat-pill { font-size: 13px; font-weight: 600; background: var(--bg); border: 1px solid var(--stroke); padding: 8px 14px; border-radius: 10px; color: var(--ink2); }
    .seat-pill strong { color: var(--ink); font-weight: 800; margin-right: 4px; }
    .seat-pill.minority { background: var(--accent-soft); border-color: var(--accent-ring); color: var(--accent); }
    .seat-pill.minority strong { color: var(--accent); }

    /* ── Category Breakdown ── */
    .category-breakdown { border-top: 1px dashed var(--stroke); padding-top: 16px; margin-top: 8px; }
    .cat-legend { font-size: 11px; color: var(--muted); margin-bottom: 12px; display: flex; gap: 16px; }
    .cat-g-legend { color: var(--blue); font-weight: 700; }
    .cat-l-legend { color: var(--accent); font-weight: 700; }
    .cat-section-title { font-size: 12px; font-weight: 700; color: var(--blue); margin: 12px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-bottom: 12px; }
    .cat-cell { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: var(--bg); border: 1px solid var(--stroke); border-radius: 8px; font-size: 12px; }
    .cat-label { font-weight: 700; color: var(--ink); flex: 1; }
    .cat-g { font-weight: 800; color: var(--blue); background: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
    .cat-l { font-weight: 800; color: var(--accent); background: var(--accent-soft); padding: 2px 6px; border-radius: 4px; font-size: 11px; }

    /* ── Special Quotas ── */
    .special-quotas { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--stroke); }
    .special-badge { font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 8px; }
    .special-badge.ews { background: #fffbeb; color: var(--orange); border: 1px solid rgba(217,119,6,0.2); }
    .special-badge.pwd { background: #eff6ff; color: var(--blue); border: 1px solid rgba(37,99,235,0.2); }
    .special-badge.def { background: #f0fdf4; color: var(--green); border: 1px solid rgba(22,163,74,0.2); }

    /* ── Cutoff Tables ── */
    .table-scroll { overflow-x: auto; margin-top: 8px; }
    .cutoff-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 700px; }
    .cutoff-table th { background: var(--bg); padding: 12px 10px; text-align: left; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid var(--stroke); white-space: nowrap; }
    .cutoff-table td { padding: 10px 10px; border-bottom: 1px solid var(--stroke); color: var(--ink); font-weight: 500; }
    .cutoff-table td.cat-col { font-weight: 700; color: var(--ink); white-space: nowrap; }
    .cutoff-table td.pct { font-weight: 700; color: var(--accent); }
    .cutoff-table tbody tr:hover { background: #f9fafb; }

    /* ── FAQ ── */
    .faq-item { background: var(--card); border: 1px solid var(--stroke); border-radius: ${t.cardRadius}; padding: 20px 24px; margin-bottom: 12px; }
    .faq-q { font-family: 'Lexend', sans-serif; font-size: 15px; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
    .faq-a { font-size: 14px; color: var(--ink2); line-height: 1.7; }

    /* ── Related ── */
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
    .related-link { display: block; padding: 16px 20px; background: var(--card); border: 1px solid var(--stroke); border-radius: 12px; text-decoration: none; color: var(--ink); font-weight: 600; font-size: 14px; transition: all 0.2s; }
    .related-link:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-2px); box-shadow: 0 4px 12px var(--accent-ring); }

    /* ── CTA ── */
    .cta-section { background: var(--card); border: 1px solid var(--stroke); border-radius: ${t.cardRadius}; padding: 40px; text-align: center; margin-top: 48px; }
    .cta-section h2 { font-family: 'Lexend', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 12px; }
    .cta-section p { color: var(--muted); font-size: 14px; margin-bottom: 24px; }
    .cta-buttons { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
    .cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 14px; transition: all 0.2s; }
    .cta-btn.primary { background: var(--accent); color: #fff; box-shadow: 0 4px 12px var(--accent-ring); }
    .cta-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px var(--accent-ring); }
    .cta-btn.secondary { background: var(--card); border: 1.5px solid var(--stroke); color: var(--ink2); }
    .cta-btn.secondary:hover { border-color: var(--accent); color: var(--accent); }

    /* ── Footer ── */
    .blog-footer { text-align: center; padding: 32px 20px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--stroke); margin-top: 64px; }
    .blog-footer a { color: var(--accent); text-decoration: none; font-weight: 600; }

    ${t.specialCSS}
  </style>
</head>
<body>
  <!-- Static Navbar -->
  <header class="blog-nav">
    <div class="blog-nav-inner">
      <a class="blog-logo" href="../index.html">College <span>Simplified</span></a>
      <nav class="blog-nav-links">
        <a href="../index.html">Home</a>
        <a href="index.html">Blogs</a>
        <a href="../college_explorer.html">Explorer</a>
        <a href="../mht_cet_college_predictor.html">Predictor</a>
      </nav>
    </div>
  </header>

  <!-- Breadcrumb -->
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="../index.html">Home</a><span>›</span>
    <a href="index.html">College Blogs</a><span>›</span>
    ${escHtml(college.name)}
  </nav>

  <!-- Hero -->
  <section class="blog-hero">
    <div class="blog-hero-inner">
      <h1>${escHtml(college.name)} — Cutoffs, Seat Matrix & Placements ${CONFIG.YEAR}</h1>
      <div class="hero-badges">
        <span class="hero-badge code">Code: ${code}</span>
        <span class="hero-badge region">${escHtml(college.region)} Region</span>
        ${statusParts.map(s => `<span class="hero-badge status">${escHtml(s)}</span>`).join('')}
        ${placement.tier !== '—' ? `<span class="hero-badge tier">${escHtml(placement.tier)}</span>` : ''}
      </div>
    </div>
  </section>

  <div class="blog-wrap">
    <!-- Quick Stats -->
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">${branches.length}</div><div class="stat-label">Total Branches</div></div>
      <div class="stat-card"><div class="stat-val">${college.totalIntake}</div><div class="stat-label">Total Intake</div></div>
      <div class="stat-card"><div class="stat-val">${escHtml(placement.avgPackage)} <span style="font-size:14px">LPA</span></div><div class="stat-label">Avg Package</div></div>
      <div class="stat-card"><div class="stat-val">${escHtml(placement.tier)}</div><div class="stat-label">Placement Tier</div></div>
    </div>

    <!-- About -->
    <div class="section-hdr"><h2>About ${escHtml(college.name)}</h2></div>
    <div class="about-text">${escHtml(aboutText)}</div>

    ${branches.length > 0 ? `
    <!-- Seat Matrix -->
    <div class="section-hdr">
      <h2>Branch-Wise Seat Matrix — Detailed Category Breakdown</h2>
      <p>Complete seat distribution for all ${branches.length} branches including category-wise (SC/ST/OBC/OPEN) reservation splits.</p>
    </div>
    ${seatMatrixHTML}
    ` : ''}

    ${cetCutoffHTML ? `
    <!-- MHT-CET Cutoffs -->
    <div class="section-hdr">
      <h2>MHT-CET CAP Round Cutoffs (${CONFIG.CUTOFF_YEAR} Data)</h2>
      <p>Historical closing ranks and percentiles for all branches across CAP Rounds 1–4, by category. Each branch has its own detailed table below.</p>
    </div>
    ${cetCutoffHTML}
    ` : ''}

    ${jeeCutoffHTML ? `
    <!-- JEE Mains Cutoffs -->
    <div class="section-hdr">
      <h2>JEE Mains All India Quota Cutoffs (${CONFIG.CUTOFF_YEAR} Data)</h2>
      <p>All India quota closing ranks and percentiles via JEE Mains counselling, across all rounds.</p>
    </div>
    ${jeeCutoffHTML}
    ` : ''}

    <!-- FAQ Section -->
    <div class="section-hdr">
      <h2>Frequently Asked Questions about ${escHtml(college.name)}</h2>
    </div>
    ${faqHTML}

    ${relatedHTML ? `
    <!-- Related Colleges -->
    <div class="section-hdr"><h2>Explore Similar Colleges</h2></div>
    <div class="related-grid">${relatedHTML}</div>
    ` : ''}

    <!-- CTA -->
    <div class="cta-section">
      <h2>Explore More with ${CONFIG.SITE_NAME}</h2>
      <p>Use our advanced tools to predict your college, build preference lists, and compare institutions.</p>
      <div class="cta-buttons">
        <a href="../college_explorer.html?search=${encodeURIComponent(college.name)}" class="cta-btn primary">View in College Explorer →</a>
        <a href="../mht_cet_college_predictor.html" class="cta-btn secondary">College Predictor</a>
        <a href="../preference-builder.html" class="cta-btn secondary">Preference Builder</a>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="blog-footer">
    <p>© ${CONFIG.YEAR} <a href="../index.html">${CONFIG.SITE_NAME}</a> — All data is based on official ${CONFIG.CUTOFF_YEAR} CAP round data. Cutoffs are indicative and may vary.</p>
    <p style="margin-top:8px"><a href="../terms.html">Terms</a> · <a href="../privacy.html">Privacy</a> · <a href="../index.html">Home</a></p>
  </footer>
</body>
</html>`;
}

// ── Sitemap Generator ──────────────────────────────────────────
function updateSitemap(allSlugsData) {
  const sitemapPath = path.join(__dirname, 'sitemap.xml');
  let coreUrls = [];

  if (fs.existsSync(sitemapPath)) {
    const content = fs.readFileSync(sitemapPath, 'utf8');
    const urlRegex = /<url>([\s\S]*?)<\/url>/g;
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      const block = match[0];
      if (!block.includes('/blogs/')) {
        coreUrls.push(block.trim());
      }
    }
  }

  if (coreUrls.length === 0) {
    coreUrls = [
      `<url>\n    <loc>${CONFIG.BASE_URL}/</loc>\n    <lastmod>2026-07-16</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.00</priority>\n  </url>`,
      `<url>\n    <loc>${CONFIG.BASE_URL}/index.html</loc>\n    <lastmod>2026-07-16</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.90</priority>\n  </url>`,
      `<url>\n    <loc>${CONFIG.BASE_URL}/college_explorer.html</loc>\n    <lastmod>2026-07-16</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>`,
      `<url>\n    <loc>${CONFIG.BASE_URL}/mht_cet_college_predictor.html</loc>\n    <lastmod>2026-07-16</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>`,
      `<url>\n    <loc>${CONFIG.BASE_URL}/preference-builder.html</loc>\n    <lastmod>2026-07-16</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.80</priority>\n  </url>`
    ];
  }

  const today = new Date().toISOString().split('T')[0];
  const blogBlocks = [
    `<url>\n    <loc>${CONFIG.BASE_URL}/blogs/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.90</priority>\n  </url>`
  ];

  allSlugsData.forEach(s => {
    blogBlocks.push(`<url>\n    <loc>${CONFIG.BASE_URL}/blogs/${s.slug}.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.80</priority>\n  </url>`);
  });

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Core platform pages -->
  ${coreUrls.join('\n\n  ')}

  <!-- Blogs & reviews -->
  ${blogBlocks.join('\n\n  ')}
</urlset>`;

  fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
  console.log(`   ✓ sitemap.xml updated: added/updated ${allSlugsData.length} blog sitemap entries`);
}

// ── Landing Page Generator ─────────────────────────────────────
function generateLandingPage(allSlugs) {
  const cardsHTML = allSlugs.map(s => `
    <a href="${s.slug}.html" class="landing-card" id="card-${s.slug}">
      <div class="lc-top">
        <span class="lc-code">Code: ${String(s.code).padStart(4, '0')}</span>
        <h3 class="lc-name">${escHtml(s.name)}</h3>
        <div class="lc-meta">
          <span>${escHtml(s.region)}</span>
          <span>•</span>
          <span>${escHtml(s.status.split(',')[0])}</span>
        </div>
      </div>
      <div class="lc-bottom">
        <div class="lc-stats">
          <span>Avg: <strong>${escHtml(s.avgPkg)}</strong></span>
          ${s.tier !== '—' ? `<span class="lc-tier">${escHtml(s.tier)}</span>` : ''}
        </div>
        <span class="lc-arrow">Read Full Review →</span>
      </div>
    </a>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Engineering College Blogs — Detailed Reviews, Cutoffs & Seat Matrix ${CONFIG.YEAR} | ${CONFIG.SITE_NAME}</title>
  <meta name="description" content="Browse ${allSlugs.length}+ detailed engineering college reviews with MHT-CET cutoffs, branch-wise seat matrix, JEE Mains cutoffs, and placement data for ${CONFIG.YEAR}.">
  <meta name="keywords" content="engineering college blogs, MHT CET college reviews, seat matrix, cutoff data, Maharashtra engineering colleges, college simplified blogs">
  <link rel="canonical" href="${CONFIG.BASE_URL}/blogs/">
  <link rel="icon" type="image/png" href="../favicon.png">

  <meta property="og:title" content="Engineering College Blogs — ${CONFIG.SITE_NAME}">
  <meta property="og:description" content="Browse ${allSlugs.length}+ detailed college reviews with cutoffs, seat matrix & placement data.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${CONFIG.BASE_URL}/blogs/">
  <meta property="og:site_name" content="${CONFIG.SITE_NAME}">

  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Engineering College Blogs — ${CONFIG.SITE_NAME}`,
    description: `Detailed reviews for ${allSlugs.length}+ engineering colleges in Maharashtra`,
    url: `${CONFIG.BASE_URL}/blogs/`,
    publisher: { '@type': 'Organization', name: CONFIG.SITE_NAME },
  })}</script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lexend:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { --brand: #dc2626; --brand-soft: #fef2f2; --brand-ring: rgba(220,38,38,0.15); --ink: #111827; --ink2: #374151; --muted: #6b7280; --bg: #f8f9fb; --card: #ffffff; --stroke: #e5e7eb; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--ink); padding-top: 64px; -webkit-font-smoothing: antialiased; }

    .blog-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 500; height: 64px; background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--stroke); }
    .blog-nav-inner { max-width: 1200px; margin: 0 auto; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }
    .blog-logo { font-family: 'Lexend', sans-serif; font-weight: 800; font-size: 1.25rem; color: var(--brand); text-decoration: none; display: flex; align-items: center; gap: 4px; flex-shrink: 0; white-space: nowrap; line-height: 1; }
    .blog-logo span { color: var(--ink); }
    .blog-nav-links { display: flex; align-items: center; gap: 8px; }
    .blog-nav-links a { text-decoration: none; font-size: 13px; font-weight: 600; color: var(--muted); padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
    .blog-nav-links a:hover { background: var(--brand-soft); color: var(--brand); }

    .landing-hero { padding: 60px 20px 40px; text-align: center; max-width: 800px; margin: 0 auto; }
    .landing-hero h1 { font-family: 'Lexend', sans-serif; font-weight: 800; font-size: clamp(1.8rem, 5vw, 2.8rem); line-height: 1.15; margin-bottom: 16px; }
    .landing-hero h1 em { color: var(--brand); font-style: normal; }
    .landing-hero p { color: var(--muted); font-size: 16px; max-width: 600px; margin: 0 auto; }

    .landing-search-bar { max-width: 600px; margin: 32px auto; padding: 0 20px; position: relative; }
    .landing-search-bar input { width: 100%; padding: 16px 20px 16px 48px; border: 2px solid var(--stroke); border-radius: 16px; font-size: 15px; font-family: inherit; font-weight: 500; color: var(--ink); background: var(--card); outline: none; transition: 0.2s; }
    .landing-search-bar input:focus { border-color: var(--brand); box-shadow: 0 0 0 4px var(--brand-ring); }
    .landing-search-bar .search-icon { position: absolute; left: 36px; top: 50%; transform: translateY(-50%); color: var(--muted); }
    .landing-count { text-align: center; margin-bottom: 24px; font-size: 14px; font-weight: 700; color: var(--brand); background: var(--brand-soft); display: inline-block; padding: 6px 18px; border-radius: 100px; border: 1px solid var(--brand-ring); }
    .landing-count-wrap { text-align: center; margin-bottom: 32px; }

    .landing-grid { max-width: 1200px; margin: 0 auto; padding: 0 20px 80px; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .landing-card { background: var(--card); border: 1px solid var(--stroke); border-radius: 20px; padding: 24px; text-decoration: none; color: inherit; transition: all 0.3s cubic-bezier(0.16,1,0.3,1); display: flex; flex-direction: column; justify-content: space-between; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
    .landing-card:hover { transform: translateY(-6px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); border-color: var(--brand); }
    .lc-code { font-size: 10px; font-weight: 800; background: var(--brand-soft); color: var(--brand); padding: 3px 8px; border-radius: 6px; display: inline-block; margin-bottom: 6px; }
    .lc-name { font-family: 'Lexend', sans-serif; font-weight: 700; font-size: 15px; color: var(--ink); line-height: 1.4; }
    .lc-meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 6px; }
    .lc-bottom { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--stroke); padding-top: 12px; }
    .lc-stats { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 10px; }
    .lc-stats strong { color: var(--ink); }
    .lc-tier { font-size: 10px; font-weight: 700; background: #fef9c3; color: #b45309; padding: 2px 8px; border-radius: 6px; }
    .lc-arrow { font-size: 12px; font-weight: 700; color: var(--brand); }

    .blog-footer { text-align: center; padding: 32px 20px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--stroke); max-width: 1200px; margin: 0 auto; }
    .blog-footer a { color: var(--brand); text-decoration: none; font-weight: 600; }

    @media (max-width: 600px) {
      body { padding-top: 88px; }
      .landing-grid { grid-template-columns: 1fr; }
      .blog-nav { height: auto; padding: 10px 0; }
      .blog-nav-inner { flex-direction: column; gap: 8px; align-items: center; }
      .blog-logo { font-size: 1.1rem; gap: 2px; }
      .blog-logo span { font-size: 1.1rem; }
      .blog-nav-links { gap: 6px; }
      .blog-nav-links a { font-size: 11px; padding: 4px 8px; }
    }
  </style>
</head>
<body>
  <header class="blog-nav">
    <div class="blog-nav-inner">
      <a class="blog-logo" href="../index.html">College <span>Simplified</span></a>
      <nav class="blog-nav-links">
        <a href="../index.html">Home</a>
        <a href="../college_explorer.html">Explorer</a>
        <a href="../mht_cet_college_predictor.html">Predictor</a>
      </nav>
    </div>
  </header>

  <div class="landing-hero">
    <h1>Engineering College <em>Blogs</em></h1>
    <p>Detailed reviews with MHT-CET & JEE cutoffs, branch-wise seat matrix, placement data, and admission info for every engineering college in Maharashtra.</p>
  </div>

  <div class="landing-search-bar">
    <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" id="blogSearch" placeholder="Search college by name, code, or region..." oninput="filterCards()">
  </div>
  <div class="landing-count-wrap"><span class="landing-count" id="blogCount">${allSlugs.length} College Reviews</span></div>

  <div class="landing-grid" id="blogsGrid">
    ${cardsHTML}
  </div>

  <footer class="blog-footer">
    <p>© ${CONFIG.YEAR} <a href="../index.html">${CONFIG.SITE_NAME}</a> — Comprehensive engineering college data for Maharashtra.</p>
  </footer>

  <script>
    function filterCards() {
      var q = document.getElementById('blogSearch').value.toLowerCase().trim();
      var cards = document.querySelectorAll('.landing-card');
      var count = 0;
      cards.forEach(function(card) {
        var text = card.textContent.toLowerCase();
        var show = !q || text.includes(q);
        card.style.display = show ? '' : 'none';
        if (show) count++;
      });
      document.getElementById('blogCount').textContent = count + ' College Reviews';
    }
  </script>
</body>
</html>`;
}

// ── Main Execution ─────────────────────────────────────────────
function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  College Simplified — SEO Blog Generator');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  // Load progress
  let progress = { generated: [], lastIndex: 0 };
  if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
    try {
      progress = JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf8'));
    } catch (e) {
      console.log('⚠️  Could not read progress file, starting fresh.');
    }
  }

  // Load all data
  const { collegeList, placements, seatsData, cetData, jeeData, seoLines } = loadAllData();

  console.log('');
  console.log(`📊 Progress: ${progress.generated.length} already generated, starting from index ${progress.lastIndex}`);
  console.log(`📦 Batch size: ${CONFIG.BATCH_SIZE}`);
  console.log('');

  // Determine batch
  const startIdx = progress.lastIndex;
  const batch = seoLines.slice(startIdx, startIdx + CONFIG.BATCH_SIZE);

  if (batch.length === 0) {
    console.log('✅ All colleges have been generated! Nothing to do.');
    console.log(`   Total generated: ${progress.generated.length}`);
    return;
  }

  console.log(`🔨 Generating ${batch.length} blogs (colleges #${startIdx + 1} to #${startIdx + batch.length})...`);
  console.log('');

  const newSlugs = [];
  let generated = 0;

  for (let i = 0; i < batch.length; i++) {
    const seoName = batch[i];
    const college = findCollegeByName(seoName, collegeList);

    if (!college) {
      console.log(`   ⚠️  [${startIdx + i + 1}] Could not match: "${seoName}" — skipping`);
      continue;
    }

    const slug = slugify(college.name);

    // Skip if already generated
    if (progress.generated.includes(slug)) {
      console.log(`   ⏭️  [${startIdx + i + 1}] Already exists: ${slug}.html`);
      continue;
    }

    // Gather data
    const placement = findPlacement(college.name, college.code, placements);
    const seats = getCollegeSeats(college.code, seatsData);
    const branches = buildBranches(seats);
    const cetEntries = getCollegeCET(college.code, cetData);
    const jeeEntries = getCollegeJEE(college.code, jeeData);
    const cetByBranch = buildCETCutoffByBranch(cetEntries);
    const jeeByBranch = buildJEECutoffByBranch(jeeEntries);

    // Pick template
    const templateIdx = (startIdx + i) % TEMPLATES.length;
    const template = TEMPLATES[templateIdx];

    // All existing slugs for related links
    const allSlugsForRelated = [
      ...progress.generated.map(s => {
        const match = collegeList.find(c => slugify(c.name) === s);
        return match ? { slug: s, name: match.name } : { slug: s, name: s };
      }),
      ...newSlugs,
    ];

    // Generate HTML
    const html = generateBlogHTML(college, placement, branches, cetByBranch, jeeByBranch, template, allSlugsForRelated);

    // Write file
    const filePath = path.join(CONFIG.OUTPUT_DIR, `${slug}.html`);
    fs.writeFileSync(filePath, html, 'utf8');

    const cetBranchCount = Object.keys(cetByBranch).length;
    const jeeBranchCount = Object.keys(jeeByBranch).length;
    console.log(`   ✅ [${startIdx + i + 1}] ${college.name} → ${slug}.html (${template.name}, ${branches.length} branches, ${cetBranchCount} CET, ${jeeBranchCount} JEE)`);

    progress.generated.push(slug);
    newSlugs.push({
      slug, name: college.name, code: college.code,
      region: college.region, status: college.status,
      avgPkg: placement.avgPackage, tier: placement.tier,
    });
    generated++;
  }

  // Update progress
  progress.lastIndex = startIdx + batch.length;
  progress.totalAvailable = seoLines.length;
  progress.lastRunDate = new Date().toISOString();
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');

  // Generate landing page with ALL generated slugs
  console.log('');
  console.log('📄 Regenerating landing page (blogs/index.html)...');
  const allSlugsData = progress.generated.map(s => {
    const match = collegeList.find(c => slugify(c.name) === s);
    if (!match) return null;
    const p = findPlacement(match.name, match.code, placements);
    return {
      slug: s, name: match.name, code: match.code,
      region: match.region, status: match.status,
      avgPkg: p.avgPackage, tier: p.tier,
    };
  }).filter(Boolean);

  const landingHTML = generateLandingPage(allSlugsData);
  fs.writeFileSync(path.join(CONFIG.OUTPUT_DIR, 'index.html'), landingHTML, 'utf8');
  console.log('   ✅ blogs/index.html generated');

  // Regenerate sitemap.xml
  console.log('📄 Regenerating sitemap.xml...');
  updateSitemap(allSlugsData);

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Done! Generated ${generated} new blog pages.`);
  console.log(`  Total: ${progress.generated.length} / ${seoLines.length}`);
  console.log(`  Run again to generate the next batch.`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
}

main();
