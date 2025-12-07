# Supabase Migration & System Configuration Documentation

**Date:** November 24, 2025
**Project:** Aetheria AI (AI-OS)
**Migration Status:** ✅ Complete

## 1. Migration Overview
This document details the complete process of migrating the Aetheria AI backend and database from the legacy Supabase project to the new production instance. It covers database schema creation, authentication configuration, codebase updates, and environment setup.

## 2. Database Architecture

### 2.1 Tables Created
The following tables were successfully migrated with identical structures to the original:

*   **`profiles`**: User profile data (linked to `auth.users`).
*   **`agno_sessions`**: Stores AI agent session metadata.
*   **`agno_memories`**: Stores memory/context for agents.
*   **`session_titles`**: Custom titles for chat sessions.
*   **`attachment`**: Metadata for file uploads.
*   **`request_logs`**: Logging for API requests.
*   **`user_integrations`**: Stores tokens for third-party tools (GitHub, Vercel, etc.).

### 2.2 Security & Automation
*   **Row Level Security (RLS)**: Enabled on ALL tables. Policies enforce that users can only `SELECT`, `INSERT`, `UPDATE`, or `DELETE` their own data (`user_id = auth.uid()`).
*   **Triggers**:
    *   `on_auth_user_created`: Automatically creates a row in the `profiles` table whenever a new user signs up via Supabase Auth.
*   **Storage**:
    *   Bucket: `media-uploads` (Private) created for handling user file attachments.

## 3. Authentication System Configuration

### 3.1 Providers
*   **Email/Password**: Enabled with email confirmation.
*   **Google OAuth**: Enabled.
    *   **Client ID**: `167883790879-6trds0p82hthlgsbmp97ojrqf8s5areb.apps.googleusercontent.com`
    *   **Redirect URL**: `aios://auth-callback`

### 3.2 Critical Dashboard Settings
To prevent redirect errors (e.g., redirecting to `localhost:3000`), the Supabase project was configured as follows:
*   **Site URL**: Set to `aios://auth-callback`
*   **Redirect URLs**: Added `aios://auth-callback` to the allowlist.

## 4. Codebase Updates

### 4.1 Frontend (`js/`)
*   **`config.js`**: Updated with new Supabase Project URL and Anon Key.
*   **`auth-service.js`**:
    *   Added `skipBrowserRedirect: true` to `signInWithGoogle` to prevent the Electron window from navigating away.
    *   Ensured `signInWithGoogle` returns the OAuth URL for external handling.
*   **`preload.js`**:
    *   Exposed `shell.openExternal` to allow the renderer to open the system default browser for OAuth.
    *   Exposed missing auth methods: `signInWithGoogle`, `setSession`.
    *   Added comprehensive logging for all auth operations.
*   **`main.js`**:
    *   Added `app.setName('Aetheria AI')` for better OS integration.
    *   Verified `aios://` deep link handling logic.

### 4.2 Backend (`python-backend/`)
*   **`.env`**: Updated with new credentials.
    *   `SUPABASE_URL`: New project URL.
    *   `SUPABASE_SERVICE_KEY`: New Service Role Key (for admin access).
    *   `DATABASE_URL`: New Connection Pooler URL (IPv4 compatible).

## 5. Environment Configuration

### Final `.env` Structure
```env
# Python Backend Configuration
SUPABASE_URL=https://ilprcrqemdiilbtaqelm.supabase.co
SUPABASE_SERVICE_KEY=[YOUR_SERVICE_ROLE_KEY]
DATABASE_URL=postgresql://postgres.ilprcrqemdiilbtaqelm:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

## 6. Troubleshooting Log & Solutions

### Issue 1: "Open Electron?" Prompt
*   **Symptom**: When clicking the deep link, the browser asks to "Open Electron".
*   **Cause**: Running in development mode (`electron .`).
*   **Solution**: This is normal behavior. In production builds (`npm run dist`), the app name will correctly appear as "Aetheria AI".

### Issue 2: Redirect to `localhost:3000`
*   **Symptom**: After Google login, browser goes to a broken localhost page.
*   **Cause**: Supabase defaults to `localhost:3000` if the requested redirect URL isn't explicitly allowed.
*   **Solution**: Updated "Site URL" and "Redirect URLs" in Supabase Dashboard to `aios://auth-callback`.

### Issue 3: Black Screen on Sign-In
*   **Symptom**: Clicking "Sign in with Google" turned the app window black.
*   **Cause**: Supabase client was trying to perform the OAuth redirect *inside* the Electron webview.
*   **Solution**: Added `skipBrowserRedirect: true` to the `signInWithOAuth` options and implemented external browser opening via `shell.openExternal`.

---
*This document serves as the single source of truth for the database migration and setup as of Nov 24, 2025.*
