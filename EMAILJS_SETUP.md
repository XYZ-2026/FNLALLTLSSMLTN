# EmailJS Setup Guide - College Simplified

## **Complete Setup Instructions**

### **Step 1: Sign Up on EmailJS** (5 minutes)

1. Go to [emailjs.com](https://www.emailjs.com)
2. Click **"Sign Up Free"**
3. Create account with email & password
4. Verify your email

---

### **Step 2: Connect Gmail Account**

1. In Dashboard, click **Email Services** (left sidebar)
2. Click **Add Service**
3. Select **Gmail**
4. Click **Connect with Gmail**
5. Authorize EmailJS to use your Gmail
6. Click **Create Service** (your service ID will auto-generate)
7. **Save your Service ID** (looks like: `service_xxxxx`)

---

### **Step 3: Create Email Template**

1. In Dashboard, click **Email Templates** (left sidebar)
2. Click **Create New Template**
3. Fill in:
   - **Template Name:** `password_reset`
   - **Template ID:** `password_reset`
   
4. **To Email Field (IMPORTANT):**
   At the top of the template editor, find the **"To Email"** field and set it to:
   ```
   {{to_email}}
   ```
   This allows the code to dynamically set the recipient's email address.

5. **Subject:** 
   ```
   Reset Your College Simplified Password
   ```

6. **HTML Content:** Copy this:
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">College Simplified</h1>
    <p style="color: #fef2f2; margin: 5px 0 0 0;">Password Reset</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="color: #111827; font-size: 16px; margin: 0 0 20px 0;">
      Hi {{user_name}},
    </p>
    
    <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      We received a request to reset your password. You can reset your password using either of the two options below:
    </p>

    <!-- Option 1: Direct Link (Recommended) -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{reset_link}}" target="_blank" style="background-color: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);">Reset Password Directly</a>
    </div>

    <!-- Option 2: Copy Reset Code -->
    <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
      Alternatively, you can manually enter the reset code on the Forgot Password page:
    </p>
    
    <div style="background: #f4f6fb; padding: 20px; border-radius: 8px; text-align: center; margin: 0 0 20px 0;">
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase;">Your Reset Code</p>
      <p style="color: #dc2626; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 0; font-family: monospace;">
        {{reset_code}}
      </p>
    </div>
    
    <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
      <strong>Security Note:</strong> The reset code and link will expire in 1 hour. If you did not request a password reset, please ignore this email.
    </p>
  </div>
  
  <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #6b7280;">
    <p style="margin: 0;">© 2026 College Simplified. All rights reserved.</p>
  </div>
</div>
```

7. **Variables Used:** `{{to_email}}`, `{{user_name}}`, `{{reset_code}}`, `{{reset_link}}`
8. Click **Save**

---

### **Step 4: Get Your Public Key**

1. In Dashboard, click **Account** (top right) → **API Keys**
2. Copy your **Public Key** (starts with `xxxxx`)
3. **Save this Public Key**

---

### **Step 5: Update Your Code**

In `auth.html`, find this section (around line 620):

```javascript
// ══════════════════════════════════════════
// EMAILJS CONFIGURATION
// ══════════════════════════════════════════

const EMAILJS_CONFIG = {
  serviceId: 'YOUR_SERVICE_ID_HERE',
  templateId: 'password_reset',
  publicKey: 'YOUR_PUBLIC_KEY_HERE'
};

// Also update the initialization:
emailjs.init('YOUR_PUBLIC_KEY_HERE');
```

**Replace with your actual keys:**
- `YOUR_SERVICE_ID_HERE` → Your Service ID from Step 2
- `YOUR_PUBLIC_KEY_HERE` → Your Public Key from Step 4

**Example:**
```javascript
const EMAILJS_CONFIG = {
  serviceId: 'service_abc123xyz',
  templateId: 'password_reset',
  publicKey: 'pk_public_xyz789abc'
};

emailjs.init('pk_public_xyz789abc');
```

---

### **Step 6: Test It!**

1. Open your app in browser
2. Go to **Forgot Password** tab
3. Enter a test email
4. Check if email arrives in inbox

---

## **Troubleshooting**

| Issue | Solution |
|-------|----------|
| Email not sending | Check console (F12) for errors. Verify Service ID & Public Key are correct. |
| Wrong email sending | Make sure Gmail account is connected in EmailJS settings. |
| "Unauthorized" error | Check that your Public Key is correct. |
| Template variables not working | Make sure template has `{{user_name}}` and `{{reset_code}}` |

---

## **Free Tier Limits**

- 200 emails/month (completely free)
- Perfect for password resets

---

**Need help?** Check [emailjs.com/docs](https://www.emailjs.com/docs/)
