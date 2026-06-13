const fs = require('fs');

function getBaseCategory(cat) {
  if (['EWS', 'TFWS', 'MI', 'ORPHAN'].includes(cat)) return cat;
  if (cat.endsWith('H') || cat.endsWith('O') || cat.endsWith('S')) {
    return cat.slice(0, -1);
  }
  return cat;
}

function getGenderFreeCategory(cat) {
  if (!cat) return '';
  let base = cat;
  if (cat.endsWith('H') || cat.endsWith('O') || cat.endsWith('S')) {
    base = cat.slice(0, -1);
  }
  if (['EWS', 'TFWS', 'MI', 'ORPHAN'].includes(base)) return base;
  if (base.startsWith('G') || base.startsWith('L')) {
    return base.slice(1);
  }
  return base;
}

try {
  console.log("Loading cleaned_cet_data.json...");
  const json = JSON.parse(fs.readFileSync('cleaned_cet_data.json', 'utf8'));
  console.log("Loaded. Records count:", json.length);
  const allData = (json || []).map(r => ({
    code: String(r.instituteCode || ''),
    name: (r.instituteName || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
    branch: (r.branch || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
    category: String(r.category || '').trim(),
    rounds: r.rounds || {}
  })).filter(r => r.category !== 'AI' && r.category !== 'All India');

  const bSet = new Set();
  const cleanCatSet = new Set();
  allData.forEach(r => {
    if (r.branch) bSet.add(r.branch.trim());
    if (r.category) cleanCatSet.add(getGenderFreeCategory(r.category));
  });
  console.log("Unique clean categories:", Array.from(cleanCatSet));
  console.log("Success!");
} catch(e) {
  console.error("Crash Error:", e);
}
