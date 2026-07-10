const fs = require('fs');
const path = require('path');

try {
  const details = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'COMEDK', 'COMDEK_CLG_DETAILS.json'), 'utf8'));
  const detailsColleges = Array.from(new Set(details.COMDEK_CLG_DETAILS.map(r => r['College Name'])));

  const unmatched = [
    'Karavali Institute of Technology-Kottara, Mangaluru',
    'New Ebenezer Institute of Technology - Kothanur, Bangalore',
    'KLE Technological University Formerly called as KLE Dr. M.S. Sheshgiri College of Engineering and Technology-Udyambag, Belagavi',
    'Amruta Institute of Engineering and Management Science-Bidadi, Ramnagar Taluk, Bengaluru Rural',
    'Seshadripuram Institute of Technology - Jaipura Hobli, Mysuru',
    'Yenepoya Institute of Technology formerly known as Dr. M V Shetty Institute of Technology-Moodbidri, Mangaluru',
    'C Byregowda Insitute of Technology-Thoradevandahalli, Kolar',
    'Shetty Institute of Technology - Gulbarga Shahabad Road, Kalaburagi',
    'Vidya Vikas Institute of Engineering and Technology-Alnahally, Mysuru'
  ];

  unmatched.forEach(col => {
    console.log(`\nUnmatched: ${col}`);
    const words = col.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && w !== 'institute' && w !== 'technology' && w !== 'engineering' && w !== 'college');
    
    // Find detailsColleges containing at least one key word
    const candidates = [];
    detailsColleges.forEach(dc => {
      const dcLower = dc.toLowerCase();
      let matchScore = 0;
      words.forEach(w => {
        if (dcLower.includes(w)) matchScore++;
      });
      if (matchScore > 0) {
        candidates.push({ name: dc, score: matchScore });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    console.log('Candidates in details:');
    candidates.slice(0, 3).forEach(cand => {
      console.log(`  - [Score ${cand.score}] ${cand.name}`);
    });
  });

} catch (err) {
  console.error(err);
}
