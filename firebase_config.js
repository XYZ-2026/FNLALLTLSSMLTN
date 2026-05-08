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

// ══════════════════════════════════════════
//  UNIFIED API — Drop-in replacement for authApi()
// ══════════════════════════════════════════

async function fireApi(action, payload) {
  try {
    switch (action) {

      // ── AUTH ──────────────────────────
      case 'register': {
        const { name, email, phone, state, city, password } = payload;
        // Check if email already exists
        const existing = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!existing.empty) return { ok: false, error: 'Email already registered.' };

        const hashed = await hashPassword(password);
        const userData = {
          name, email, phone: phone || '',
          state: state || '', city: city || '',
          password: hashed,
          role: 'user',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const docRef = await db.collection('users').add(userData);
        const session = { id: docRef.id, name, email, phone, state, city, role: 'user' };
        return { ok: true, data: session };
      }

      case 'login': {
        const { email, password } = payload;
        const snap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (snap.empty) return { ok: false, error: 'No account found with this email.' };

        const doc = snap.docs[0];
        const user = doc.data();
        const hashed = await hashPassword(password);
        if (user.password !== hashed) return { ok: false, error: 'Invalid password.' };

        const session = {
          id: doc.id, name: user.name, email: user.email,
          phone: user.phone || '', state: user.state || '', city: user.city || '',
          role: user.role || 'user'
        };
        return { ok: true, data: session };
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

      default:
        return { ok: false, error: 'Unknown action: ' + action };
    }
  } catch (e) {
    console.error('fireApi error:', action, e);
    return { ok: false, error: e.message || 'Firestore operation failed.' };
  }
}
