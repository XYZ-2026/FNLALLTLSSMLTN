const fs = require('fs');

try {
  console.time('Load cleaned_cet_data.json');
  const cetData = JSON.parse(fs.readFileSync('cleaned_cet_data.json', 'utf8'));
  console.timeEnd('Load cleaned_cet_data.json');

  console.time('Index cleaned_cet_data.json');
  const cetMap = new Map();
  cetData.forEach(item => {
    const code = String(item.instituteCode || '').trim();
    const branch = String(item.branch || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const category = String(item.category || '').trim();
    const key = `${code}|${branch}|${category}`;
    cetMap.set(key, item.rounds || {});
  });
  console.timeEnd('Index cleaned_cet_data.json');

  console.time('Load data.json');
  const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  const list = data['MHT-CET College Data'] || data;
  console.timeEnd('Load data.json');

  console.time('Merge data');
  const merged = list.map(r => {
    const code = String(r['Institute Code'] || '').trim();
    const name = (r['Institute'] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const branch = (r['Branch'] || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const category = (r['Seat Type'] || '').trim();
    const rank = parseInt(r['Rank'] || '999999');
    const percentile = parseFloat(r['Percentile'] || '0');

    // lookup in cetMap
    const key = `${code}|${branch.toLowerCase().replace(/\s+/g, ' ')}|${category}`;
    const rounds = cetMap.get(key) || {
      R1: { rank: rank, percentile: percentile }
    };

    return {
      code,
      name,
      branch,
      category,
      rank,
      percentile,
      rounds
    };
  });
  console.timeEnd('Merge data');

  console.log("Total merged records:", merged.length);

  // Let's test the specific user combination:
  // Percentile: 98, Category: MI, Minority: Linguistic Minority - Gujarathi(Jain), Home Univ: None, Region: All Regions
  console.log("\nSimulating predictor for combination:");
  const studentPct = 98.0;
  const targetCategory = 'MI';
  const targetMinority = 'Linguistic Minority - Gujarathi(Jain)'; // 3148

  // Load college-data.json
  const colMeta = JSON.parse(fs.readFileSync('college-data.json', 'utf8'));
  const metaList = colMeta["college-data"] || [];

  // Filter
  const filtered = merged.filter(r => {
    // Score check (percentile <= studentPct)
    // Wait, let's check if the cutoff is less than or equal to the student's percentile
    if (r.percentile > studentPct) return false;

    // Category check
    if (r.category !== targetCategory) return false;

    // Minority check
    if (targetMinority) {
      const meta = metaList.find(m => String(m["Institute Code"]) === r.code);
      if (!meta || !meta["Status"] || !meta["Status"].includes(targetMinority)) {
        return false;
      }
    }

    return true;
  });

  console.log(`Matched colleges: ${filtered.length}`);
  console.log(JSON.stringify(filtered, null, 2));

} catch(e) {
  console.error(e);
}
