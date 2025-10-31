# Baseline PWA Behaviour Checklist

Use this document to capture the pre-migration state of the PWA so that regressions can be spotted quickly after feature parity work.

## 1. Environment Snapshot
- Node version: `TBD — capture during first local run`
- npm version: `TBD`
- OS / Browser versions tested: `Windows 11 · Chrome (planned)`
- Backend status (Docker / local services): `Redis + Flask-SocketIO backend (AI-OS/python-backend) requires REDIS_URL, DATABASE_URL, FLASK_SECRET_KEY, SUPABASE_SERVICE_KEY before launch`

## 2. Launch Steps
1. Ensure backend (`AI-OS/python-backend`) is running via Docker Compose or local start script.
2. From repo root, install dependencies: `npm install`
3. Start static server: `npm run start`
4. Open `http://localhost:3000` in primary browser.

> Record any deviations (missing env vars, failed start scripts, etc.) here:
```
Pending first launch; note Supabase env vars (.env) need verification before run.
```

## 3. Observation Log
| Area | Expected Today | Actual Baseline Notes |
|------|----------------|------------------------|
| Chat send/receive | Messages stream with basic formatting, no inline artifacts | Not yet validated – confirm Supabase JWT refresh + Redis-backed session creation once backend running |
| Shuffle menu | **Not present** | Confirm absence once PWA launched |
| Context window | Manual load via sync button; no caching | Need to observe when baseline run executed |
| AIOS settings | Basic Supabase auth forms only | Authentication flow pending; verify Supabase credentials |
| Notifications | Toast container renders | Visual confirmation pending — ensure backend `status` events surface in UI |
| File attachments | Attach + preview flows | Requires baseline test |

Add more rows for any additional behaviours noticed.

## 4. Console & Network
- Capture console warnings/errors:
```
Baseline session not yet executed. Expect Socket.IO `status` messages when backend connects/disconnects; confirm no Redis/auth errors in console.
```
- Capture failed network requests:
```
Baseline session not yet executed.
```

## 5. Screenshots / Recordings
- [ ] Chat view baseline
- [ ] Context window baseline
- [ ] AIOS settings baseline
- [ ] Notifications / error states (if any)

Store artifacts under `/assets/baseline/` (create directory if needed) and reference them here:
```
Pending baseline capture.
```

## 6. Summary
Provide a brief summary of current limitations or bugs observed before migration work begins.
```
Baseline run still pending; expect to document streaming behaviour, missing shuffle menu, and context fetch latency once captured.
```
