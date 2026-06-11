const fs = require('fs');

const roundData = {
  COMEDK_ROUND_1: JSON.parse(fs.readFileSync('COMEDK/COMEDK_ROUND_1.json', 'utf8')).COMEDK_ROUND_1,
  COMEDK_ROUND_2: JSON.parse(fs.readFileSync('COMEDK/COMEDK_ROUND_2.json', 'utf8')).COMEDK_ROUND_2,
  COMEDK_ROUND_3: JSON.parse(fs.readFileSync('COMEDK/COMEDK_ROUND_3.json', 'utf8')).COMEDK_ROUND_3,
  COMEDK_ROUND_4: JSON.parse(fs.readFileSync('COMEDK/COMEDK_ROUND_4.json', 'utf8')).COMEDK_ROUND_4
};

const ROUND_KEYS = ['COMEDK_ROUND_1', 'COMEDK_ROUND_2', 'COMEDK_ROUND_3', 'COMEDK_ROUND_4'];

function cleanBranchKey(k) {
  return k.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanRoundData(rows) {
  return rows.filter(r => r['College Code'] && r['College Code'] !== 'College Code');
}

// Clean all rounds
ROUND_KEYS.forEach(k => {
  roundData[k] = cleanRoundData(roundData[k]);
});

// Extract branches
const allBranchMap = new Map();
ROUND_KEYS.forEach(key => {
  const rows = roundData[key];
  rows.forEach(row => {
    Object.keys(row).forEach(k => {
      if (k !== 'College Code' && k !== 'College Name' && k !== 'Seat Category' && k !== '') {
        const clean = cleanBranchKey(k);
        if (clean && !allBranchMap.has(clean)) {
          allBranchMap.set(clean, k);
        }
      }
    });
  });
});

const allBranches = [...allBranchMap.keys()].sort();

const rank = 15000;
const category = 'GM';
const branchesToSearch = allBranches;

const rowMap = new Map();

ROUND_KEYS.forEach((roundKey, roundIdx) => {
  const rows = roundData[roundKey] || [];
  rows.forEach(row => {
    if (category !== 'ALL' && row['Seat Category'] !== category) return;

    const code = row['College Code'];
    const name = (row['College Name'] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    branchesToSearch.forEach(branchClean => {
      let val = null;
      Object.keys(row).forEach(k => {
        if (cleanBranchKey(k) === branchClean) {
          val = row[k];
        }
      });
      if (val && String(val).trim() !== '') {
        const cutoffRank = parseInt(val);
        if (!isNaN(cutoffRank)) {
          const rowCat = row['Seat Category'];
          const key = code + '|' + branchClean + '|' + rowCat;
          if (!rowMap.has(key)) {
            rowMap.set(key, {
              code, name, branch: branchClean, category: rowCat,
              rounds: new Array(ROUND_KEYS.length).fill(null)
            });
          }
          rowMap.get(key).rounds[roundIdx] = cutoffRank;
        }
      }
    });
  });
});

const results = [];
rowMap.forEach(entry => {
  let hasMatch = false;
  entry.rounds.forEach(cutoff => {
    if (cutoff !== null && rank <= cutoff) {
      hasMatch = true;
    }
  });

  if (hasMatch) {
    const validCutoffs = entry.rounds.filter(c => c !== null);
    entry._sortKey = validCutoffs.length > 0 ? Math.min(...validCutoffs) : 999999;
    results.push(entry);
  }
});

console.log('Total predicted results:', results.length);
console.log('Sample results:', results.slice(0, 5));
