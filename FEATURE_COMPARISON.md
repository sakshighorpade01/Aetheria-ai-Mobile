# Feature Comparison – Electron v1.1.4 vs PWA v1.0.4

Legend: Priority 🔴 Critical · 🟡 Important · 🟢 Nice-to-have

| Area | Electron (v1.1.4) | PWA (v1.0.4) | Migration Notes | Priority |
|------|--------------------|--------------|------------------|----------|
| Chat shell (`chat.js`) | Full-featured controller with shuffle menu, reasoning UI, floating window integration, background preload hooks | Basic streaming logic, no shuffle menu, limited reasoning UI, no background preload | Port ShuffleMenuController, reasoning containers, renderTurnFromEvents, startNewConversation flow; adapt to socketService | 🔴 |
| Error recovery | `extractConversationHistory()` and resend flow guard against backend failures | Manual retry only; conversation state lost | Bring history extraction helpers and integrate into sendMessage error path | 🔴 |
| Socket events | Handles `response`, `agent_step`, `status`, sandbox events with logs | Listens only to `response`, `agent_step`, `error`; status missing | Expand listeners, add fallbacks for unhandled events, surface notifications | 🟡 |
| Context handler (`context-handler.js`) | Background preload, caching, state machine (`idle/loading/loaded/error`), retry CTA, full session objects with IDs | Fetches on demand, no caching, strips session metadata | Implement preload timer, state handling, return full sessions, add retry UX | 🔴 |
| Session replay | `renderTurnFromEvents()` renders saved sessions with inline artifacts | Detail view uses simple formatter; no turn separation | Expose renderer globally and reuse for replay; fallback gracefully | 🟡 |
| Message formatting (`message-formatter.js`) | Inline artifact renderer, interactive Mermaid (pan/zoom, preview/source toggles), sanitizer allow-list | Artifact buttons only; limited Mermaid support; no inline enhancements | Port inline renderer + applyInlineEnhancements, update sanitizer + theme observer | 🔴 |
| Artifact handler integration | Buttons reopen artifacts, inline toggles wired | Basic reopen support; no inline handling | Sync handler usage, ensure artifact IDs align | 🟡 |
| AIOS settings (`aios.js`) | Identity card, avatars/initials, multi-provider integration states, profile persistence (fs) | Simple Supabase auth forms, limited integration feedback, no avatars | Rebuild UI markup, store profile data via localStorage, add provider state machine & proxy endpoints | 🔴 |
| Welcome display | Initialized on chat load, personalized greeting, reacts to events | Module present but not wired; HTML missing | Add HTML containers, instantiate WelcomeDisplay within chat init | 🟡 |
| Floating window manager | Registers AIOS/context/tasks windows; supports docking/minimize | Module copied but unused | Initialize manager and register windows; ensure responsive hooks | 🟡 |
| Notification service | Rich variants integrated with chat/context/AIOS actions | Service available; limited usage | Ensure notifications triggered for errors, success, retry flows | 🟡 |
| Conversation state manager | Centers floating input, manages transitions | Not included in PWA `js/` | Port module (removing Electron APIs) and initialize | 🔴 |
| Shared CSS | Complete chat styles (`chat-variables`, `chat-layout`, etc.) imported | Files present but imports/order need verification | Confirm imports across HTML, harmonize variables/z-index | 🟡 |
| HTML templates | `chat.html` contains shuffle markup, reasoning blocks, context detail template | Minimal markup; lacks shuffle menu and reasoning elements | Update HTML structure to match desktop layout with aria attributes | 🔴 |
| File attachments | Unified preview handler integrates context chips and history view | Basic preview; historical context view absent | Sync add-files/unified preview enhancements | 🟡 |
| Backend integration | Supabase auth + SocketIO + REST parity validated, Redis-backed session store, sandbox orchestration | Uses Supabase client but lacks proactive refresh/error handling, no Redis awareness | Align session refresh, include backend `status`/`terminate_session` flows, ensure Redis-driven session ids + sandbox feedback surfaced in UI | 🟡 |
| Desktop-only modules | Browser handler, update checker, auth-service (IPC/fs) | Not applicable | Keep excluded; provide web alternatives where necessary | – |

## Additional Notes
- Version skew: Electron app targets `electron@^37.2.6` whereas PWA root uses `electron@^29.4.6`; choose unified runtime before packaging.
- Desktop-specific dependencies (`axios`, `puppeteer-core`) must remain guarded when sharing code.
- Reassess service worker caching strategy after importing larger CSS/JS bundles to avoid storage bloat.
- Backend depends on Redis + Supabase; frontend must bundle access-token refresh + connection status UI to stay compatible with agent streaming stack.
