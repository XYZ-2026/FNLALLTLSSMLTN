const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  const list = data['MHT-CET College Data'] || data;

  const targetCategory = 'GOPENS';
  const studentPct = 98.0;

  // Selected regions: 3 (Mumbai) and 6 (Pune)
  const selectedRegions = new Set(['3', '6']);

  console.log("=== Testing Multi-Region Filtering (Mumbai [3] & Pune [6]) ===");

  const filtered = list.map(r => ({
    code: String(r['Institute Code'] || ''),
    name: (r['Institute'] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
    branch: (r['Branch'] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
    category: (r['Seat Type'] || '').trim(),
    rank: parseInt(String(r['Rank'] || '999999').replace(/,/g, '').trim()),
    percentile: parseFloat(String(r['Percentile'] || '0').trim())
  })).filter(r => {
    if (r.percentile > studentPct) return false;
    if (r.category !== targetCategory) return false;

    // Region Filter (using selectedRegions)
    if (!selectedRegions.has('all')) {
      const s = String(r.code || '').trim();
      if (!s) return false;
      const clean = s.replace(/^0+/, '');
      const char = clean.length === 5 ? clean.charAt(1) : clean.charAt(0);
      return selectedRegions.has(char);
    }
    return true;
  });

  console.log(`Found ${filtered.length} matching entries.`);
  
  // Let's verify if all matched records belong to region 3 or 6
  const invalidRegions = filtered.filter(r => {
    const s = String(r.code || '').trim();
    const clean = s.replace(/^0+/, '');
    const char = clean.length === 5 ? clean.charAt(1) : clean.charAt(0);
    return char !== '3' && char !== '6';
  });

  if (invalidRegions.length === 0) {
    console.log("SUCCESS: All matched colleges are in Mumbai (3) or Pune (6)!");
  } else {
    console.error(`FAILURE: Found ${invalidRegions.length} colleges outside selected regions:`, invalidRegions.slice(0, 5));
  }

  // Print sample matches
  console.log("\nSample matches:");
  console.log(JSON.stringify(filtered.slice(0, 5), null, 2));

} catch(e) {
  console.error(e);
}
