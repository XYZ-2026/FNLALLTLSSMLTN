const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  const list = data['MHT-CET College Data'] || data;
  console.log("Searching data.json...");
  
  const miData = list.filter(item => {
    const seatType = item['Seat Type'] || '';
    const status = item['Institute Status'] || '';
    return seatType === 'MI' && status.includes('Gujarathi');
  });
  console.log(`Found ${miData.length} MI-Gujarathi records in data.json.`);
  if (miData.length > 0) {
    console.log("Sample MI-Gujarathi from data.json:", JSON.stringify(miData.slice(0, 5), null, 2));
  }

  const jainData = list.filter(item => {
    const seatType = item['Seat Type'] || '';
    const status = item['Institute Status'] || '';
    return seatType === 'MI' && status.toLowerCase().includes('jain');
  });
  console.log(`Found ${jainData.length} MI-Jain records in data.json.`);
  if (jainData.length > 0) {
    console.log("Sample MI-Jain from data.json:", JSON.stringify(jainData.slice(0, 5), null, 2));
  }

  console.log("\nSearching cleaned_cet_data.json...");
  const cetData = JSON.parse(fs.readFileSync('cleaned_cet_data.json', 'utf8'));
  
  const miCetGuj = cetData.filter(item => {
    return item.category === 'MI' && (
      (item.instituteName && item.instituteName.includes('Gujarathi')) ||
      (item.branch && item.branch.includes('Gujarathi'))
    );
  });
  console.log(`Found ${miCetGuj.length} MI-Gujarathi records in cleaned_cet_data.json directly.`);

  // Let's search by institute status from college-data.json
  const colMeta = JSON.parse(fs.readFileSync('college-data.json', 'utf8'));
  const metaList = colMeta["college-data"] || [];
  
  const gujMeta = metaList.filter(m => {
    const status = m["Status"] || '';
    return status.includes('Gujarathi') || status.toLowerCase().includes('jain');
  });
  console.log(`Found ${gujMeta.length} colleges with Gujarathi or Jain status in college-data.json.`);
  console.log(JSON.stringify(gujMeta.map(m => ({ code: m["Institute Code"], name: m["Institute Name"], status: m["Status"] })), null, 2));

} catch(e) {
  console.error(e);
}
