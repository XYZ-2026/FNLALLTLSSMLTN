const admin = require('firebase-admin');

exports.handler = async function (event, context) {
  // CORS Headers for client safety
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: { message: 'Method Not Allowed' } })
    };
  }

  // 1. API Key Protection
  const apiKey = process.env.SYNC_API_KEY;
  const requestApiKey = event.headers['x-api-key'] || event.headers['X-API-Key'] || event.headers['x-api-key'.toLowerCase()];

  if (!apiKey) {
    console.error('[Processing Failure] SYNC_API_KEY environment variable is not configured.');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: 'Server configuration error: API key missing.' } })
    };
  }

  if (requestApiKey !== apiKey) {
    console.warn(`[Unauthorized Request] Invalid API key received: "${requestApiKey}"`);
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: { message: 'Unauthorized: Invalid API Key' } })
    };
  }

  // 2. Initialize Firebase Admin SDK safely
  if (!admin.apps.length) {
    let credential;
    
    // Check for single stringified JSON service account
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (serviceAccount.private_key) {
          // Replace escaped newline characters if present
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        credential = admin.credential.cert(serviceAccount);
      } catch (err) {
        console.error('[Processing Failure] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err);
      }
    }
    
    // Check for individual environment variables fallback
    if (!credential && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.GD_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    }

    if (!credential) {
      console.error('[Processing Failure] Firebase service account credentials are not configured in Netlify environment variables.');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: { message: 'Server configuration error: Firebase credentials missing.' } })
      };
    }

    admin.initializeApp({
      credential
    });
  }

  const auth = admin.auth();
  const db = admin.firestore();

  // 3. Parse Payload
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    console.warn('[Parsing Failure] Failed to parse request body JSON:', event.body);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: { message: 'Bad Request: Invalid JSON' } })
    };
  }

  const { name, phone, email, courseName } = payload;

  // 4. Validate Email ID
  const cleanEmail = String(email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    console.warn(`[Invalid Email] Skipped processing. Email is invalid/empty: "${email}" for name: "${name}"`);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: { message: 'Bad Request: Invalid or missing email address.' } })
    };
  }

  // 5. Normalize Phone Number (digits only, last 10 digits)
  const rawPhone = String(phone || '').trim();
  const numericPhone = rawPhone.replace(/\D/g, ''); // Keep only numeric digits
  const normalizedPhone = numericPhone.slice(-10); // Extract last 10 digits

  if (normalizedPhone.length < 10) {
    console.warn(`[Invalid Phone] Warning: Normalized phone number is less than 10 digits: "${normalizedPhone}" for email: "${cleanEmail}"`);
  }

  // 6. Firebase Auth Logic
  let userRecord;
  let isNewUser = false;

  try {
    userRecord = await auth.getUserByEmail(cleanEmail);
    console.log(`[User Found] Existing user found in Firebase Auth: ${userRecord.uid} (${cleanEmail})`);

    // Update display name if it differs or is empty
    if (name && userRecord.displayName !== name) {
      userRecord = await auth.updateUser(userRecord.uid, {
        displayName: name
      });
      console.log(`[User Updated] Updated display name in Firebase Auth for UID: ${userRecord.uid}`);
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // User does not exist, create a new Firebase Auth user
      const password = normalizedPhone;
      if (password.length < 6) {
        console.error(`[Processing Failure] Cannot create user: Password (normalized phone: '${password}') is less than 6 characters.`);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: { message: 'Bad Request: Password (last 10 digits of phone) must be at least 6 characters.' } })
        };
      }

      try {
        userRecord = await auth.createUser({
          email: cleanEmail,
          password: password,
          displayName: name || undefined
        });
        isNewUser = true;
        console.log(`[User Created] Created new Firebase Auth user: ${userRecord.uid} (${cleanEmail})`);
      } catch (createErr) {
        console.error(`[Processing Failure] Firebase Auth creation failed for email ${cleanEmail}:`, createErr);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: { message: `Firebase Auth Creation Error: ${createErr.message}` } })
        };
      }
    } else {
      console.error(`[Processing Failure] Firebase Auth search failed for email ${cleanEmail}:`, err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: { message: `Firebase Auth Query Error: ${err.message}` } })
      };
    }
  }

  // 7. Firestore Sync Logic
  try {
    const userRef = db.collection('users').doc(userRecord.uid);
    const userDoc = await userRef.get();
    let isUpgraded = false;

    // Build the sync payload
    const firestoreData = {
      uid: userRecord.uid,
      name: name || '',
      email: cleanEmail,
      phone: normalizedPhone,
      courseName: courseName || '',
      role: 'premium',
      premium: true,
      createdFromSheet: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Check if the user document already exists and needs a premium upgrade
    if (userDoc.exists) {
      const currentData = userDoc.data();
      if (currentData.role !== 'premium' || currentData.premium !== true) {
        isUpgraded = true;
      }
    }

    // Merge document in Firestore (preserves existing fields not listed in firestoreData)
    await userRef.set(firestoreData, { merge: true });

    if (isNewUser) {
      console.log(`[User Created] Firestore document initialized for UID: ${userRecord.uid}`);
    } else {
      console.log(`[User Updated] Firestore document merged for UID: ${userRecord.uid}`);
      if (isUpgraded) {
        console.log(`[Premium Upgraded] User UID ${userRecord.uid} successfully upgraded to premium status.`);
      }
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        uid: userRecord.uid,
        isNewUser: isNewUser,
        isUpgraded: !isNewUser && isUpgraded,
        message: isNewUser 
          ? 'User successfully created and initialized as premium.' 
          : 'User successfully updated and upgraded to premium.'
      })
    };

  } catch (err) {
    console.error(`[Processing Failure] Firestore database sync failed for UID ${userRecord.uid}:`, err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: `Firestore Database Sync Error: ${err.message}` } })
    };
  }
};
