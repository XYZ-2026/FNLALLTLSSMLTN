const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase_private_key.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('Error: Service account credentials JSON not found');
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  try {
    // 1. Fetch all colleges to build a map of ID -> Name
    console.log("Fetching colleges...");
    const collegesSnap = await db.collection('ss_colleges').get();
    const collegeMap = {};
    collegesSnap.forEach(doc => {
      collegeMap[doc.id] = doc.data().title || doc.data().name || "Unknown College";
    });
    console.log("Colleges mapped:", collegeMap);

    // 2. Fetch free library data (access === 'free')
    console.log("\nFetching free library PDFs...");
    const pdfsSnap = await db.collection('pdfs')
      .where('access', '==', 'free')
      .get();
    
    console.log(`Found ${pdfsSnap.size} free library items.`);
    
    const results = [];
    pdfsSnap.forEach(doc => {
      const data = doc.data();
      const collegeName = collegeMap[data.college_id] || `Unknown (${data.college_id})`;
      results.push({
        id: doc.id,
        title: data.title,
        college_id: data.college_id,
        college_name: collegeName,
        domain: data.domain,
        section: data.section,
        subsection: data.subsection,
        subsubsection: data.subsubsection,
        poster_name: data.poster_name
      });
    });

    // Write results to a local JSON file in scratch folder for easy viewing/sharing
    const outputPath = path.join(__dirname, 'free_library_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Successfully wrote ${results.length} records to ${outputPath}`);

    // Print first 10 for quick preview
    console.log("\nPreview of first 10 items:");
    results.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. [${item.id}] ${item.title} -> Associated College: ${item.college_name}`);
    });

  } catch (err) {
    console.error("Error fetching library data:", err);
  } finally {
    process.exit(0);
  }
}

run();
