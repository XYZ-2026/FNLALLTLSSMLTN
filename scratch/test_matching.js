const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  const list = data['MHT-CET College Data'] || data;
  const cetData = JSON.parse(fs.readFileSync('cleaned_cet_data.json', 'utf8'));

  console.log("Total entries in data.json:", list.length);
  console.log("Total entries in cleaned_cet_data.json:", cetData.length);

  // Index cleaned_cet_data.json for fast lookup
  const cetMap = new Map();
  cetData.forEach(item => {
    const code = String(item.instituteCode || '').trim();
    const branch = String(item.branch || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const category = String(item.category || '').trim();
    const key = `${code}|${branch}|${category}`;
    cetMap.set(key, item);
  });

  let matchedCount = 0;
  let unmatchedCount = 0;
  const samples = [];

  list.forEach(item => {
    const code = String(item['Institute Code'] || '').trim();
    const branch = String(item['Branch'] || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const category = String(item['Seat Type'] || '').trim();
    const key = `${code}|${branch}|${category}`;

    if (cetMap.has(key)) {
      matchedCount++;
      if (samples.length < 5) {
        samples.push({
          dataEntry: item,
          cetEntry: cetMap.get(key)
        });
      }
    } else {
      unmatchedCount++;
    }
  });

  console.log(`Matched entries: ${matchedCount}`);
  console.log(`Unmatched entries: ${unmatchedCount}`);
  console.log("Sample matches:");
  console.log(JSON.stringify(samples, null, 2));

  // Let's look at some unmatched to see if there's a minor difference (like branch name strings)
  console.log("\nSome unmatched entries:");
  let printed = 0;
  for (let item of list) {
    const code = String(item['Institute Code'] || '').trim();
    const branch = String(item['Branch'] || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const category = String(item['Seat Type'] || '').trim();
    const key = `${code}|${branch}|${category}`;
    if (!cetMap.has(key)) {
      console.log(`Unmatched key: ${key}`);
      // Find entries with same code & category but different branch name
      const candidates = cetData.filter(c => String(c.instituteCode) === code && String(c.category) === category);
      if (candidates.length > 0) {
        console.log(`  Similar in cleaned_cet_data.json (branches):`, candidates.slice(0, 3).map(c => c.branch));
      }
      printed++;
      if (printed >= 5) break;
    }
  }

} catch(e) {
  console.error(e);
}
