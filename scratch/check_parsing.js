const fs = require('fs');

const json = JSON.parse(fs.readFileSync('ALL_CLG_PLACEMENT_TIER.json', 'utf8'));
const jsonList = json.ALL_CLG_PLACEMENT_TIER;

function parsePackageValue(pkgStr) {
  if (!pkgStr) return 0;
  // Replace Unicode en-dashes with standard hyphens, then strip non-numeric characters except dots and hyphens
  const clean = String(pkgStr).replace(/–/g, '-').replace(/[^0-9.\-]/g, '');
  if (clean.includes('-')) {
    const parts = clean.split('-');
    const val1 = parseFloat(parts[0]) || 0;
    const val2 = parseFloat(parts[1]) || 0;
    return (val1 + val2) / 2;
  }
  return parseFloat(clean) || 0;
}

jsonList.forEach(item => {
  const pkgStr = item['Avg Package (LPA)'];
  const parsed = parsePackageValue(pkgStr);
  console.log(`Original: "${pkgStr}" -> Parsed: ${parsed}`);
});
