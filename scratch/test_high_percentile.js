const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  const list = data['MHT-CET College Data'] || data;
  
  console.log("Matching in data.json:");
  const matches = list.filter(item => {
    const seatType = item['Seat Type'] || '';
    const status = item['Institute Status'] || '';
    const percentile = parseFloat(item['Percentile'] || '0');
    return seatType === 'MI' && status.includes('Gujarathi') && percentile >= 90;
  });
  console.log(`Found ${matches.length} records in data.json with Percentile >= 90.`);
  console.log(JSON.stringify(matches, null, 2));

} catch(e) {
  console.error(e);
}
