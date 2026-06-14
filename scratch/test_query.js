const fs = require('fs');

try {
  console.log("Reading data.json...");
  const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  const list = data['MHT-CET College Data'] || data;
  console.log("Total entries in data.json:", list.length);

  // Search for MI or Gujarathi or Jain in data.json
  const gujJainData = list.filter(item => {
    const category = String(item['Category'] || item['category'] || '');
    const inst = String(item['Institute'] || item['name'] || '');
    return category.includes('MI') || category.includes('Jain') || category.includes('Gujarathi') || inst.includes('Jain');
  });

  console.log(`Found ${gujJainData.length} records matching search criteria in data.json. Sample:`);
  console.log(JSON.stringify(gujJainData.slice(0, 3), null, 2));

  // Let's count categories in data.json
  const categoriesData = new Set();
  list.forEach(item => {
    if (item.Category) categoriesData.add(item.Category);
  });
  console.log("Unique Categories in data.json (first 30):", Array.from(categoriesData).slice(0, 30));

  console.log("\nReading cleaned_cet_data.json...");
  const cetData = JSON.parse(fs.readFileSync('cleaned_cet_data.json', 'utf8'));
  console.log("Total entries in cleaned_cet_data.json:", cetData.length);

  const gujJainCet = cetData.filter(item => {
    const category = String(item['Category'] || item['category'] || '');
    const inst = String(item['instituteName'] || '');
    return category.includes('MI') || category.includes('Jain') || category.includes('Gujarathi') || inst.includes('Jain');
  });

  console.log(`Found ${gujJainCet.length} records matching search in cleaned_cet_data.json. Sample:`);
  console.log(JSON.stringify(gujJainCet.slice(0, 3), null, 2));

  // Let's print round cutoff details for a sample record
  if (gujJainCet.length > 0) {
    console.log("Sample round details in cleaned_cet_data.json:", JSON.stringify(gujJainCet[0].rounds, null, 2));
  }

} catch(e) {
  console.error(e);
}
