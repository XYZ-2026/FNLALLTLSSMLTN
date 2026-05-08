/**
 * College Simplified — Legacy Backend (Deprecated)
 * ──────────────────────────────────────────────
 * All operations have been migrated to Firebase Firestore.
 * This script is no longer used for data storage.
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    ok: false, 
    error: "Legacy Google Script API is deprecated. Please use the direct Firestore integration." 
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  return doGet(e);
}
