const fs = require('fs');
const path = require('path');

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

try {
  const details = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'COMEDK', 'COMDEK_CLG_DETAILS.json'), 'utf8'));
  const DETAILS_BY_NORM_NAME = new Map();

  details.COMDEK_CLG_DETAILS.forEach(row => {
    let rawName = row['College Name'] || '';
    if (!rawName) return;
    // Replace newlines with spaces to prevent splitting them
    rawName = rawName.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    const normName = normalizeCollegeName(rawName);
    if (!DETAILS_BY_NORM_NAME.has(normName)) {
      DETAILS_BY_NORM_NAME.set(normName, {
        code: row['College Code'] || '',
        name: rawName,
        branches: []
      });
    }
  });

  const cutoffGM = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'COMEDK', 'COMEDK_GM_CUTOFF.json'), 'utf8'));
  const cutoffColleges = Array.from(new Set(cutoffGM.COMEDK_GM_CUTOFF.map(r => r.College.split('\n')[0].replace(/\s+/g, ' ').trim())));

  let matchCount = 0;
  const unmatched = [];

  cutoffColleges.forEach(col => {
    let targetName = col;
    if (COLLEGE_NAME_MAP[col]) {
      targetName = COLLEGE_NAME_MAP[col];
    }
    const norm = normalizeCollegeName(targetName);
    if (DETAILS_BY_NORM_NAME.has(norm)) {
      matchCount++;
    } else {
      unmatched.push(col);
    }
  });

  console.log(`Matching Results:`);
  console.log(`Total Cutoff Colleges: ${cutoffColleges.length}`);
  console.log(`Successfully Matched: ${matchCount} / ${cutoffColleges.length}`);
  console.log(`Unmatched (will fallback gracefully):`);
  console.log(unmatched);

} catch (err) {
  console.error(err);
}
