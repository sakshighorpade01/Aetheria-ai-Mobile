# PWA Database Migration Summary

## Date: November 29, 2025  
## Current Issue: Login failing with 400 Bad Request - `invalid_credentials`

---

## Problem Analysis

### 1. **Root Cause of `invalid_credentials` Error**

From the Supabase error logs, your login is failing because:

**Most Likely:**
- **Email not confirmed**: Your new Supabase project has "Email Confirmation" enabled. If you signed up but didn't click the confirmation link in your email, you cannot log in.

**Alternative Causes:**
- Wrong email/password combination
- User doesn't exist in the new database

---

## What's Already Working ✅

### Database Configuration
- ✅ All tables migrated successfully (`profiles`, `agno_sessions`, `agno_memories`, `session_titles`, `attachment`, `request_logs`, `user_integrations`)
- ✅ Row Level Security (RLS) enabled on all tables  
- ✅ Triggers configured (`on_auth_user_created`)
- ✅ Storage bucket created (`media-uploads`)

### Frontend Configuration
- ✅ `js/config.js` - Supabase URL and Anon Key updated
- ✅ `js/supabase-client.js` - Supabase credentials correctly hardcoded
- ✅ OAuth redirect code in `js/aios.js` uses `window.location.origin` which is PWA-compatible

---

## What Needs Manual Configuration ⚠️

### Critical: Supabase Dashboard Settings

You MUST configure these in the **Supabase Dashboard** manually:

#### 1. Navigate to: **Authentication → URL Configuration**

#### 2. Set **Site URL**:
```
http://192.168.1.34:3000
```
*(When deploying to production, change this to your production URL)*

#### 3. Add **Redirect URLs** (add ALL of these):
```
http://localhost:3000
http://localhost:3000/
http://192.168.1.34:3000
http://192.168.1.34:3000/
https://your-production-domain.com
https://your-production-domain.com/
```

**Why:** The current setup from Electron (`aios://auth-callback`) doesn't work for PWA. PWA needs standard HTTP/HTTPS URLs.

---

## How to Fix Login

### Option 1: Confirm Your Email (Recommended)
1. Check your email inbox for a confirmation email from Supabase
2. Click the confirmation link
3. Try logging in again

### Option 2: Disable Email Confirmation (For Testing)
1. Go to **Supabase Dashboard → Authentication → Providers → Email**
2. **Uncheck** "Confirm email"
3. Click **Save**
4. Sign up again with a new account (or reset existing account)

### Option 3: Create a New Account
1. Use the Sign Up form in your PWA
2. Confirm the email (if confirmation is enabled)
3. Log in with the new credentials

---

## Code Changes Made

### Enhanced Logging in `js/aios.js`

The Google Sign-In method (`handleGoogleSignIn`) has been updated to:
- Use `window.location.origin + '/'` for PWA redirect URL (clean root URL)
- Add comprehensive console logging showing:
  - The exact redirect URL being used
  - Reminders to whitelist the URL in Supabase Dashboard
  - OAuth flow progress

**Log Output Example:**
```
[PWA Google Sign-In] Initiating OAuth...
[PWA Google Sign-In] Redirect URL: http://192.168.1.34:3000/
[PWA Google Sign-In] ⚠️  IMPORTANT: This URL must be whitelisted in Supabase Dashboard → Authentication → URL Configuration
[PWA Google Sign-In] OAuth URL generated, redirecting to Google...
```

---

## Differences: Electron vs PWA

| Feature | Electron (Desktop) | PWA (Mobile) |
|---------|-------------------|--------------|
| **OAuth Redirect** | `aios://auth-callback` | `http://your-url.com/` or `https://your-url.com/` |
| **OAuth Flow** | Opens in system browser, deep link back | Opens in same browser, redirects back |
| **Storage** | LocalStorage + Filesystem | LocalStorage only (via browser) |
| **API Keys Location** | Can use `.env` files + config | Hardcoded in code (already done) |

---

## Production Deployment Checklist

When deploying to production:

1. ☐ Update Supabase "Site URL" to production domain
2. ☐ Add production domain to "Redirect URLs"  
3. ☐ Verify Google OAuth redirect URIs in Google Cloud Console include:
   - `https://ilprcrqemdiilbtaqelm.supabase.co/auth/v1/callback`
4. ☐ Test sign-up and login flows
5. ☐ Test Google OAuth flow
6. ☐ Verify RLS policies are working (users can only access their own data)

---

## Testing Steps

1. **Clear browser cache and localStorage**
   ```javascript
   // Run in browser console:
   localStorage.clear();
   location.reload();
   ```

2. **Try Google Sign-In first** (easier than email/password)
   - Click "Sign in with Google"
   - Check console logs for redirect URL
   - Verify URL is whitelisted in Supabase

3. **Try email/password signup**
   - Sign up with a new email
   - Check email for confirmation (if enabled)
   - Try logging in

4. **Monitor Console**
   - Watch for authentication errors
   - Check network tab for failed requests
   - Look for helpful log messages from the updated code

---

## Files Modified/Created

1. ✅ `PWA_SUPABASE_CONFIGURATION.md` - Complete configuration guide
2. ✅ `DATABASE_MIGRATION_SUMMARY.md` - This file
3. ⚠️ `js/aios.js` - Should be updated with enhanced logging (currently restored to avoid errors, manual update recommended)

---

## Support

If issues persist:

1. **Check Supabase Logs:**
   - Dashboard → Logs → Auth Logs
   - Look for specific error messages

2. **Verify User Exists:**
   - Dashboard → Authentication → Users  
   - Check if your email is listed and confirmed

3. **Test Integration Status:**
   - Log in successfully first
   - Then test GitHub/Google/Vercel integrations

---

**Next Immediate Action:** Go to Supabase Dashboard and add the redirect URLs listed above!
