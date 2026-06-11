const fs = require('fs');
const compareHtml = fs.readFileSync('compare_colleges.html', 'utf8');

// Find the line containing "replace(/[^0-9"
const lines = compareHtml.split('\n');
const line = lines.find(l => l.includes('replace(/[^0-9'));
console.log('Line found:', line.trim());

// Print all characters of that line with their code points
for (let i = 0; i < line.length; i++) {
  const c = line[i];
  console.log(`${i}: '${c}' -> ${c.charCodeAt(0)}`);
}
