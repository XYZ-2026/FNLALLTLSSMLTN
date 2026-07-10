const fs = require('fs');
const path = require('path');

function normalize(name) {
  if (!name) return '';
  let clean = name.split('\n')[0].replace(/\s+/g, ' ').trim().toLowerCase();
  clean = clean.replace(/^(dr\.|sri|shri|smt\.|the)\s+/g, '');
  return clean.replace(/[^a-z0-9]/g, '');
}

try {
  const details = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'COMEDK', 'COMDEK_CLG_DETAILS.json'), 'utf8'));
  const detailsColleges = Array.from(new Set(details.COMDEK_CLG_DETAILS.map(r => r['College Name'])));

  console.log('Details colleges containing AGM:');
  detailsColleges.filter(c => c.toLowerCase().includes('agm') || c.toLowerCase().includes('a.g.m')).forEach(c => {
    console.log(`  - "${c}" -> Normalized: "${normalize(c)}"`);
  });

  const cutoffGM = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'COMEDK', 'COMEDK_GM_CUTOFF.json'), 'utf8'));
  const cutoffColleges = Array.from(new Set(cutoffGM.COMEDK_GM_CUTOFF.map(r => r.College)));
  console.log('\nCutoff colleges containing AGM:');
  cutoffColleges.filter(c => c.toLowerCase().includes('agm') || c.toLowerCase().includes('a.g.m')).forEach(c => {
    console.log(`  - "${c}" -> Normalized: "${normalize(c)}"`);
  });

} catch (err) {
  console.error(err);
}
