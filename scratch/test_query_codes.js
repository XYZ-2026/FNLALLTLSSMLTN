const fs = require('fs');

try {
  const cetData = JSON.parse(fs.readFileSync('cleaned_cet_data.json', 'utf8'));
  console.log("Total records in cleaned_cet_data.json:", cetData.length);

  const targetCodes = ['3148', '3199', '3209'];
  const matched = cetData.filter(item => targetCodes.includes(item.instituteCode));

  console.log(`Found ${matched.length} records for codes 3148, 3199, 3209 in cleaned_cet_data.json.`);
  
  // Let's see unique categories for these colleges
  const categories = new Set();
  matched.forEach(item => {
    if (item.category) categories.add(item.category);
  });
  console.log("Categories found for these colleges:", Array.from(categories));

  // Let's print some sample records of these colleges
  console.log("Sample records:");
  console.log(JSON.stringify(matched.slice(0, 10), null, 2));

} catch(e) {
  console.error(e);
}
