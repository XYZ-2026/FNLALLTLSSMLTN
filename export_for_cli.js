/**
 * College Simplified — Export Users for Firebase CLI
 * ────────────────────────────────────────────────
 * Exports all Firestore users with custom hashed passwords into a JSON file
 * formatted for the Firebase CLI 'firebase auth:import' command.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'mht-cet-counselling-firebase-adminsdk-fbsvc-b880bf1aa7.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('Error: Service account credentials JSON not found!');
  process.exit(1);
}


const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const PASSWORD_SALT = '_cs_salt_2026';
const base64Salt = Buffer.from(PASSWORD_SALT).toString('base64');

async function exportUsers() {
  console.log('Fetching users from Firestore...');
  const snap = await db.collection('users').get();
  console.log(`Found ${snap.size} users.`);

  const users = [];

  snap.forEach(doc => {
    const data = doc.data();
    if (!data.email || !data.password) return;

    try {
      users.push({
        localId: doc.id,
        email: data.email,
        displayName: data.name || undefined,
        phoneNumber: data.phone ? formatPhoneNumber(data.phone) : undefined,
        passwordHash: Buffer.from(data.password, 'hex').toString('base64'),
        salt: base64Salt,
        disabled: false
      });
    } catch (e) {
      console.error(`Error processing ${data.email}:`, e.message);
    }
  });

  const output = { users };
  const outputPath = path.join(__dirname, 'users_for_import.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\nSuccess! Exported ${users.length} users to: ${outputPath}`);
  console.log('\nNow run this Firebase CLI command to import them with the correct password hash order:');
  console.log('\x1b[36m%s\x1b[0m', `firebase auth:import users_for_import.json --hash-algo=SHA256 --rounds=1 --hash-input-order=PASSWORD_FIRST --project=mht-cet-counselling`);
}

function formatPhoneNumber(phone) {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+') && cleaned.length >= 8 && cleaned.length <= 15) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  return undefined;
}

exportUsers().catch(console.error);
