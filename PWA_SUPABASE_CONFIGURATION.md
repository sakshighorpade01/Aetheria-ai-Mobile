# PWA Supabase Configuration Guide

## Date: November 29, 2025
## Project: Aetheria AI Mobile (PWA)

---

## Issue Summary

Your login with email/password is failing with **400 Bad Request** and error code `invalid_credentials`. This is likely due to one of the following:

1. **Incorrect email or password** being entered
2. **Email confirmation required** - The new Supabase project has email confirmation enabled. You MUST confirm your email before you can log in.
3. **User doesn't exist** in the new database

---

## Required Supabase Dashboard Configuration for PWA

Since your PWA cannot use the `aios://auth-callback` protocol (that'sfor Electron), you must configure standard HTTP/HTTPS URLs in Supabase.

### Step 1: Configure Authentication URLs

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**

2. Set these values:

#### **Site URL**
```
http://localhost:3000
```
*Or your production URL when deploying*

#### **Redirect URLs** (Add ALL of these)
```
http://localhost:3000
http://localhost:3000/
http://192.168.1.34:3000
http://192.168.1.34:3000/
https://your-production-domain.com
https://your-production-domain.com/
```

### Step 2: Disable Email Confirmation (Optional, for Testing)

If you want to test login without email confirmation:

1. Go to **Supabase Dashboard** → **Authentication** → **Providers** → **Email**
2. **Disable** "Confirm email"
3. Click **Save**

**OR** check your email and click the confirmation link sent after signup.

---

## Current Configuration Status

### ✅ Correctly Configured:
- Supabase URL: `https://ilprcrqemdiilbtaqelm.supabase.co`
- Supabase Anon Key: Correctly set in both `config.js` and `supabase-client.js`
- OAuth redirect code in `aios.js` uses `window.location.origin` which works for PWA

### ⚠️ Needs Manual Configuration in Supabase Dashboard:
- Site URL must be set to your PWA's URL (currently running on `http://192.168.1.34:3000`)
- Redirect URLs must include all variations of your URL

---

## Troubleshooting Login

### If you still get `invalid_credentials`:

1. **Verify the account exists:**
   - Go to Supabase Dashboard → Authentication → Users
   - Check if your email is listed
   
2. **Check email confirmation status:**
   - If the user shows "Email not confirmed" → Check your email for confirmation link
   
3. **Try resetting password:**
   - Use the "Forgot Password" feature (if implemented)
   - Or manually reset in Supabase Dashboard → Authentication → Users → (your user) → Send recovery email

4. **Create a new account:**
   - Use the Sign Up form
   - Confirm the email 
   - Then try logging in

---

## For Production Deployment

When deploying your PWA to production (e.g., `https://your-app.com`):

1. Update the redirect URLs in Supabase Dashboard to include:
   ```
   https://your-app.com
   https://your-app.com/
   ```

2. Set the Site URL to:
   ```
   https://your-app.com
   ```

3. The code in `aios.js` already handles this dynamically using `window.location.origin`, so no code changes needed!

---

## Google OAuth Configuration

Your Google OAuth is configured with:
- **Client ID**: `167883790879-6trds0p82hthlgsbmp97ojrqf8s5areb.apps.googleusercontent.com`
- **Authorized redirect URI** in Google Cloud Console should include:
  ```
  https://ilprcrqemdiilbtaqelm.supabase.co/auth/v1/callback
  ```

---

## Next Steps

1. **Go to Supabase Dashboard** and add the redirect URLs mentioned above
2. **Try signing up** with a new account OR confirm your existing account's email
3. **Test login** again - it should work now!

The enhanced logging in the updated `aios.js` will show you the exact redirect URL being used, which helps verify configuration.
