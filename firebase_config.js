/**
 * College Simplified — Firebase Configuration & Firestore API
 * ─────────────────────────────────────────────────────────────
 * Replaces Google Apps Script backend with direct Firestore calls.
 * Collections: users, notifications, events (calendar)
 */

// ══════════════════════════════════════════
//  FIREBASE SDK (CDN compat bundle)
// ══════════════════════════════════════════

// These are loaded via <script> tags in HTML before this file.
// firebase-app-compat.js + firebase-firestore-compat.js

const firebaseConfig = {
  apiKey: "AIzaSyAtWXG-w4sqidiHeOiK18MQ1EAfiUoCJrY",
  authDomain: "mht-cet-counselling.firebaseapp.com",
  projectId: "mht-cet-counselling",
  storageBucket: "mht-cet-counselling.firebasestorage.app",
  messagingSenderId: "1002324097341",
  appId: "1:1002324097341:web:943cdbd9f3279af1c96d54",
  measurementId: "G-QRRDKVPB4K"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
var db = firebase.firestore();

// ══════════════════════════════════════════
//  PASSWORD HASHING (SHA-256, browser-native)
// ══════════════════════════════════════════

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_cs_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to normalize legacy branch prediction test results to the new format
function normalizeLegacyReport(data) {
  if (!data) return null;
  if (data.traitScores) return data;

  const ds = data.domainScores || {};
  const traitScores = {
    Programming: ds.CS_AI || 50,
    Debugging: ds.CS_AI || 50,
    SystemsThinking: ds.CS_AI || 50,
    Electronics: ds.ELECTRONICS || 50,
    Hardware: ds.ELECTRONICS || 50,
    MechanicalSystems: ds.MECHANICAL || 50,
    Construction: ds.CIVIL || 50,
    ScientificCuriosity: ds.CHEMICAL_BIO || 50,
    DesignThinking: ds.DESIGN_ARCH || 50,
    SpatialThinking: ds.DESIGN_ARCH || 50,
    Creativity: ds.DESIGN_ARCH || 50,
    Mathematics: ds.DATA_MATH || 50,
    DataAnalysis: ds.DATA_MATH || 50,
    LogicalReasoning: ds.DATA_MATH || 50,
    ProblemSolving: ds.DATA_MATH || 50,
    Research: ds.ENERGY_ENV || 50
  };

  const allNewTraits = [
    'Programming', 'PatternRecognition', 'Innovation', 'Mathematics', 'Research', 'DataAnalysis', 
    'ProblemSolving', 'LogicalReasoning', 'Creativity', 'SystemsThinking', 'Debugging', 'ScientificCuriosity', 
    'DesignThinking', 'Automation', 'Entrepreneurship', 'Leadership', 'Communication', 'Hardware', 
    'Precision', 'Electronics', 'RiskTaking', 'SpatialThinking', 'MechanicalSystems', 'Construction'
  ];

  const values = Object.values(ds);
  const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 50;

  allNewTraits.forEach(t => {
    if (traitScores[t] === undefined) {
      traitScores[t] = avg;
    }
  });

  let legacyBranches = [];
  if (Array.isArray(data.allBranches)) {
    legacyBranches = data.allBranches;
  } else if (Array.isArray(data.top5Roadmaps)) {
    legacyBranches = data.top5Roadmaps;
  } else if (data.allBranches && typeof data.allBranches === 'object') {
    legacyBranches = Object.values(data.allBranches);
  } else if (data.top5Roadmaps && typeof data.top5Roadmaps === 'object') {
    legacyBranches = Object.keys(data.top5Roadmaps).map(function(key) {
      return { branch: key, matchScore: 50 };
    });
  }

  const topBranches = legacyBranches.map(lb => {
    const name = lb.branch || lb.name || "Engineering";
    const matchScore = lb.match || lb.matchScore || lb.score || 50;
    const reason = lb.reason || "";
    
    let id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    if (id.endsWith('-')) id = id.slice(0, -1);
    
    if (name.includes("Machine Learning") || name.includes("AI & ML") || name.includes("AI & Machine")) id = "aiml";
    else if (name === "Computer Science Engineering" || name === "Computer Science & Engineering") id = "cse";
    else if (name === "Computer Engineering") id = "computer-engineering";
    else if (name === "Information Technology") id = "it";
    else if (name === "Software Engineering") id = "software-engineering";
    else if (name === "Artificial Intelligence") id = "ai";
    else if (name.includes("Electronics") || name.includes("Telecommunication")) id = "entc";
    else if (name.includes("Robotics")) id = "robotics";
    else if (name.includes("Data Science")) id = "data-science";
    else if (name.includes("Mechanical")) id = "mechanical";
    else if (name.includes("Civil")) id = "civil";
    else if (name.includes("Chemical")) id = "chemical";
    else if (name.includes("Electrical")) id = "electrical";
    else if (name.includes("Biomedical")) id = "biomedical";
    else if (name.includes("Aerospace")) id = "aerospace";
    else if (name.includes("Cyber Security") || name.includes("Cybersecurity")) id = "cybersecurity";

    return { id, name, matchScore, reason };
  });

  let dnaType = {
    name: "The Analytical Mind",
    icon: "🧠",
    desc: "You have a balanced, highly analytical engineering mindset with a strong foundation in core technical principles."
  };
  
  if (ds.CS_AI >= Math.max(ds.ELECTRONICS||0, ds.MECHANICAL||0, ds.CIVIL||0)) {
    dnaType = {
      name: "The Innovator",
      icon: "🧬",
      desc: "Driven by creativity, algorithms, and future tech, you excel at building software solutions that push technological boundaries."
    };
  } else if (ds.MECHANICAL >= Math.max(ds.CS_AI||0, ds.CIVIL||0)) {
    dnaType = {
      name: "The Constructor",
      icon: "🏗️",
      desc: "You think in terms of physical structures, mechanisms, and real-world execution. You build things that stand the test of time."
    };
  }

  let sectionScores = [avg, avg, avg, avg, avg];
  if (data.sectionScores) {
    sectionScores = data.sectionScores;
  }

  let answersArray = new Array(60).fill(null);
  if (data.answers) {
    if (Array.isArray(data.answers)) {
      answersArray = data.answers;
    } else {
      for (let si = 0; si < 5; si++) {
        for (let qi = 0; qi < 12; qi++) {
          const key = `s${si}q${qi}`;
          if (data.answers[key] !== undefined) {
            answersArray[si * 12 + qi] = data.answers[key];
          }
        }
      }
    }
  }

  return {
    traitScores,
    topBranches,
    dnaType,
    sectionScores,
    answers: answersArray,
    allMatches: topBranches
  };
}

async function fireApi(action, payload) {
  try {
    switch (action) {

      // ── AUTH ──────────────────────────
      case 'register': {
        const { name, email, phone, state, city, password } = payload;
        // Check if email already exists in Firestore
        const existing = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!existing.empty) return { ok: false, error: 'Email already registered in database.' };

        try {
          // 1. Create user in Firebase Authentication
          await firebase.auth().createUserWithEmailAndPassword(email, password);
          
          // 2. Save user details to Firestore
          const hashed = await hashPassword(password);
          const userData = {
            name, email, phone: phone || '',
            state: state || '', city: city || '',
            password: hashed, // Hashed copy for backward compatibility
            role: 'user',
            authMigrated: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            acceptedTermsAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          const docRef = await db.collection('users').add(userData);
          const session = { id: docRef.id, name, email, phone, state, city, role: 'user', acceptedTermsAt: new Date().toISOString() };
          return { ok: true, data: session };
        } catch (authErr) {
          console.error('Registration error in Firebase Auth:', authErr);
          if (authErr.code === 'auth/email-already-in-use') {
            return { ok: false, error: 'This email is already registered.' };
          }
          return { ok: false, error: authErr.message || 'Registration failed.' };
        }
      }

      case 'login': {
        const { email, password } = payload;
        
        try {
          // 1. Attempt login with Firebase Authentication
          await firebase.auth().signInWithEmailAndPassword(email, password);
          
          // Login succeeded! Fetch user data from Firestore
          const snap = await db.collection('users').where('email', '==', email).limit(1).get();
          if (snap.empty) {
            // Edge case: user exists in Auth but not in Firestore users database. 
            // Create user doc on-the-fly.
            const hashed = await hashPassword(password);
            const userData = {
              name: email.split('@')[0], email, phone: '',
              state: '', city: '',
              password: hashed,
              role: 'user',
              authMigrated: true,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const docRef = await db.collection('users').add(userData);
            const session = { id: docRef.id, name: userData.name, email, phone: '', state: '', city: '', role: 'user', acceptedTermsAt: null };
            return { ok: true, data: session };
          }
          
          const doc = snap.docs[0];
          const user = doc.data();
          const session = {
            id: doc.id, name: user.name, email: user.email,
            phone: user.phone || '', state: user.state || '', city: user.city || '',
            role: user.role || 'user',
            acceptedTermsAt: user.acceptedTermsAt ? (user.acceptedTermsAt.toDate ? user.acceptedTermsAt.toDate().toISOString() : user.acceptedTermsAt) : null
          };
          return { ok: true, data: session };
        } catch (authErr) {
          // 2. If user is not found in Firebase Authentication, attempt lazy migration
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
            const snap = await db.collection('users').where('email', '==', email).limit(1).get();
            if (snap.empty) return { ok: false, error: 'No account found with this email.' };

            const doc = snap.docs[0];
            const user = doc.data();
            const hashed = await hashPassword(password);
            
            if (user.password !== hashed) return { ok: false, error: 'Invalid password.' };

            // Password is correct! Let's migrate them to Firebase Auth on-the-fly
            try {
              await firebase.auth().createUserWithEmailAndPassword(email, password);
              await doc.ref.update({ authMigrated: true });
              
              const session = {
                id: doc.id, name: user.name, email: user.email,
                phone: user.phone || '', state: user.state || '', city: user.city || '',
                role: user.role || 'user',
                acceptedTermsAt: user.acceptedTermsAt ? (user.acceptedTermsAt.toDate ? user.acceptedTermsAt.toDate().toISOString() : user.acceptedTermsAt) : null
              };
              return { ok: true, data: session };
            } catch (migrationErr) {
              console.error('Lazy migration failed:', migrationErr);
              return { ok: false, error: 'Migration failed: ' + migrationErr.message };
            }
          } else if (authErr.code === 'auth/wrong-password') {
            return { ok: false, error: 'Invalid password.' };
          }
          
          return { ok: false, error: authErr.message || 'Login failed.' };
        }
      }

      case 'requestPasswordReset': {
        const { email } = payload;
        
        // Ensure user exists in our Firestore users collection
        const snap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (snap.empty) return { ok: false, error: 'No account found with this email.' };
        
        const doc = snap.docs[0];
        const user = doc.data();

        // Check if the user is migrated to Firebase Auth
        if (!user.authMigrated) {
          const tempPassword = 'CS_Temp_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          try {
            await firebase.auth().createUserWithEmailAndPassword(email, tempPassword);
            await firebase.auth().signOut(); // Immediately sign out
            await doc.ref.update({ authMigrated: true });
          } catch (createErr) {
            console.error('Failed to create user during reset migration:', createErr);
            // If the user already exists in Firebase Auth for some reason, just proceed
            if (createErr.code !== 'auth/email-already-in-use') {
              return { ok: false, error: 'Failed to initiate password reset: ' + createErr.message };
            }
          }
        }

        try {
          await firebase.auth().sendPasswordResetEmail(email);
          return { ok: true, data: { status: 'sent', email: email } };
        } catch (authErr) {
          return { ok: false, error: authErr.message || 'Reset request failed.' };
        }
      }

      case 'confirmPasswordReset': {
        // Obsolete case because Firebase Auth handles this natively via its reset link.
        return { ok: true };
      }

      // ── USERS (Admin) ────────────────
      case 'getUsers': {
        const usersSnap = await db.collection('users').orderBy('createdAt', 'desc').get();
        const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data(), password: undefined }));
        return { ok: true, data: users };
      }

      case 'updateUser': {
        const { id, ...updates } = payload;
        if (!id) return { ok: false, error: 'Missing user ID.' };
        // Remove undefined fields
        const cleanUpdates = {};
        Object.keys(updates).forEach(k => {
          if (updates[k] !== undefined && k !== 'password') cleanUpdates[k] = updates[k];
        });
        await db.collection('users').doc(id).update(cleanUpdates);
        return { ok: true };
      }

      // ── NOTIFICATIONS ────────────────
      case 'sendNotification': {
        const notifData = {
          title: payload.title || '',
          message: payload.message || '',
          link: payload.link || '',
          target: payload.target || 'all',
          scheduledAt: payload.scheduledAt || null, // ISO string
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('notifications').add(notifData);
        return { ok: true };
      }

      case 'getNotifications': {
        const email = payload.email || '';
        const nowStr = new Date().toISOString();
        const notifsSnap = await db.collection('notifications')
          .orderBy('createdAt', 'desc').limit(100).get();
        
        const notifs = notifsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(n => {
            // Target filter
            if (n.target !== 'all' && n.target !== email) return false;
            // Scheduling filter
            if (n.scheduledAt && n.scheduledAt > nowStr) return false;
            return true;
          });
        return { ok: true, data: notifs.slice(0, 50) };
      }

      case 'getAllNotifications': {
        const allNotifsSnap = await db.collection('notifications').limit(200).get();
        const allNotifs = allNotifsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort in JS to handle missing createdAt fields safely
        allNotifs.sort((a, b) => {
          const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : 0;
          const db = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : 0;
          return db - da;
        });
        return { ok: true, data: allNotifs };
      }

      case 'deleteNotification': {
        const notifId = payload.id;
        if (!notifId) return { ok: false, error: 'Missing notification ID.' };
        await db.collection('notifications').doc(notifId).delete();
        return { ok: true };
      }

      // ── CALENDAR EVENTS ──────────────
      case 'getEvents': {
        const eventsSnap = await db.collection('events')
          .orderBy('createdAt', 'desc').get();
        const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        return { ok: true, data: events };
      }

      case 'addEvent': {
        const eventData = {
          title: payload.title || '',
          desc: payload.desc || '',
          date: payload.date || '',
          time: payload.time || '',
          link: payload.link || '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('events').add(eventData);
        return { ok: true };
      }

      case 'updateEvent': {
        const eventId = payload.id;
        if (!eventId) return { ok: false, error: 'Missing event ID.' };
        const eventUpdates = {};
        ['title', 'desc', 'date', 'time', 'link'].forEach(k => {
          if (payload[k] !== undefined) eventUpdates[k] = payload[k];
        });
        await db.collection('events').doc(eventId).update(eventUpdates);
        return { ok: true };
      }

      case 'deleteEvent': {
        const delEventId = payload.id;
        if (!delEventId) return { ok: false, error: 'Missing event ID.' };
        await db.collection('events').doc(delEventId).delete();
        return { ok: true };
      }

      // ── PREFERENCE BUILDER DATA ─────────
      case 'savePrefData': {
        const { userId, percentile, rank, category, gender, formId, prefList } = payload;
        if (!userId) return { ok: false, error: 'Missing user ID.' };

        // 1. Check global edit limit (Skip for Premium/Admin) - Disabled
        const globalRef = db.collection('preferenceData').doc(userId);
        const globalSnap = await globalRef.get();
        let editCount = 0;
        if (globalSnap.exists) {
          await globalRef.update({ editCount: 0, lastEditedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
          await globalRef.set({ editCount: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }

        // 2. Save form data
        const formsColl = globalRef.collection('forms');
        let formRef;
        if (formId) {
          formRef = formsColl.doc(formId);
          await formRef.update({
            percentile: parseFloat(percentile),
            rank: parseInt(rank),
            category: category || 'OPEN',
            gender: gender || 'Gender-Neutral',
            region: payload.region || '',
            prefList: prefList || [],
            selectedBranches: payload.selectedBranches || [],
            selectedCollegeKeys: payload.selectedCollegeKeys || [],
            currentStep: payload.currentStep || 1,
            colType: payload.colType || '',
            minority: payload.minority || '',
            studentInfo: payload.studentInfo || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          formRef = await formsColl.add({
            percentile: parseFloat(percentile),
            rank: parseInt(rank),
            category: category || 'OPEN',
            gender: gender || 'Gender-Neutral',
            region: payload.region || '',
            prefList: prefList || [],
            selectedBranches: payload.selectedBranches || [],
            selectedCollegeKeys: payload.selectedCollegeKeys || [],
            currentStep: payload.currentStep || 1,
            colType: payload.colType || '',
            minority: payload.minority || '',
            studentInfo: payload.studentInfo || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        return { ok: true, data: { formId: formRef.id, editCount } };
      }

      case 'saveJosaaPrefData': {
        const { userId, percentile, rank, category, gender, homeState, instTypes, formId, prefList } = payload;
        if (!userId) return { ok: false, error: 'Missing user ID.' };

        // Check global edit limit - Disabled
        const globalRef = db.collection('josaaPreferenceData').doc(userId);
        const globalSnap = await globalRef.get();
        let editCount = 0;
        if (globalSnap.exists) {
          await globalRef.update({ editCount: 0, lastEditedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
          await globalRef.set({ editCount: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }

        // Save form data
        const formsColl = globalRef.collection('forms');
        let formRef;
        if (formId) {
          formRef = formsColl.doc(formId);
          await formRef.update({
            percentile: parseFloat(percentile),
            rank: parseInt(rank),
            category: category || 'OPEN',
            gender: gender || 'Gender-Neutral',
            homeState: homeState || '',
            instTypes: instTypes || [],
            prefList: prefList || [],
            selectedBranches: payload.selectedBranches || [],
            selectedCollegeKeys: payload.selectedCollegeKeys || [],
            currentStep: payload.currentStep || 1,
            studentInfo: payload.studentInfo || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          formRef = await formsColl.add({
            percentile: parseFloat(percentile),
            rank: parseInt(rank),
            category: category || 'OPEN',
            gender: gender || 'Gender-Neutral',
            homeState: homeState || '',
            instTypes: instTypes || [],
            prefList: prefList || [],
            selectedBranches: payload.selectedBranches || [],
            selectedCollegeKeys: payload.selectedCollegeKeys || [],
            currentStep: payload.currentStep || 1,
            studentInfo: payload.studentInfo || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        return { ok: true, data: { formId: formRef.id, editCount } };
      }

      case 'saveDsePrefData': {
        const { userId, percentile, rank, category, gender, region, minority, formId, prefList } = payload;
        if (!userId) return { ok: false, error: 'Missing user ID.' };

        // Check global edit limit - Disabled
        const globalRef = db.collection('dsePreferenceData').doc(userId);
        const globalSnap = await globalRef.get();
        let editCount = 0;
        if (globalSnap.exists) {
          await globalRef.update({ editCount: 0, lastEditedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
          await globalRef.set({ editCount: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }

        // Save form data
        const formsColl = globalRef.collection('forms');
        let formRef;
        if (formId) {
          formRef = formsColl.doc(formId);
          await formRef.update({
            percentile: parseFloat(percentile) || 0,
            rank: parseInt(rank) || 0,
            category: category || 'OPEN',
            gender: gender || 'G',
            region: region || 'all',
            minority: minority || '',
            prefList: prefList || [],
            selectedBranches: payload.selectedBranches || [],
            selectedCollegeKeys: payload.selectedCollegeKeys || [],
            currentStep: payload.currentStep || 1,
            studentInfo: payload.studentInfo || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          formRef = await formsColl.add({
            percentile: parseFloat(percentile) || 0,
            rank: parseInt(rank) || 0,
            category: category || 'OPEN',
            gender: gender || 'G',
            region: region || 'all',
            minority: minority || '',
            prefList: prefList || [],
            selectedBranches: payload.selectedBranches || [],
            selectedCollegeKeys: payload.selectedCollegeKeys || [],
            currentStep: payload.currentStep || 1,
            studentInfo: payload.studentInfo || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        return { ok: true, data: { formId: formRef.id, editCount } };
      }

      case 'saveComedkPrefData': {
        const { userId, rank, category, formId, prefList } = payload;
        if (!userId) return { ok: false, error: 'Missing user ID.' };

        // Check global edit limit - Disabled
        const globalRef = db.collection('comedkPreferenceData').doc(userId);
        const globalSnap = await globalRef.get();
        let editCount = 0;
        if (globalSnap.exists) {
          await globalRef.update({ editCount: 0, lastEditedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
          await globalRef.set({ editCount: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }

        // Save form data
        const formsColl = globalRef.collection('forms');
        let formRef;
        if (formId) {
          formRef = formsColl.doc(formId);
          await formRef.update({
            rank: parseInt(rank) || 0,
            category: category || 'GM',
            prefList: prefList || [],
            selectedBranches: payload.selectedBranches || [],
            selectedCollegeKeys: payload.selectedCollegeKeys || [],
            currentStep: payload.currentStep || 1,
            studentInfo: payload.studentInfo || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          formRef = await formsColl.add({
            rank: parseInt(rank) || 0,
            category: category || 'GM',
            prefList: prefList || [],
            selectedBranches: payload.selectedBranches || [],
            selectedCollegeKeys: payload.selectedCollegeKeys || [],
            currentStep: payload.currentStep || 1,
            studentInfo: payload.studentInfo || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        return { ok: true, data: { formId: formRef.id, editCount } };
      }

      case 'deleteForm': {
        const { userId, formId } = payload;
        if (!userId || !formId) return { ok: false, error: 'Missing details.' };
        await db.collection('preferenceData').doc(userId).collection('forms').doc(formId).delete();
        return { ok: true };
      }

      case 'deleteJosaaPrefForm': {
        const { userId, formId } = payload;
        if (!userId || !formId) return { ok: false, error: 'Missing details.' };
        await db.collection('josaaPreferenceData').doc(userId).collection('forms').doc(formId).delete();
        return { ok: true };
      }

      case 'deleteDsePrefForm': {
        const { userId, formId } = payload;
        if (!userId || !formId) return { ok: false, error: 'Missing details.' };
        await db.collection('dsePreferenceData').doc(userId).collection('forms').doc(formId).delete();
        return { ok: true };
      }

      case 'deleteComedkPrefForm': {
        const { userId, formId } = payload;
        if (!userId || !formId) return { ok: false, error: 'Missing details.' };
        await db.collection('comedkPreferenceData').doc(userId).collection('forms').doc(formId).delete();
        return { ok: true };
      }

      case 'getPrefData': {
        const { userId: pUserId } = payload;
        if (!pUserId) return { ok: false, error: 'Missing user ID.' };
        
        // Get global edit count
        const gSnap = await db.collection('preferenceData').doc(pUserId).get();
        const editCount = gSnap.exists ? (gSnap.data().editCount || 0) : 0;

        // Get all forms
        const formsSnap = await db.collection('preferenceData').doc(pUserId).collection('forms')
          .orderBy('updatedAt', 'desc').get();
        const forms = formsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return { ok: true, data: { editCount, forms } };
      }

      case 'getJosaaPrefData': {
        const { userId: pUserId } = payload;
        if (!pUserId) return { ok: false, error: 'Missing user ID.' };
        
        // Get global edit count
        const gSnap = await db.collection('josaaPreferenceData').doc(pUserId).get();
        const editCount = gSnap.exists ? (gSnap.data().editCount || 0) : 0;

        // Get all forms
        const formsSnap = await db.collection('josaaPreferenceData').doc(pUserId).collection('forms')
          .orderBy('updatedAt', 'desc').get();
        const forms = formsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return { ok: true, data: { editCount, forms } };
      }

      case 'getDsePrefData': {
        const { userId: pUserId } = payload;
        if (!pUserId) return { ok: false, error: 'Missing user ID.' };
        
        // Get global edit count
        const gSnap = await db.collection('dsePreferenceData').doc(pUserId).get();
        const editCount = gSnap.exists ? (gSnap.data().editCount || 0) : 0;

        // Get all forms
        const formsSnap = await db.collection('dsePreferenceData').doc(pUserId).collection('forms')
          .orderBy('updatedAt', 'desc').get();
        const forms = formsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return { ok: true, data: { editCount, forms } };
      }

      case 'getComedkPrefData': {
        const { userId: pUserId } = payload;
        if (!pUserId) return { ok: false, error: 'Missing user ID.' };
        
        // Get global edit count
        const gSnap = await db.collection('comedkPreferenceData').doc(pUserId).get();
        const editCount = gSnap.exists ? (gSnap.data().editCount || 0) : 0;

        // Get all forms
        const formsSnap = await db.collection('comedkPreferenceData').doc(pUserId).collection('forms')
          .orderBy('updatedAt', 'desc').get();
        const forms = formsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return { ok: true, data: { editCount, forms } };
      }

      case 'savePsychometricReport': {
        const { userId, reportData } = payload;
        if (!userId) return { ok: false, error: 'Missing user ID.' };
        await db.collection('psychometricReports').doc(userId).set({
          ...reportData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { ok: true };
      }

      case 'saveBranchTestResult': {
        const { userId, resultData } = payload;
        if (!userId) return { ok: false, error: 'Missing user ID.' };
        const docRef = await db.collection('users').doc(userId).collection('branchTestHistory').add({
          ...resultData,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { ok: true, id: docRef.id };
      }

      case 'getBranchTestHistory': {
        const { userId } = payload;
        if (!userId) return { ok: false, error: 'Missing user ID.' };
        const snap = await db.collection('users').doc(userId).collection('branchTestHistory').orderBy('createdAt', 'desc').get();
        let history = snap.docs.map(doc => {
          const data = doc.data();
          let dateStr = '';
          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            dateStr = data.createdAt.toDate().toISOString();
          } else if (data.createdAt) {
            dateStr = new Date(data.createdAt).toISOString();
          }
          return { id: doc.id, ...data, dateStr };
        });

        // Fetch legacy report if it exists and append to history
        try {
          const legacyDoc = await db.collection('psychometricReports').doc(userId).get();
          if (legacyDoc.exists) {
            const data = legacyDoc.data();
            const normalized = normalizeLegacyReport(data);
            let dateStr = '';
            const ts = data.updatedAt || data.createdAt;
            if (ts && typeof ts.toDate === 'function') {
              dateStr = ts.toDate().toISOString();
            } else if (ts) {
              dateStr = new Date(ts).toISOString();
            } else {
              dateStr = new Date(0).toISOString();
            }
            history.push({ id: 'legacy', ...normalized, createdAt: ts || null, dateStr });
          }
        } catch (legacyErr) {
          console.error('Error fetching legacy psychometric report for history:', legacyErr);
        }

        // Sort combined history by date descending
        history.sort((a, b) => {
          const dA = new Date(a.dateStr || a.createdAt || 0);
          const dB = new Date(b.dateStr || b.createdAt || 0);
          return dB - dA;
        });

        return { ok: true, data: history };
      }

      case 'getPsychometricReport': {
        const { userId } = payload;
        if (!userId) return { ok: false, error: 'Missing user ID.' };
        // Check history subcollection first for the latest entry
        const historySnap = await db.collection('users').doc(userId).collection('branchTestHistory').orderBy('createdAt', 'desc').limit(1).get();
        if (!historySnap.empty) {
          const data = historySnap.docs[0].data();
          if (!data.allBranches && data.topBranches) {
            data.allBranches = data.topBranches;
          }
          return { ok: true, data: data };
        }
        // Fallback to legacy single document
        const doc = await db.collection('psychometricReports').doc(userId).get();
        if (!doc.exists) return { ok: true, data: null };
        const legacyData = doc.data();
        const normalized = normalizeLegacyReport(legacyData);
        normalized.allBranches = normalized.topBranches;
        return { ok: true, data: normalized };
      }

      case 'resetPrefEdits': {
        const { userId: resetUserId, tool } = payload;
        if (!resetUserId) return { ok: false, error: 'Missing user ID.' };
        const collectionName = (tool === 'josaa-pref-builder') ? 'josaaPreferenceData' : 
                               (tool === 'dse-pref-builder') ? 'dsePreferenceData' : 
                               (tool === 'comedk-pref-builder') ? 'comedkPreferenceData' : 'preferenceData';
        const resetRef = db.collection(collectionName).doc(resetUserId);
        const resetSnap = await resetRef.get();
        if (resetSnap.exists) {
          await resetRef.update({ editCount: 0 });
        }
        return { ok: true };
      }

      // ── EDIT REQUESTS ─────────────────
      case 'submitEditRequest': {
        const { userId: reqUserId, userName, userEmail, message, tool } = payload;
        if (!reqUserId) return { ok: false, error: 'Missing user ID.' };
        // Check for existing pending request for this tool
        const existingReq = await db.collection('editRequests')
          .where('userId', '==', reqUserId)
          .where('status', '==', 'pending')
          .get();
        const hasPendingForTool = existingReq.docs.some(doc => {
          const data = doc.data();
          const reqTool = data.tool || 'mht-cet-pref-builder';
          const targetTool = tool || 'mht-cet-pref-builder';
          return reqTool === targetTool;
        });
        if (hasPendingForTool) return { ok: false, error: 'You already have a pending request for this tool.' };

        await db.collection('editRequests').add({
          userId: reqUserId,
          userName: userName || '',
          userEmail: userEmail || '',
          message: message || 'Please unlock my preference list edits.',
          status: 'pending',
          tool: tool || 'mht-cet-pref-builder',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { ok: true };
      }

      case 'getEditRequests': {
        const reqSnap = await db.collection('editRequests')
          .orderBy('createdAt', 'desc').limit(100).get();
        const requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        return { ok: true, data: requests };
      }

      case 'respondEditRequest': {
        const { requestId, status: reqStatus, adminMessage } = payload;
        if (!requestId) return { ok: false, error: 'Missing request ID.' };
        await db.collection('editRequests').doc(requestId).update({
          status: reqStatus || 'resolved',
          adminMessage: adminMessage || '',
          respondedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { ok: true };
      }

      // ── NON-CAP ADMISSIONS ────────────
      case 'saveNonCapAdmission': {
        const { college, year, title, link } = payload;
        await db.collection('nonCapAdmissions').add({
          college, year, title, link,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { ok: true };
      }

      case 'getNonCapAdmissions': {
        const capSnap = await db.collection('nonCapAdmissions')
          .orderBy('college', 'asc').get();
        let capList = capSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Secondary sort by year (desc) in memory to avoid index requirement
        capList.sort((a, b) => {
          if (a.college !== b.college) return 0; // Already sorted by college
          return (b.year || 0) - (a.year || 0);
        });
        return { ok: true, data: capList };
      }

      case 'deleteNonCapAdmission': {
        const capId = payload.id;
        if (!capId) return { ok: false, error: 'Missing ID.' };
        await db.collection('nonCapAdmissions').doc(capId).delete();
        return { ok: true };
      }

      case 'sendNotificationToUser': {
        const { email: notifEmail, title: notifTitle, message: notifMsg, link: notifLink } = payload;
        if (!notifEmail) return { ok: false, error: 'Missing email.' };
        await db.collection('notifications').add({
          title: notifTitle || '',
          message: notifMsg || '',
          link: notifLink || '',
          target: notifEmail,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { ok: true };
      }

      // ── LATEST NOTICES ────────────────
      case 'getNotices': {
        const snap = await db.collection('notices').orderBy('createdAt', 'desc').limit(20).get();
        return { ok: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
      }

      case 'addNotice': {
        await db.collection('notices').add({
          title: payload.title || '',
          description: payload.description || '',
          link: payload.link || '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { ok: true };
      }

      case 'deleteNotice': {
        if (!payload.id) return { ok: false, error: 'Missing ID' };
        await db.collection('notices').doc(payload.id).delete();
        return { ok: true };
      }

      // ── PREFERENCE TEMPLATES ─────────
      case 'saveTemplate': {
        const { templateId, name, description, filters, tags, prefList, isPublished } = payload;
        if (!name) return { ok: false, error: 'Template name is required.' };
        const templateData = {
          name: name || '',
          description: description || '',
          filters: filters || {},
          tags: tags || [],
          prefList: prefList || [],
          isPublished: isPublished !== false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (templateId) {
          await db.collection('prefTemplates').doc(templateId).update(templateData);
          return { ok: true, data: { templateId } };
        } else {
          templateData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          templateData.usageCount = 0;
          const ref = await db.collection('prefTemplates').add(templateData);
          return { ok: true, data: { templateId: ref.id } };
        }
      }

      case 'getTemplates': {
        const snap = await db.collection('prefTemplates')
          .where('isPublished', '==', true)
          .get();
        const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        templates.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
        return { ok: true, data: templates };
      }

      case 'getAllTemplates': {
        const snap = await db.collection('prefTemplates').get();
        const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        templates.sort((a, b) => {
          const da = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : 0;
          const db2 = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : 0;
          return db2 - da;
        });
        return { ok: true, data: templates };
      }

      case 'deleteTemplate': {
        const { templateId } = payload;
        if (!templateId) return { ok: false, error: 'Missing template ID.' };
        await db.collection('prefTemplates').doc(templateId).delete();
        return { ok: true };
      }

      case 'applyTemplate': {
        const { userId, templateId } = payload;
        if (!userId || !templateId) return { ok: false, error: 'Missing user or template ID.' };
        
        // 1. Get template
        const tSnap = await db.collection('prefTemplates').doc(templateId).get();
        if (!tSnap.exists) return { ok: false, error: 'Template not found.' };
        const template = tSnap.data();
        
        // 2. Increment usage count
        await db.collection('prefTemplates').doc(templateId).update({
          usageCount: firebase.firestore.FieldValue.increment(1)
        });

        // 3. Ensure user's preferenceData doc exists
        const globalRef = db.collection('preferenceData').doc(userId);
        const globalSnap = await globalRef.get();
        if (!globalSnap.exists) {
          await globalRef.set({ editCount: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }

        // 4. Create a new form pre-populated from template
        const formRef = await globalRef.collection('forms').add({
          percentile: template.filters?.percentileMin || 0,
          rank: 0,
          category: template.filters?.category || 'OPEN',
          gender: 'Gender-Neutral',
          region: template.filters?.region || '',
          prefList: template.prefList || [],
          selectedBranches: [],
          selectedCollegeKeys: [],
          currentStep: 4,
          colType: template.filters?.collegeType || '',
          minority: template.filters?.minority || '',
          studentInfo: null,
          sourceTemplate: {
            templateId: templateId,
            templateName: template.name || '',
            appliedAt: new Date().toISOString()
          },
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { ok: true, data: { formId: formRef.id, templateName: template.name } };
      }

      case 'logUserActivity': {
        const { userId, email, name, role, device, sessionId, action, details } = payload;
        if (userId && userId !== 'guest') {
          db.collection('users').doc(userId).update({
            lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(err => console.error('Error updating lastActiveAt:', err));
        }
        await db.collection('userActivityLogs').add({
          userId: userId || 'guest',
          email: email || 'guest',
          name: name || 'Guest',
          role: role || 'guest',
          device: device || 'Desktop',
          sessionId: sessionId || 'guest_session',
          action: action || 'page_view',
          details: details || '',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { ok: true };
      }

      case 'getAdminAppUsage': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const logsSnap = await db.collection('userActivityLogs')
          .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(sevenDaysAgo))
          .get();
        const logs = logsSnap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            timestamp: d.timestamp ? d.timestamp.toDate().toISOString() : new Date().toISOString()
          };
        });
        return { ok: true, data: logs };
      }

      case 'getAdminBranchPredictions': {
        const groupSnap = await db.collectionGroup('branchTestHistory').get();
        const history = groupSnap.docs.map(doc => {
          const d = doc.data();
          const userRef = doc.ref.parent.parent;
          let dateStr = '';
          if (d.createdAt && typeof d.createdAt.toDate === 'function') {
            dateStr = d.createdAt.toDate().toISOString();
          } else if (d.createdAt) {
            dateStr = new Date(d.createdAt).toISOString();
          } else {
            dateStr = new Date().toISOString();
          }
          return {
            id: doc.id,
            userId: userRef ? userRef.id : '',
            type: 'history',
            ...d,
            createdAt: dateStr
          };
        });

        const legacySnap = await db.collection('psychometricReports').get();
        const legacy = legacySnap.docs.map(doc => {
          const d = doc.data();
          const ts = d.updatedAt || d.createdAt;
          let dateStr = '';
          if (ts && typeof ts.toDate === 'function') {
            dateStr = ts.toDate().toISOString();
          } else if (ts) {
            dateStr = new Date(ts).toISOString();
          } else {
            dateStr = new Date(0).toISOString();
          }
          return {
            id: doc.id,
            userId: doc.id,
            type: 'legacy',
            ...d,
            createdAt: dateStr
          };
        });

        return { ok: true, data: { history, legacy } };
      }

      default:
        return { ok: false, error: 'Unknown action: ' + action };
    }
  } catch (e) {
    console.error('fireApi error:', action, e);
    return { ok: false, error: e.message || 'Firestore operation failed.' };
  }
}
