// Scratch test script for syncPremiumUser payload extraction and phone normalization
'use strict';

function extractField(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
    if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null) {
      return obj[foundKey];
    }
  }

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

function normalizePhone(phoneVal) {
  const rawPhone = String(phoneVal || '').trim();
  const numericPhone = rawPhone.replace(/\D/g, ''); // Keep only numeric digits
  return numericPhone.slice(-10); // Extract last 10 digits
}

// ── TEST CASES ──

const testCases = [
  {
    name: "Flat Payload (Original / Legacy)",
    payload: {
      name: "John Doe",
      email: "john@example.com",
      phone: "+91 9876543210",
      courseName: "MHT-CET Ultimate Predictor 2026"
    }
  },
  {
    name: "Nested Classplus payload (Example 1)",
    payload: {
      event: "course.purchased",
      data: {
        studentName: "Jane Smith",
        userEmail: "jane.smith@gmail.com",
        studentMobile: "91-9123456789",
        courseTitle: "COMEDK Predictor Pack"
      }
    }
  },
  {
    name: "Deeply Nested structure (Example 2)",
    payload: {
      event: "payment_success",
      payload: {
        user: {
          fullName: "Alice Cooper",
          mail: "alice@cooper.org",
          mobileNumber: "+919998887776"
        },
        productName: "JEE Main All India Predictor"
      }
    }
  }
];

console.log("=== WEBHOOK EXTRACTOR TEST RUN ===\n");

testCases.forEach((tc, idx) => {
  console.log(`Test #${idx + 1}: ${tc.name}`);
  
  const email = extractField(tc.payload, ['email', 'userEmail', 'studentEmail', 'mail', 'emailId', 'email_id']);
  const phone = extractField(tc.payload, ['phone', 'mobile', 'phoneNumber', 'userMobile', 'studentMobile', 'mobileNumber', 'phone_number', 'mobile_number']);
  const name = extractField(tc.payload, ['name', 'userName', 'studentName', 'fullName', 'displayName', 'first_name', 'lastName', 'full_name']);
  const course = extractField(tc.payload, ['courseName', 'course', 'productName', 'courseTitle', 'title', 'course_name']);
  
  const normalizedPhone = normalizePhone(phone);
  
  console.log(` -> Extracted Name:   "${name}"`);
  console.log(` -> Extracted Email:  "${email}"`);
  console.log(` -> Extracted Phone:  "${phone}" (Normalized: "${normalizedPhone}")`);
  console.log(` -> Extracted Course: "${course}"`);
  console.log("");
});
