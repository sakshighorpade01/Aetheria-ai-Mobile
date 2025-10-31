# PWA Migration Task Plan

Legend: `[ ]` not started · `[~]` in progress · `[x]` complete. Indent levels represent dependency hierarchy (parent must be satisfied before child).

## 1. Pre-flight & Baseline Validation
- [ ] (1.1) Audit environment & tooling
  - [ ] (1.1.a) Confirm Node / npm versions align with Electron project requirements
  - [ ] (1.1.b) Install/refresh dependencies via `npm install` and document any divergences between `package.json` files
  - [ ] (1.1.c) Validate Supabase credentials flow for local development (env vars, auth redirect URLs)
  - [ ] (1.1.d) Provision backend prerequisites (Redis, Postgres connection via `DATABASE_URL`, `FLASK_SECRET_KEY`, `SUPABASE_SERVICE_KEY`) and document local startup order
  - Notes:
    - Electron project currently targets `electron@^37.2.6` while the PWA root uses `electron@^29.4.6`; decide on unified runtime before build.
    - Electron `package.json` includes `axios` and `puppeteer-core` which remain desktop-only; verify if web equivalents or guards are required when porting modules.
- [ ] (1.2) Capture current PWA behaviour
  - [ ] (1.2.a) Launch current PWA + backend stack, record baseline console/network errors
  - [ ] (1.2.b) Export screenshots/notes for chat, context window, AIOS settings to measure regression later
- [ ] (1.3) Create comparison matrix update
  - [ ] (1.3.a) Populate `FEATURE_COMPARISON.md` with authoritative status for core modules (chat, context, formatter, AIOS, services, CSS, HTML)

## 2. Shared Foundations & Assets
- [ ] (2.1) Align shared CSS and variables
  - [ ] (2.1.a) Verify all chat-related CSS from Electron (`chat-variables.css`, `chat-layout.css`, etc.) are present and imported in PWA HTML entry points
  - [ ] (2.1.b) Harmonize CSS custom properties and z-index values to match Electron expectations
  - Notes:
    - PWA currently imports consolidated `chat.css` but lacks module-level CSS (`chat-variables.css`, `chat-layout.css`, `chat-messages.css`, `chat-context.css`, `chat-input.css`, `notifications.css`, `welcome-message.css`). Need to port files and update `<link>` tags in `index.html`/`chat.html` once added.
    - Verify design tokens in `design-system.css` align with new chat variables to avoid overrides/conflicts.
- [ ] (2.2) Synchronize shared JS utilities
  - [x] (2.2.a) Port `conversation-state-manager.js` into `js/` and adapt for browser-only APIs (remove Electron dependencies)
  - [x] (2.2.b) Confirm `floating-window-manager.js`, `notification-service.js`, `welcome-display.js`, `user-profile-service.js` availability and compatibility; refactor for localStorage as needed
  - [ ] (2.2.c) Ensure artifact handler parity and update if Electron version has evolved (inline reopen logic, artifact metadata)
  - Notes:
    - Electron repo contains `conversation-state-manager.js`, `floating-window-manager.js`, `notification-service.js`, `welcome-display.js`, `user-profile-service.js`; PWA `js/` folder only has `add-files`, `aios`, `artifact-handler`, `chat`, `context-handler`, `main`, `message-formatter`, `renderer`, `socket-service`, `to-do-list`. Need to port missing modules and adjust imports in `index.html`/module entry points.
    - When porting, strip IPC/file-system usage and replace with web storage or no-op guards.
- [ ] (2.3) HTML scaffolding updates (`index.html`, `chat.html`, `aios.html`)
  - [ ] (2.3.a) Import missing styles/scripts (shuffle menu, floating windows, welcome display)
  - [ ] (2.3.b) Add DOM containers required by new controllers (shuffle dropdown markup, reasoning containers, context indicators)
  - [ ] (2.3.c) Validate accessibility attributes (aria roles, labels) after HTML adjustments

## 3. Chat Module Parity (`js/chat.js`)
- [ ] (3.1) Refactor module structure
  - [ ] (3.1.a) Convert module to class-based controller (mirroring Electron) or modularize initialization hooks for shuffle menu, floating window manager, welcome display
  - [ ] (3.1.b) Introduce top-level state objects (`chatConfig`, `shuffleMenuController`, `conversationStateManager`) and ensure they persist across reloads
- [ ] (3.2) Shuffle menu integration
  - [x] (3.2.a) Port `ShuffleMenuController` class and adapt event bindings to PWA DOM
  - [x] (3.2.b) Hook menu state to `chatConfig` replacements for memory/tools/tasks toggles
  - [x] (3.2.c) Display active-state UI feedback (toggle classes, aria-expanded)
- [ ] (3.3) Conversation lifecycle improvements
  - [x] (3.3.a) Implement `startNewConversation()` flow with session termination, UI reset, context cache invalidation
  - [x] (3.3.b) Ensure file attachments, selected sessions, and conversation state manager reset gracefully
  - [x] (3.3.c) Emit custom events to inform welcome display and other listeners
- [ ] (3.4) Message streaming & error recovery
  - [x] (3.4.a) Port `extractConversationHistory()` and integrate into error handling for resend-on-failure
  - [x] (3.4.b) Enhance `handleSendMessage()` to include conversation history, context IDs, and reorganized payload (tools toggles, deepsearch flag)
  - [x] (3.4.c) Add reconnection logic + user feedback via notification service for socket errors
- [ ] (3.5) Rendering upgrades
  - [x] (3.5.a) Implement `createBotMessagePlaceholder()` from Electron with reasoning dropdown, logs, inline content containers
  - [x] (3.5.b) Port `populateBotMessage()` updates to support inline artifacts, streaming logs, reasoning summary
  - [x] (3.5.c) Introduce `renderTurnFromEvents()` and expose globally for context replay
  - [x] (3.5.d) Wire `handleAgentStep()` improvements (tool logs, thinking indicator) and `updateReasoningSummary()` helper
- [ ] (3.6) Integrations with ancillary modules
  - [x] (3.6.a) Initialize `FloatingWindowManager`, `WelcomeDisplay`, `conversationStateManager`, `UnifiedPreviewHandler` per Electron logic
  - [x] (3.6.b) Register DOM references for context, tasks, AIOS windows to floating window manager
- [x] (3.7) Socket/WebSocket integration alignment
  - [x] (3.7.a) Ensure all Socket.IO events handled (response, agent_step, status, sandbox-command, error, etc.) with fallbacks for missing events
  - [x] (3.7.b) Confirm session termination/offline flows send proper signals
  - [x] (3.7.c) Surface backend `status` messages (connect, terminate, sandbox lifecycle) and sandbox automation channel feedback in UI
  - [x] (3.7.d) Adjust chat payload/tool config to mirror Electron (`enable_browser`, `enable_supabase`, etc.)
  - Notes:
    - Browser automation commands cannot drive native browsers on mobile; PWA surfaces sandbox/browser status only and requires manual follow-up by users. Full automation remains desktop-only.

## 4. Context Handler Enhancements (`js/context-handler.js`)
- [ ] (4.1) Background session loading
  - [ ] (4.1.a) Port `preloadSessions()` timer logic with cancelation safeguards
  - [ ] (4.1.b) Implement `loadSessionsInBackground()` using Supabase session tokens (replace Electron auth)
  - [ ] (4.1.c) Manage `loadingState` (`idle`/`loading`/`loaded`/`error`) and persist results for quick display
- [ ] (4.2) Context window UX
  - [ ] (4.2.a) Update `openContextWindow()` to show cached data, loading placeholders, retry CTA
  - [ ] (4.2.b) Build retry handler tied to `forceRefreshSessions()`
  - [ ] (4.2.c) Preserve selection states between opens when applicable
- [ ] (4.3) Session data fidelity
  - [ ] (4.3.a) Return full session objects (with `session_id`, metadata, interactions) from `getSelectedSessionsData()`
  - [ ] (4.3.b) Adapt selection chips display (via context files bar) to show session titles + allow removal
- [ ] (4.4) Session detail rendering
  - [ ] (4.4.a) Port turn-based rendering using `renderTurnFromEvents()` for historical playback
  - [ ] (4.4.b) Provide fallback formatting if renderer unavailable (defensive coding)
- [ ] (4.5) Notification & preview integration
  - [ ] (4.5.a) Hook notification service to context actions (selection, errors)
  - [ ] (4.5.b) Ensure `UnifiedPreviewHandler` displays selected context sessions/files consistently

## 5. Message Formatter Upgrades (`js/message-formatter.js`)
- [ ] (5.1) Inline renderer support
  - [ ] (5.1.a) Port `buildInlineRenderer()` and `applyInlineEnhancements()` for inline artifacts
  - [ ] (5.1.b) Implement interactive Mermaid blocks (toggle preview/source, pan/zoom, reset state)
- [ ] (5.2) Streaming pipeline
  - [ ] (5.2.a) Harmonize `formatStreaming()` with Electron version (shared renderer, sanitization rules)
  - [ ] (5.2.b) Ensure `finishStreaming()` clears caches properly to avoid memory leaks
- [ ] (5.3) Artifact handler hooks
  - [ ] (5.3.a) Verify artifact references open artifact modal/preview seamlessly
  - [ ] (5.3.b) Update sanitizer allow-list to cover new inline elements and attributes
- [ ] (5.4) Theme responsiveness
  - [ ] (5.4.a) Mirror Mermaid theme observer for dark/light mode toggling
  - [ ] (5.4.b) Confirm syntax highlighting with hljs for streamed + inline code blocks

## 6. AIOS Settings Parity (`js/aios.js`)
- [ ] (6.1) UI structure & DOM requirements
  - [ ] (6.1.a) Update `aios.html` with identity card, avatar slots, integration buttons as per Electron design
  - [ ] (6.1.b) Align CSS for avatars, tabs, integration states with desktop styling
- [ ] (6.2) User identity handling
  - [ ] (6.2.a) Port `updateUserUI()` logic with fallback avatars/initials
  - [ ] (6.2.b) Store user profile preferences (theme, name) in localStorage
- [ ] (6.3) Integration management
  - [ ] (6.3.a) Rework connect/disconnect flows to use Supabase session + PWA-friendly proxy endpoints (`/login/:provider` via `vercel.json`)
  - [ ] (6.3.b) Implement provider button state machine (`Connect` vs `Disconnect`, icons, success toasts)
  - [ ] (6.3.c) Support additional providers (GitHub, Google) and gracefully skip desktop-only ones (Vercel, Supabase CLI) with messaging
- [ ] (6.4) Auth lifecycle
  - [ ] (6.4.a) Subscribe to Supabase `onAuthStateChange` and refresh settings view in real time
  - [ ] (6.4.b) Ensure logout/login flows close sidebar, clear cached data, and update integration status
- [ ] (6.5) Support tab & feedback enhancements
  - [ ] (6.5.a) Port support form submission logic (REST call, screenshot attachment pipeline) adjusted for browser APIs
  - [ ] (6.5.b) Provide validation + success/error toast notifications

## 7. Ancillary Feature Alignment
- [ ] (7.1) Welcome display
  - [x] (7.1.a) Initialize `WelcomeDisplay` within chat init, ensure templates exist in HTML
  - [x] (7.1.b) Link to conversation cleared events and personalize with Supabase user data
- [ ] (7.2) Notification service
  - [ ] (7.2.a) Confirm toast container in DOM and CSS animations match Electron version
  - [ ] (7.2.b) Migrate any new notification variants (warning, persistent, stacked)
- [ ] (7.3) Floating window manager
  - [x] (7.3.a) Register context, tasks, AIOS windows; test docking/minimizing interactions
  - [ ] (7.3.b) Verify event hooks for resizing and mobile responsiveness
- [ ] (7.4) File attachment pipeline
  - [ ] (7.4.a) Review `add-files.js` vs Electron for enhancements (preview modes, validations)
  - [ ] (7.4.b) Sync unified preview handler features (historical context view, file removal UX)

## 8. Testing & Quality Assurance
- [ ] (8.1) Automated/Manual test plan
  - [ ] (8.1.a) Update `TEST_CHECKLIST.md` with new scenarios (shuffle menu, background loading, inline mermaid)
  - [ ] (8.1.b) Add targeted unit/integration tests where feasible (e.g., formatter utilities)
- [ ] (8.2) Cross-browser verification
  - [ ] (8.2.a) Validate Chrome, Firefox, Safari, Edge (desktop + mobile) for layout/feature parity
  - [ ] (8.2.b) Test offline mode/service worker interactions with new assets
- [ ] (8.3) Performance tuning
  - [ ] (8.3.a) Measure initial load & memory usage; lazy-load heavy libraries (Mermaid, hljs) if necessary
  - [ ] (8.3.b) Ensure background loading does not block main thread (debounce, requestIdleCallback if available)

## 9. Documentation & Release Readiness
- [ ] (9.1) Update project docs
  - [ ] (9.1.a) Revise `README.md` with new features, setup steps, and screenshots
  - [ ] (9.1.b) Refresh `MIGRATION_PLAN.md` progress markers (Phase 3–5 completion status)
  - [ ] (9.1.c) Maintain `IMPLEMENTATION_LOG.md` (if present) with change notes per module
- [ ] (9.2) Deployment preparation
  - [ ] (9.2.a) Review `vercel.json` proxy routes for new endpoints (integrations, backend API)
  - [ ] (9.2.b) Verify build pipeline (GitHub Actions/Vercel) passes with new assets
  - [ ] (9.2.c) Tag release candidate once acceptance testing completes
