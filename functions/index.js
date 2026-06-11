/**
 * College Simplified — Firebase Cloud Functions
 * ─────────────────────────────────────────────
 * Handles: Password Reset Email Sending
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// ══════════════════════════════════════════
//  EMAIL CONFIGURATION (Gmail SMTP)
// ══════════════════════════════════════════

// Store these in Firebase Environment Variables (see setup below)
const EMAIL_USER = process.env.GMAIL_EMAIL || 'your-gmail@gmail.com';
const EMAIL_PASSWORD = process.env.GMAIL_PASSWORD || 'your-app-password';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD
  }
});

// ══════════════════════════════════════════
//  SEND PASSWORD RESET EMAIL
// ══════════════════════════════════════════

exports.sendPasswordResetEmail = functions.https.onCall(async (data, context) => {
  const { email, userName, resetToken } = data;

  // Validation
  if (!email || !resetToken) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing email or reset token'
    );
  }

  try {
    // Email HTML template
    const resetLink = `https://yourapp.com/auth.html?reset=true&token=${resetToken}&email=${encodeURIComponent(email)}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">College Simplified</h1>
          <p style="color: #fef2f2; margin: 5px 0 0 0;">Password Reset</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="color: #111827; font-size: 16px; margin: 0 0 20px 0;">
            Hi ${userName || 'User'},
          </p>
          
          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            We received a request to reset your password. Use the reset code below to create a new password for your College Simplified account.
          </p>
          
          <div style="background: #f4f6fb; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase;">Your Reset Code</p>
            <p style="color: #dc2626; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 0; font-family: monospace;">
              ${resetToken}
            </p>
          </div>
          
          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            Go to the "Forgot Password" page and paste this code along with your new password.
          </p>
          
          <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
            <strong>Security Note:</strong> This reset code expires in 1 hour. If you didn't request this, please ignore this email.
          </p>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;">© 2026 College Simplified. All rights reserved.</p>
        </div>
      </div>
    `;

    // Send email
    const mailOptions = {
      from: `College Simplified <${EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your College Simplified Password',
      html: htmlContent,
      text: `Hello ${userName || 'User'},\n\nHere's your password reset code: ${resetToken}\n\nThis code expires in 1 hour.\n\nCollege Simplified Team`
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`Password reset email sent to ${email}`);
    return { success: true, message: 'Reset email sent successfully' };

  } catch (error) {
    console.error('Error sending email:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send reset email. Please try again later.'
    );
  }
});

// ══════════════════════════════════════════
//  SEND NOTIFICATION EMAIL (Generic)
// ══════════════════════════════════════════

exports.sendNotificationEmail = functions.https.onCall(async (data, context) => {
  const { email, subject, title, message } = data;

  if (!email || !subject) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing email or subject'
    );
  }

  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">College Simplified</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          ${title ? `<h2 style="color: #111827; margin: 0 0 15px 0;">${title}</h2>` : ''}
          <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">
            ${message}
          </p>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;">© 2026 College Simplified. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `College Simplified <${EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent,
      text: message
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`Notification email sent to ${email}`);
    return { success: true, message: 'Notification sent successfully' };

  } catch (error) {
    console.error('Error sending notification:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send notification.'
    );
  }
});
