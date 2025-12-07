Local Development Setup Guide for PWA
Overview
To run PWA locally with local backend, you need to make the frontend and backend accessible on your local network so your mobile device can reach them.

Network Setup
Your Computer's Local IP
First, find your computer's local IP address:

Windows: Open CMD, run ipconfig, look for "IPv4 Address" (usually 192.168.x.x)
Mac/Linux: Open Terminal, run ifconfig or ip addr, look for local IP
Example: 192.168.1.100

Mobile Device Requirement
Your mobile phone must be on the same WiFi network as your computer.

Backend Changes (Railway/Local Python Backend)
1. Environment Variables (.env file)
Change FRONTEND_URL to your local IP:

FRONTEND_URL=http://192.168.1.100:3000
2. CORS Configuration (factory.py)
Add your local IP to allowed origins:

origins=[
    "http://192.168.1.100:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
3. Run Backend
Start the backend on 0.0.0.0 (not localhost) so it's accessible from network:

python app.py
# Should bind to 0.0.0.0:8765
Backend will be accessible at: http://192.168.1.100:8765

Frontend Changes (PWA)
1. Update Backend URLs (js/aios.js)
Change both backend URLs to your local IP:

// OAuth still goes to Render (or change to local if testing OAuth locally)
const OAUTH_BACKEND_URL = 'http://192.168.1.100:8765';

// API calls go to local backend
const API_BACKEND_URL = 'http://192.168.1.100:8765';
2. Run Frontend
Start the dev server on 0.0.0.0:

# If using Python's http.server
python -m http.server 3000 --bind 0.0.0.0

# If using Node.js/npm
npm run dev -- --host 0.0.0.0

# If using Vite
vite --host 0.0.0.0
Frontend will be accessible at: http://192.168.1.100:3000

Mobile Device Access
Open PWA on Mobile
Open mobile browser (Chrome/Safari)
Navigate to: http://192.168.1.100:3000
The PWA should load and connect to local backend
Testing Connection
Check if PWA loads
Try logging in (should work if Supabase credentials are correct)
Check browser console for errors
Verify API calls go to 192.168.1.100:8765
OAuth Considerations
Option 1: Keep Using Render for OAuth (Recommended)
Leave OAUTH_BACKEND_URL = 'https://aios-web.onrender.com'
OAuth flows still go to production Render backend
Only API calls use local backend
Advantage: No need to configure OAuth redirect URLs
Option 2: Use Local Backend for OAuth (Complex)
Change OAUTH_BACKEND_URL to http://192.168.1.100:8765
Update OAuth app redirect URLs in GitHub/Google:
GitHub: http://192.168.1.100:8765/auth/github/callback
Google: http://192.168.1.100:8765/auth/google/callback
Disadvantage: OAuth providers may not allow non-HTTPS URLs
Workaround: Use ngrok to create HTTPS tunnel
Using ngrok (Alternative for HTTPS)
If OAuth providers require HTTPS:

1. Install ngrok
Download from ngrok.com

2. Create Tunnel for Backend
ngrok http 8765
You'll get: https://abc123.ngrok.io

3. Update URLs
OAUTH_BACKEND_URL = 'https://abc123.ngrok.io'
API_BACKEND_URL = 'https://abc123.ngrok.io'
Update OAuth app redirect URLs to use ngrok URL
4. Create Tunnel for Frontend (Optional)
ngrok http 3000
Access PWA via ngrok HTTPS URL on mobile

Troubleshooting
Mobile Can't Reach Backend
Problem: Connection refused or timeout

Solutions:

Verify both devices on same WiFi
Check firewall isn't blocking port 8765
Verify backend is running on 0.0.0.0, not localhost
Try accessing http://192.168.1.100:8765/api/healthz from mobile browser
CORS Errors
Problem: CORS policy blocking requests

Solutions:

Add your local IP to CORS origins in factory.py
Restart backend after changing CORS config
Check browser console for exact origin being blocked
OAuth Fails
Problem: OAuth redirect doesn't work

Solutions:

Use Render for OAuth (Option 1 above)
Or use ngrok for HTTPS
Verify FRONTEND_URL in backend .env matches where PWA is running
Mobile Shows Blank Page
Problem: PWA doesn't load

Solutions:

Check if frontend dev server is running
Verify you're using IP address, not localhost
Check mobile browser console for errors
Try accessing from computer browser first
Quick Checklist
Backend:

[ ] Running on 0.0.0.0:8765
[ ] FRONTEND_URL set to http://192.168.1.100:3000
[ ] CORS includes local IP
[ ] Firewall allows port 8765
Frontend:

[ ] Running on 0.0.0.0:3000
[ ] Backend URLs point to 192.168.1.100:8765
[ ] Service worker disabled or updated for local dev
Network:

[ ] Computer and mobile on same WiFi
[ ] Can ping computer from mobile
[ ] Firewall not blocking connections
Testing:

[ ] Can access http://192.168.1.100:3000 from mobile
[ ] Can access http://192.168.1.100:8765/api/healthz from mobile
[ ] PWA loads on mobile
[ ] Can log in
[ ] API calls work
Reverting to Production
When done with local testing:

Frontend: Change backend URLs back to production
Backend: Change FRONTEND_URL back to Vercel URL
Deploy: Push changes to production
Mobile: Access production URL again