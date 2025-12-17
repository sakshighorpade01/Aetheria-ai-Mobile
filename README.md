# Aetheria AI (AI-OS)

Aetheria AI is a comprehensive **AI-Operating System (AI-OS)** designed to act as an intelligent, proactive assistant capable of executing complex tasks across web and mobile platforms. It integrates real-time chat, multi-modal capabilities (text, image, audio, video), and autonomous tool usage (browser automation, sandboxed code execution, GitHub integration) into a unified Progressive Web App (PWA) and mobile application.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![JavaScript](https://img.shields.io/badge/javascript-ES6+-yellow.svg)
![Docker](https://img.shields.io/badge/docker-enabled-blue.svg)

---

## 📖 Table of Contents
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Component Breakdown](#-component-breakdown)
- [Execution Flow](#-execution-flow)
- [Prerequisites & Setup](#-prerequisites--setup)
- [Environment Configuration](#-environment-configuration)
- [Running the Application](#-running-the-application)
- [Deployment](#-deployment)
- [Design Principles](#-design-principles)
- [Limitations & Roadmap](#-limitations--roadmap)

---

## 🏗 System Architecture

Aetheria AI utilizes a modern, event-driven microservices architecture anchored by a Flask backend and a lightweight Vanilla JavaScript frontend.

### High-Level Overview
1.  **Frontend (Client)**: A responsive PWA/Mobile app built with Vanilla JS, HTML5, and CSS3. It communicates with the backend via **WebSockets (Socket.IO)** for real-time interaction and **REST APIs** for static data/integrations. Wrapped with **Capacitor** for native Android/iOS deployment.
2.  **Backend (Server)**: A Python Flask application serving as the central orchestrator. It manages authentication, session state, and dispatches AI tasks.
3.  **Task Execution Engine**:
    *   **Agent Runner**: Orchestrates AI agents (powered by **Agno/Phidata**) to plan and execute tasks.
    *   **Celery & Redis**: Handles background task queues and inter-service messaging.
    *   **Sandbox**: An isolated environment (Docker/Google Cloud) where the AI safely executes code.
4.  **Persistence & Auth**: **Supabase** (PostgreSQL) is used for user authentication, database storage (chat history, user context), and file storage.

---

## 🌟 Key Features

*   **Real-Time IA Streaming**: Instant responses streamed token-by-token via Socket.IO.
*   **Multi-Modal Input**: Supports text, voice (audio), images, video, and general file uploads.
*   **Autonomous Tool Use**:
    *   **Web Browsing**: The AI can browse the web to gather info (migrating to server-side Playwright).
    *   **Sandboxed Code Execution**: Safely writes and runs code (Python/Shell) in isolated containers.
    *   **GitHub Integration**: Can read/write to repositories.
    *   **Google Drive/Email**: Access to user documents and mail.
*   **Memory & Context**: Persists user context ("Agno Memories") to provide personalized assistance over time.
*   **Cross-Platform**: Works as a web app, PWA, and native Android/iOS app.

---

## 🧩 Component Breakdown

### 1. Frontend (`/js`, `/css`, `*.html`)
*   **`aios.js`**: Central controller for the UI, handling initialization, theme management, and module coordination.
*   **`socket-service.js`**: Manages the bidirectional WebSocket connection. Handles events like `send_message`, `response`, `agent_step`.
*   **`connection-manager.js`**: Handles session persistence and recovery.
*   **`auth-service.js` & `supabase-client.js`**: Wrappers for Supabase Auth.
*   **Mobile Wrapper**: `@capacitor/*` libraries provide native device bridges.

### 2. Backend (`/python-backend`)
*   **`app.py` & `factory.py`**: Application entry point. Initializes Flask, SocketIO, and extensions (OAuth, Redis).
*   **`sockets.py`**: The WebSocket event gateway. Receives client messages, authenticates users, and spawns agent tasks.
*   **`agent_runner.py`**: The core AI logic. It instantiates the `Team` or `Agent` (using Agno framework), loads tools, and streams the thought process/response back to the client.
*   **`sandbox_tools.py`**: Provides the interface for the AI to execute code in the remote sandbox environment.
*   **`browser_tools.py`**: Server-side browser automation tools.
*   **`celery_app.py`**: Configuration for asynchronous background workers.

### 3. Infrastructure
*   **Redis**: Acts as the message broker for Celery and the Pub/Sub channel for real-time tool outputs (e.g., sending browser data back to the running agent).
*   **Supabase**:
    *   **Auth**: User management (Email/Password, OAuth).
    *   **Database**: Tables for `agno_sessions` (chat history), `user_integrations`, `request_logs`.
    *   **Storage**: Buckets for detailed media uploads.

---

## 🔄 Execution Flow

1.  **User Action**: User types a message or uploads a file in the UI.
2.  **Dispatch**: `aios.js` captures the input and emits a `send_message` event via Socket.IO.
3.  **Reception**: `sockets.py` verifies the JWT token with Supabase and creates a session record.
4.  **Agent Spawn**: An async Greenlet (via `eventlet`) is spawned calling `run_agent_and_stream`.
5.  **Processing**:
    *   `agent_runner.py` initializes the AI Agent with specific tools (Sandbox, Browser, etc.).
    *   The Agent analyzes the request and may decide to call a tool.
    *   **Tool Execution**: If a tool is called (e.g., `execute_python`), the backend contacts the specialized service (e.g., Sandbox Manager) and awaits the result.
6.  **Streaming Response**: The Agent's reasoning and final answer are streamed back to the frontend in chunks via `socketio.emit`.
7.  **Rendering**: The frontend parses the stream; markdown is rendered to HTML, and tool outputs are displayed in the "Agent Activity" logs.

---

## 🛠 Prerequisites & Setup

### Requirements
*   **Python**: 3.11+
*   **Node.js**: 18+ (for frontend tooling/mobile build)
*   **Docker**: For running Redis and local backend services.
*   **Supabase Project**: You need a hosted Supabase project.

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/YourOrg/Aetheria-AI.git
    cd Aetheria-AI
    ```

2.  **Backend Setup**
    ```bash
    cd python-backend
    python -m venv venv
    # Windows
    venv\Scripts\activate
    # Linux/Mac
    source venv/bin/activate
    
    pip install -r requirements.txt
    ```

3.  **frontend Setup**
    ```bash
    npm install
    ```

---

## ⚙ Environment Configuration

Create a `.env` file in `python-backend/`.

**Core Configuration:**
```env
FLASK_SECRET_KEY=your_random_secret_string
# Database & Auth
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Infrastructure
REDIS_URL=redis://localhost:6379/0

# LLM Provider (Example: OpenAI)
OPENAI_API_KEY=sk-...
```

**Tool integrations (Optional but recommended):**
```env
# Sandbox
SANDBOX_API_URL=https://your-sandbox-manager-url

# OAuth Providers
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Browser Automation
HEADLESS=true
```

---

## 🚀 Running the Application

### Local Development (Hybrid)

1.  **Start Redis**:
    ```bash
    docker run -p 6379:6379 redis:7.2-alpine
    ```

2.  **Start Backend**:
    ```bash
    cd python-backend
    # Activate venv first!
    python app.py
    ```
    *Runs on http://localhost:8765*

3.  **Start Frontend**:
    ```bash
    npm start
    ```
    *Runs on http://127.0.0.1:3000*

### Docker (Full Stack)
The project includes a `docker-compose.yml` for orchestrating the Web, Redis, and Flower services.
```bash
docker-compose up --build
```

### Mobile Build (Android)
See `ANDROID_BUILD_GUIDE.md` for detailed instructions.
```bash
npm run cap:sync
npx cap open android
```

---

## ☁ Deployment

*   **Frontend**: Static hosting (Vercel, Netlify, or AWS S3).
*   **Backend**: Container service (Railway, Render, or AWS ECS). Requires persistent connection support (WebSockets).
*   **Sandbox**: Must be deployed on a platform allowing Docker-in-Docker or extensive isolation (e.g., dedicated VM or specialized Google Cloud Run instance).

---

## 🎨 Design Principles
1.  **Aesthetics First**: "Neo-Brutalist" design language — bold geometry, high contrast, and vivid accents to wow users.
2.  **Responsiveness**: Mobile-first approach ensuring seamless experience across all devices.
3.  **Transparency**: All AI actions (tool usage, reasoning) are visible to the user, building trust.

---

## ⚠️ Limitations & Roadmap

### Current Limitations
*   **Sandbox Deployment**: The `sandbox-manager` is a separate, complex component that is not fully containerized in the main `docker-compose` setup due to security requirement (Docker socket access).
*   **Mobile Browser Automation**: Client-side browser automation is limited on mobile; migration to server-side Playwright is in progress.
*   **Single Region**: Currently optimized for a single deployment region; latency may vary globally.

### Future Improvements
*   [ ] Complete server-side browser migration (remove legacy Electron dependencies).
*   [ ] Implement voice output (TTS) for full voice conversation.
*   [ ] Add "Team" agents for parallel task execution.
*   [ ] Offline local-LLM support for edge devices.
