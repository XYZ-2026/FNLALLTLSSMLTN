const fs = require('fs');

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

// Read CSV
const csvText = fs.readFileSync('mhtcet_colleges_with_codes.csv', 'utf8');
const csvParsed = parseCSV(csvText);

// Read JSON
const json = JSON.parse(fs.readFileSync('ALL_CLG_PLACEMENT_TIER.json', 'utf8'));
const jsonList = json.ALL_CLG_PLACEMENT_TIER;

console.log('Total JSON entries:', jsonList.length);
console.log('Total CSV entries:', csvParsed.length);

const cleanName = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '');

for (let i = 0; i < 20; i++) {
  const item = jsonList[i];
  const jName = item['College Name'];
  const jPkg = item['Avg Package (LPA)'];
  const jTier = item['Tier'];
  
  // Find in CSV by name
  let csvPkg = 'Not Found';
  const match = csvParsed.find(c => {
    const cName = c.name;
    return cleanName(cName) === cleanName(jName) || cleanName(cName).includes(cleanName(jName)) || cleanName(jName).includes(cleanName(cName));
  });
  if (match) {
    csvPkg = match.avgPackage;
  }
  console.log(`JSON: "${jName}" | JSON Avg Package: ${jPkg} | CSV Avg Package: ${csvPkg}`);
}
