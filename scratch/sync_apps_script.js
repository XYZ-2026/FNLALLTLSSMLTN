/**
 * Google Apps Script for syncing premium user purchases to Firebase via Netlify Functions.
 * 
 * Google Sheet Columns:
 * Column A: Name
 * Column B: Phone Number
 * Column C: Email ID
 * Column D: Course Name
 * Column E: Sync Status (Processed / Error Messages)
 */

function syncPremiumUsers() {
  const SCRIPT_PROP = PropertiesService.getScriptProperties();
  const API_URL = SCRIPT_PROP.getProperty('SYNC_API_URL');
  const API_KEY = SCRIPT_PROP.getProperty('SYNC_API_KEY');
  
  if (!API_URL || !API_KEY) {
    Logger.log('Error: SYNC_API_URL or SYNC_API_KEY is not configured in Script Properties.');
    return;
  }
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No data rows to process.');
    return;
  }
  
  // Fetch values from Column A to E, starting from Row 2 (skipping header)
  const range = sheet.getRange(2, 1, lastRow - 1, 5);
  const values = range.getValues();
  
  let processedCount = 0;
  let failureCount = 0;
  
  for (let i = 0; i < values.length; i++) {
    const rowNum = i + 2; // Offset for 1-based index and header row
    const name = values[i][0];
    const phone = values[i][1];
    const email = values[i][2];
    const courseName = values[i][3];
    const status = values[i][4];
    
    // Skip if row has already been successfully synced
    if (status === 'PROCESSED') {
      continue;
    }
    
    // Check if email is empty or invalid
    if (!email || String(email).trim() === '') {
      Logger.log(`Row ${rowNum}: Skipped (Email is empty).`);
      sheet.getRange(rowNum, 5).setValue('SKIPPED (Empty Email)');
      continue;
    }
    
    Logger.log(`Processing row ${rowNum}: ${email}`);
    
    const payload = {
      name: String(name || '').trim(),
      phone: String(phone || '').trim(),
      email: String(email || '').trim(),
      courseName: String(courseName || '').trim()
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': API_KEY
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    let success = false;
    let retries = 3;
    let response;
    
    while (retries > 0 && !success) {
      try {
        response = UrlFetchApp.fetch(API_URL, options);
        const code = response.getResponseCode();
        const body = response.getContentText();
        
        if (code === 200 || code === 201) {
          success = true;
          sheet.getRange(rowNum, 5).setValue('PROCESSED');
          processedCount++;
          Logger.log(`Row ${rowNum}: Successfully synced. UID: ${JSON.parse(body).uid}`);
        } else {
          Logger.log(`Row ${rowNum}: API Error (Status ${code}): ${body}`);
          retries--;
          if (retries > 0) {
            Logger.log(`Retrying in 2 seconds... (${retries} attempts left)`);
            Utilities.sleep(2000);
          } else {
            sheet.getRange(rowNum, 5).setValue(`ERROR: Status ${code} - ${body.substring(0, 50)}`);
            failureCount++;
          }
        }
      } catch (err) {
        Logger.log(`Row ${rowNum}: Network/Connection error: ${err.message}`);
        retries--;
        if (retries > 0) {
          Logger.log(`Retrying in 3 seconds... (${retries} attempts left)`);
          Utilities.sleep(3000);
        } else {
          sheet.getRange(rowNum, 5).setValue(`ERROR: ${err.message.substring(0, 80)}`);
          failureCount++;
        }
      }
    }
  }
  
  Logger.log(`Sync complete. Successfully processed: ${processedCount}, Failures: ${failureCount}`);
}

/**
 * Utility function to set up Script Properties directly from Google Apps Script editor.
 * Replace the placeholder values with your actual API details.
 */
function setupScriptProperties() {
  const SCRIPT_PROP = PropertiesService.getScriptProperties();
  SCRIPT_PROP.setProperty('SYNC_API_URL', 'https://your-netlify-site.netlify.app/.netlify/functions/syncPremiumUser');
  SCRIPT_PROP.setProperty('SYNC_API_KEY', 'your-random-secure-api-key');
  Logger.log('Script properties initialized. Replace values with your actual Netlify endpoint and API key.');
}

/**
 * Automatically creates a time-driven trigger to sync premium users every 5 minutes.
 */
function createSyncTrigger() {
  // Clear any existing sync triggers first to prevent duplicate trigger loops
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncPremiumUsers') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create trigger
  ScriptApp.newTrigger('syncPremiumUsers')
      .timeBased()
      .everyMinutes(5)
      .create();
      
  Logger.log('Time-driven sync trigger configured successfully to run every 5 minutes.');
}
