const fs = require('fs');
const path = require('path');

const ROUNDS = [
  { file: 'COMEDK_ROUND_1.json', key: 'COMEDK_ROUND_1' },
  { file: 'COMEDK_ROUND_2.json', key: 'COMEDK_ROUND_2' },
  { file: 'COMEDK_ROUND_3.json', key: 'COMEDK_ROUND_3' },
  { file: 'COMEDK_ROUND_4.json', key: 'COMEDK_ROUND_4' }
];

ROUNDS.forEach(round => {
  const filePath = path.join(__dirname, round.file);
  if (!fs.existsSync(filePath)) {
    console.log(`${round.file} does not exist.`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rows = data[round.key] || [];
  console.log(`\n--- ${round.file} ---`);
  console.log(`Total rows: ${rows.length}`);

  const categories = new Set();
  const branches = new Set();
  
  rows.forEach(row => {
    if (row['Seat Category']) {
      categories.add(row['Seat Category']);
    }
    Object.keys(row).forEach(k => {
      if (k !== 'College Code' && k !== 'College Name' && k !== 'Seat Category' && k !== '') {
        branches.add(k);
      }
    });
  });

  console.log(`Seat Categories found:`, Array.from(categories));
  console.log(`Number of branches:`, branches.size);
  console.log(`Sample branches (first 10):`, Array.from(branches).slice(0, 10));
});
