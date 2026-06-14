const admin = require('firebase-admin');
const crypto = require('crypto');

function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password + '_cs_salt_2026')
    .digest('hex');
}

/**
 * Recursively searches for a key in a flat or nested object (case-insensitive).
 * Searches common nested parent structures (e.g. data, user, student, payload).
 */
function extractField(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  
  for (const key of keys) {
    // 1. Direct match (case-sensitive)
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
    // 2. Direct match (case-insensitive)
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
    if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null) {
      return obj[foundKey];
    }
  }

  // 3. Recursive check in common parents
  const nestedParents = ['data', 'user', 'student', 'payload', 'body', 'details', 'object'];
  for (const parent of nestedParents) {
    if (obj[parent] && typeof obj[parent] === 'object') {
      const val = extractField(obj[parent], keys);
      if (val !== undefined && val !== null) {
        return val;
      }
    }
  }
  return undefined;
}


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

  // 1. API Key Protection (Check HTTP headers and URL query parameters)
  const apiKey = process.env.SYNC_API_KEY;
  const requestApiKey = event.headers['x-api-key'] || 
                        event.headers['X-API-Key'] || 
                        event.headers['x-api-key'.toLowerCase()] || 
                        (event.queryStringParameters && (event.queryStringParameters.apiKey || event.queryStringParameters.token || event.queryStringParameters.key));

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

  // Robustly extract user information from possible flat or nested formats
  const emailVal = extractField(payload, ['email', 'userEmail', 'studentEmail', 'mail', 'emailId', 'email_id']);
  const phoneVal = extractField(payload, ['phone', 'mobile', 'phoneNumber', 'userMobile', 'studentMobile', 'mobileNumber', 'phone_number', 'mobile_number']);
  const nameVal = extractField(payload, ['name', 'userName', 'studentName', 'fullName', 'displayName', 'first_name', 'lastName', 'full_name']);
  const courseVal = extractField(payload, ['courseName', 'course', 'productName', 'courseTitle', 'title', 'course_name']);

  console.log(`[Webhook Payload Parsed] Name: "${nameVal}", Email: "${emailVal}", Phone: "${phoneVal}", Course: "${courseVal}"`);

  // 4. Validate Email ID
  const cleanEmail = String(emailVal || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    console.warn(`[Invalid Email] Skipped processing. Email is invalid/empty: "${emailVal}" for name: "${nameVal}"`);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: { message: 'Bad Request: Invalid or missing email address.' } })
    };
  }

  // 5. Normalize Phone Number (digits only, last 10 digits)
  const rawPhone = String(phoneVal || '').trim();
  const numericPhone = rawPhone.replace(/\D/g, ''); // Keep only numeric digits
  const normalizedPhone = numericPhone.slice(-10); // Extract last 10 digits

  if (normalizedPhone.length < 10) {
    console.warn(`[Invalid Phone] Warning: Normalized phone number is less than 10 digits: "${normalizedPhone}" for email: "${cleanEmail}"`);
  }

  // 6. User Verification & Creation Logic (Firebase Auth & Firestore aligned)
  let userRecord = null;
  let isNewUser = false;
  let targetUid = null;
  let existingPassword = null;

  // Step 6a: Check Firestore first to prevent duplicating existing registered users
  let existingFirestoreDoc = null;
  try {
    const usersSnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
    if (!usersSnap.empty) {
      existingFirestoreDoc = usersSnap.docs[0];
      targetUid = existingFirestoreDoc.id;
      existingPassword = existingFirestoreDoc.data().password;
      console.log(`[Firestore Found] Existing user found in Firestore by email: ${targetUid}`);
    }
  } catch (err) {
    console.error(`[Firestore Search Error] failed for email ${cleanEmail}:`, err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: `Firestore Search Error: ${err.message}` } })
    };
  }

  // Step 6b: Check and align Firebase Auth
  try {
    userRecord = await auth.getUserByEmail(cleanEmail);
    console.log(`[Auth Found] Existing user found in Firebase Auth: ${userRecord.uid} (${cleanEmail})`);

    // If targetUid was not set from Firestore (i.e. Firestore doc missing), align to the Auth UID
    if (!targetUid) {
      targetUid = userRecord.uid;
    }

    // Update display name if it differs or is empty
    if (nameVal && userRecord.displayName !== nameVal) {
      userRecord = await auth.updateUser(userRecord.uid, {
        displayName: nameVal
      });
      console.log(`[Auth Updated] Updated display name in Firebase Auth for UID: ${userRecord.uid}`);
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      // User does not exist in Firebase Auth, create them
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
        const createOptions = {
          email: cleanEmail,
          password: password,
          displayName: nameVal || undefined
        };
        // Align Firebase Auth UID to pre-existing Firestore Doc ID if possible
        if (targetUid) {
          createOptions.uid = targetUid;
        }

        userRecord = await auth.createUser(createOptions);
        
        // If they were not in Firestore, targetUid becomes the generated Auth UID
        if (!targetUid) {
          targetUid = userRecord.uid;
          isNewUser = true;
        }
        console.log(`[Auth Created] Created new Firebase Auth user: ${userRecord.uid} (${cleanEmail})`);
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
    const userRef = db.collection('users').doc(targetUid);
    const userDoc = existingFirestoreDoc || await userRef.get();
    let isUpgraded = false;

    // Build the sync payload
    const firestoreData = {
      uid: targetUid,
      name: nameVal || (userDoc.exists ? userDoc.data().name : ''),
      email: cleanEmail,
      phone: normalizedPhone,
      courseName: courseVal || (userDoc.exists ? userDoc.data().courseName : ''),
      role: 'premium',
      premium: true,
      createdFromSheet: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // If there is no existing password in the Firestore doc, add the hashed password matching the frontend
    if (!existingPassword && (!userDoc.exists || !userDoc.data().password)) {
      firestoreData.password = hashPassword(normalizedPhone);
      console.log(`[Password Generated] Generated password hash for target user: ${targetUid}`);
    }

    // Check if the user document already exists and needs a premium upgrade
    if (userDoc.exists) {
      const currentData = userDoc.data();
      if (currentData.role !== 'premium' || currentData.premium !== true) {
        isUpgraded = true;
      }
    } else {
      isNewUser = true;
      firestoreData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    // Merge document in Firestore (preserves existing fields not listed in firestoreData)
    await userRef.set(firestoreData, { merge: true });

    if (isNewUser) {
      console.log(`[User Created] Firestore document initialized for UID: ${targetUid}`);
    } else {
      console.log(`[User Updated] Firestore document merged for UID: ${targetUid}`);
      if (isUpgraded) {
        console.log(`[Premium Upgraded] User UID ${targetUid} successfully upgraded to premium status.`);
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
        uid: targetUid,
        isNewUser: isNewUser,
        isUpgraded: !isNewUser && isUpgraded,
        message: isNewUser 
          ? 'User successfully created and initialized as premium.' 
          : 'User successfully updated and upgraded to premium.'
      })
    };

  } catch (err) {
    console.error(`[Processing Failure] Firestore database sync failed for UID ${targetUid}:`, err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: { message: `Firestore Database Sync Error: ${err.message}` } })
    };
  }
};
