const fs = require('fs');

try {
  const cetData = JSON.parse(fs.readFileSync('cleaned_cet_data.json', 'utf8'));
  const targetCode = '3199';
  const matched = cetData.filter(item => String(item.instituteCode) === targetCode);

  console.log(`Found ${matched.length} records for 3199 in cleaned_cet_data.json.`);
  const categories = new Set();
  matched.forEach(item => {
    if (item.category) categories.add(item.category);
  });
  console.log("Categories for 3199 in cleaned_cet_data.json:", Array.from(categories));

  const miRecords = matched.filter(item => item.category === 'MI');
  console.log(`Found ${miRecords.length} MI records for 3199 in cleaned_cet_data.json.`);
  console.log(JSON.stringify(miRecords.slice(0, 3), null, 2));

} catch(e) {
  console.error(e);
}
