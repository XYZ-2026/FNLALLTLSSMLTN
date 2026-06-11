const fs = require('fs');

// Read CSV
function parseCSV(text) {
  const lines = text.split('\n');
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row = [];
    let inQuotes = false;
    let currentField = '';
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());
    if (row.length >= 5) {
      result.push({
        srNo: row[0],
        name: row[1].replace(/^"|"$/g, ''),
        avgPackage: row[2].replace(/^"|"$/g, ''),
        tier: row[3].replace(/^"|"$/g, ''),
        code: row[4].replace(/^"|"$/g, '')
      });
    }
  }
  return result;
}

const csvText = fs.readFileSync('mhtcet_colleges_with_codes.csv', 'utf8');
const COLLEGES = parseCSV(csvText);

const json = JSON.parse(fs.readFileSync('ALL_CLG_PLACEMENT_TIER.json', 'utf8'));
const PLACEMENT_DATA = json.ALL_CLG_PLACEMENT_TIER;

function getPlacementDetails(collegeName) {
  if (!collegeName) return null;
  const lower = collegeName.toLowerCase();

  // Try exact or substring match
  let match = PLACEMENT_DATA.find(p => {
    const pName = p["College Name"].toLowerCase();
    return pName === lower || lower.includes(pName) || pName.includes(lower);
  });
  if (match) return match;

  // Split significant words
  const words = lower.split(/[\s,().\-]+/);
  for (let i = 0; i < PLACEMENT_DATA.length; i++) {
    const p = PLACEMENT_DATA[i];
    const pName = p["College Name"].toLowerCase();
    const pWords = pName.split(/[\s,().\-]+/);
    const sigWords = pWords.filter(w => w.length > 2 && !['college', 'engineering', 'institute', 'technology', 'and', 'for', 'women'].includes(w));

    if (sigWords.length > 0) {
      const allMatch = sigWords.every(w => lower.includes(w));
      if (allMatch) return p;
    }
  }
  return null;
}

COLLEGES.forEach(c => {
  const p = getPlacementDetails(c.name);
  if (p && p['College Name'].toLowerCase() !== c.name.toLowerCase()) {
    console.log(`Mismatch: Selected "${c.name}" -> Matched "${p['College Name']}"`);
    console.log(`  CSV Avg Package: ${c.avgPackage} | Matched JSON Avg Package: ${p['Avg Package (LPA)']}`);
  }
});
