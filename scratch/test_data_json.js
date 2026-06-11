const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const list = data['MHT-CET College Data'] || data;

console.log('Total entries in data.json:', list.length);

const codes = new Set();
list.forEach(item => {
  codes.add(item['Institute Code']);
});

console.log('All unique codes in data.json:', Array.from(codes).slice(0, 50).join(', '));
console.log('Is 3012 present?', codes.has('3012'));
console.log('Is 6006 present?', codes.has('6006'));
console.log('Is 16006 present?', codes.has('16006'));

// Print some entries for 3012 or 6006 if found
const coep = list.find(item => item['Institute Code'] === '6006' || item['Institute Code'] === '16006' || (item.Institute && item.Institute.includes('COEP')));
console.log('COEP match in data.json:', coep);

const vjti = list.find(item => item['Institute Code'] === '3012' || (item.Institute && item.Institute.includes('VJTI')));
console.log('VJTI match in data.json:', vjti);
