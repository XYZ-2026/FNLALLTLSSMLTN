const fs = require('fs');

try {
  // 1. Process prediction on data.json
  const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  const list = data['MHT-CET College Data'] || data;
  const colMeta = JSON.parse(fs.readFileSync('college-data.json', 'utf8'));
  const metaList = colMeta["college-data"] || [];

  // Filter criteria
  const studentPct = 98.0;
  const targetCategory = 'MI';
  const targetMinority = 'Linguistic Minority - Gujarathi';

  console.log("=== STEP 1: Processing on data.json ===");
  // Filter logic mirroring satisfiesScoreRange and predict()
  const filtered = list.map(r => ({
    code: String(r['Institute Code'] || ''),
    name: (r['Institute'] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
    branch: (r['Branch'] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
    category: (r['Seat Type'] || '').trim(),
    rank: parseInt(String(r['Rank'] || '999999').replace(/,/g, '').trim()),
    percentile: parseFloat(String(r['Percentile'] || '0').trim())
  })).filter(r => {
    // Score eligibility (cutoff <= student percentile)
    if (r.percentile > studentPct) return false;

    // Category
    if (r.category !== targetCategory) return false;

    // Minority status filter
    if (targetMinority) {
      const meta = metaList.find(m => String(m["Institute Code"]) === r.code);
      if (!meta || !meta["Status"] || !meta["Status"].includes(targetMinority)) {
        return false;
      }
    }
    return true;
  });

  console.log(`Matched ${filtered.length} records. Sorting...`);
  filtered.sort((a, b) => b.percentile - a.percentile);

  console.log("Top matched predictions:");
  console.log(JSON.stringify(filtered, null, 2));

  // 2. Lookup rounds on cleaned_cet_data.json
  console.log("\n=== STEP 2: Looking up rounds in cleaned_cet_data.json ===");
  const cetData = JSON.parse(fs.readFileSync('cleaned_cet_data.json', 'utf8'));
  const cetMap = new Map();
  cetData.forEach(item => {
    const code = String(item.instituteCode || '').trim();
    const branch = String(item.branch || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const category = String(item.category || '').trim();
    const key = `${code}|${branch}|${category}`;
    cetMap.set(key, item.rounds || {});
  });

  const finalDisplay = filtered.map(r => {
    const lookupKey = `${r.code}|${r.branch.toLowerCase().replace(/\s+/g, ' ')}|${r.category}`;
    const rounds = cetMap.get(lookupKey) || {};
    return {
      code: r.code,
      name: r.name,
      branch: r.branch,
      category: r.category,
      rounds: rounds
    };
  });

  console.log("Final predictions with all rounds cutoffs:");
  console.log(JSON.stringify(finalDisplay, null, 2));

} catch (e) {
  console.error("Test error:", e);
}
