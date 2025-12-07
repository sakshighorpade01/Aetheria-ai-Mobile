# AI-OS: Complete Docker Backend Configuration

This document explains how to run the AI-OS Python backend in Docker containers across different deployment scenarios: local development, Docker Compose orchestration, and cloud deployments (Railway/Render).

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Main Backend Dockerfile](#main-backend-dockerfile)
4. [Sandbox Manager Dockerfile](#sandbox-manager-dockerfile)
5. [Sandbox Execution Dockerfile](#sandbox-execution-dockerfile)
6. [Docker Compose Setup](#docker-compose-setup)
7. [Local Development](#local-development)
8. [Cloud Deployment Configuration](#cloud-deployment-configuration)
9. [Environment Variables](#environment-variables)
10. [File Mounting for Multimodal Inputs](#file-mounting-for-multimodal-inputs)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) installed and running
- Docker Compose (included with Docker Desktop)
- Node.js and npm for the Electron app
- Git (for cloning repositories in deployment)

---

## Project Structure

```
AI-OS/
├── Dockerfile                    # Main backend service
├── Dockerfile.manager            # Sandbox manager service
├── Dockerfile.sandbox            # Sandbox execution environment
├── docker-compose.yml            # Local orchestration
├── render.yaml                   # Render.com deployment config
├── python-backend/
│   ├── app.py                   # Main Flask/SocketIO application
│   ├── celery_app.py            # Centralized Celery configuration
│   ├── requirements.txt         # Python dependencies
│   └── .env                     # Environment variables (not in git)
└── sandbox_manager/
    ├── main.py                  # FastAPI sandbox manager
    └── requirements.txt         # Sandbox manager dependencies
```

---

## Main Backend Dockerfile

**File:** `Dockerfile`

This is the primary backend service running Flask, SocketIO, and Celery workers.

```dockerfile
FROM python:3.11-slim-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    python3-dev \
    libffi-dev \
    libssl-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY python-backend/requirements.txt . 

RUN pip install --no-cache-dir -r requirements.txt

COPY python-backend/ . 

EXPOSE 8765

ENV PYTHONUNBUFFERED=1

# Railway will set PORT dynamically (usually 8000-9000 range)
# Gunicorn binds to 0.0.0.0:$PORT which Railway provides
# For local development, PORT defaults to 8765
CMD ["sh", "-c", "gunicorn --worker-class eventlet -w 1 --timeout 300 --keep-alive 65 --bind 0.0.0.0:${PORT:-8765} app:app"]
```

### Key Features:
- **Base Image:** Python 3.11 slim (Debian Bookworm)
- **Build Tools:** Includes gcc, g++, and development headers for compiling Python packages
- **Working Directory:** `/app`
- **Port:** 8765 (default), or dynamically set via `$PORT` environment variable
- **Server:** Gunicorn with eventlet worker for WebSocket support
- **Configuration:**
  - 1 worker (`-w 1`) for WebSocket compatibility
  - 300-second timeout for long-running operations
  - 65-second keep-alive for persistent connections

### Building the Image:

```bash
docker build -t aios-backend -f Dockerfile .
```

### Running Standalone:

```bash
docker run -d -p 8765:8765 --name aios-backend aios-backend
```

---

## Sandbox Manager Dockerfile

**File:** `Dockerfile.manager`

This service manages Docker sandboxes for secure code execution.

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy only the requirements for this specific service
COPY ./sandbox_manager/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the source code for this specific service
COPY ./sandbox_manager/ .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Key Features:
- **Base Image:** Python 3.11 slim
- **Framework:** FastAPI with Uvicorn
- **Port:** 8000
- **Purpose:** Creates and manages isolated Docker containers for running user code
- **Security:** Requires Docker socket access (`/var/run/docker.sock`)

### Building the Image:

```bash
docker build -t aios-sandbox-manager -f Dockerfile.manager .
```

### Running with Docker Socket:

```bash
docker run -d \
  -p 8000:8000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --name aios-sandbox-manager \
  aios-sandbox-manager
```

**⚠️ Important:** This service requires Docker socket access, which is not available on Railway. Deploy this separately on Google Cloud, AWS EC2, or another platform that supports Docker-in-Docker.

---

## Sandbox Execution Dockerfile

**File:** `Dockerfile.sandbox`

This defines the isolated environment where user code executes.

```dockerfile
FROM ubuntu:22.04

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Update and install common tools needed by the agent
# git is needed for 'git clone', curl for downloading files, etc.
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security.
# Running code as root inside a container is a major security risk.
RUN useradd -m -s /bin/bash sandboxuser

# Switch to the non-root user
USER sandboxuser
WORKDIR /home/sandboxuser

# Final check
CMD ["/bin/bash"]
```

### Key Features:
- **Base Image:** Ubuntu 22.04 for broad compatibility
- **Tools Included:**
  - Python 3.11
  - Git (for cloning repositories)
  - curl (for downloading files)
  - build-essential (for compiling code)
- **Security:** Runs as non-root user `sandboxuser`
- **Purpose:** Provides a clean, isolated environment for each code execution

### Building the Image:

```bash
docker build -t aios-sandbox -f Dockerfile.sandbox .
```

This image is spawned dynamically by the sandbox manager and is not run directly.

---

## Docker Compose Setup

**File:** `docker-compose.yml`

For local development, use Docker Compose to orchestrate all services.

```yaml
version: '3.8'

services:
  redis:
    image: "redis:7.2-alpine"
    container_name: aios-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: aios-web
    ports:
      - "8765:8765"
    env_file:
      - ./python-backend/.env
    volumes:
      - ./python-backend:/app
    depends_on:
      - redis

  flower:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: aios-flower
    # The -A flag now targets the centralized Celery app defined in `celery_app.py`.
    command: ["celery", "-A", "celery_app:celery_app", "flower"]
    ports:
      - "5555:5555"
    env_file:
      - ./python-backend/.env
    depends_on:
      - redis
      - web

  # sandbox-manager is deployed separately on Google Cloud
  # It requires Docker socket access which Railway doesn't support
  # SANDBOX_API_URL in .env points to the Google Cloud instance

volumes:
  redis_data:
```

### Services:

1. **redis**: Message broker for Celery tasks
   - Port: 6379
   - Persistent storage via named volume

2. **web**: Main backend application
   - Port: 8765
   - Hot-reload via volume mount
   - Loads environment from `.env`

3. **flower**: Celery monitoring dashboard
   - Port: 5555
   - Monitors task queue and workers

### Starting All Services:

```bash
docker-compose up -d
```

### Viewing Logs:

```bash
docker-compose logs -f web
docker-compose logs -f flower
```

### Stopping Services:

```bash
docker-compose down
```

### Rebuilding After Code Changes:

```bash
docker-compose up -d --build
```

---

## Local Development

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/GodBoii/AI-OS.git
   cd AI-OS
   ```

2. **Create `.env` file in `python-backend/`:**
   ```env
   OPENAI_API_KEY=sk-...
   GROQ_API_KEY=...
   REDIS_URL=redis://redis:6379/0
   SANDBOX_API_URL=http://your-sandbox-manager:8000
   ```

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

4. **Run Electron app:**
   ```bash
   npm install
   npm start
   ```

### Verifying the Container is Running

Check if containers are running:

```bash
docker ps
```

You should see containers for `aios-redis`, `aios-web`, and `aios-flower`.

Check logs:

```bash
docker logs aios-web
```

Expected output:
```
[2025-05-29 21:52:06 +0000] [1] [INFO] Starting gunicorn 23.0.0
[2025-05-29 21:52:06 +0000] [1] [INFO] Listening at: http://0.0.0.0:8765 (1)
[2025-05-29 21:52:06 +0000] [1] [INFO] Using worker: eventlet
[2025-05-29 21:52:06 +0000] [7] [INFO] Booting worker with pid: 7
```

### Managing Individual Containers

**Stopping:**
```bash
docker stop aios-web
```

**Starting:**
```bash
docker start aios-web
```

**Removing:**
```bash
docker stop aios-web
docker rm aios-web
```

---

## Cloud Deployment Configuration

### Render.com Deployment

**File:** `render.yaml`

```yaml
services:
  - type: redis
    name: aios-redis
    plan: free
    ipAllowList: []

  - type: web
    name: aios-web
    plan: free
    runtime: docker
    repo: https://github.com/GodBoii/AI-OS
    branch: master
    dockerfilePath: ./Dockerfile
    dockerContext: .
    dockerCommand: 'gunicorn --worker-class eventlet -w 1 --timeout 300 --keep-alive 65 --bind 0.0.0.0:$PORT app:app'
    envVars:
      - fromGroup: aios-secrets
      - key: REDIS_URL
        fromService:
          type: redis
          name: aios-redis
          property: connectionString

  - type: web
    name: aios-flower
    plan: free
    runtime: docker
    repo: https://github.com/GodBoii/AI-OS
    branch: master
    dockerfilePath: ./Dockerfile
    dockerContext: .
    dockerCommand: "celery -A celery_app:celery_app flower --broker=$REDIS_URL"
    envVars:
      - fromGroup: aios-secrets
      - key: REDIS_URL
        fromService:
          type: redis
          name: aios-redis
          property: connectionString
```

### Key Configuration Notes:

1. **Redis Connection:** Automatically injected via `fromService` property
2. **Port Binding:** Render sets `$PORT` dynamically; Gunicorn binds to it
3. **Secrets:** Store API keys in Render's environment groups (`aios-secrets`)
4. **Celery Command Order:** Global flags (`-A`, `--broker`) must come BEFORE the `flower` subcommand

### Deploying to Render:

1. Push code to GitHub
2. Connect repository in Render dashboard
3. Render auto-detects `render.yaml`
4. Add secrets to environment group `aios-secrets`
5. Deploy

### Railway Deployment

Railway uses the same `Dockerfile` but with different environment variable injection:

1. Create new project in Railway
2. Connect GitHub repository
3. Railway auto-detects Dockerfile
4. Add environment variables in Railway dashboard:
   - `OPENAI_API_KEY`
   - `GROQ_API_KEY`
   - `REDIS_URL`
   - `SANDBOX_API_URL`
5. Deploy

---

## Environment Variables

Create a `.env` file in the `python-backend/` directory:

```env
# LLM API Keys
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...

# Redis (for local development)
REDIS_URL=redis://redis:6379/0

# Sandbox Manager (deployed separately)
SANDBOX_API_URL=https://your-sandbox-manager.cloud.run

# Optional: Other providers
GEMINI_API_KEY=...
PERPLEXITY_API_KEY=...
```

### Loading Environment Variables

The backend uses `python-dotenv` to load these automatically:

```python
from dotenv import load_dotenv
import os

load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')
```

### Security Best Practices:

- **Never commit `.env` to git** (add to `.gitignore`)
- Use Docker secrets or environment groups in production
- Rotate keys regularly
- Use separate keys for development and production

---

## File Mounting for Multimodal Inputs

**Critical for multimodal support (images, audio, video, PDFs):**

The Electron frontend passes file paths to the backend. The Docker container must have access to these files.

### Volume Mounting

Mount the host's user directories into the container:

**Windows Example:**
```bash
docker run -d \
  -p 8765:8765 \
  -v C:/Users/youruser/Downloads:/host_downloads \
  -v C:/Users/youruser/Documents:/host_documents \
  --name aios-backend \
  aios-backend
```

**Linux/Mac Example:**
```bash
docker run -d \
  -p 8765:8765 \
  -v ~/Downloads:/host_downloads \
  -v ~/Documents:/host_documents \
  --name aios-backend \
  aios-backend
```

### Docker Compose Volume Mounting

Add volumes to `docker-compose.yml`:

```yaml
services:
  web:
    volumes:
      - ./python-backend:/app
      - ~/Downloads:/host_downloads
      - ~/Documents:/host_documents
```

### Path Normalization

The frontend must rewrite host paths to container paths:

**Frontend (JavaScript):**
```javascript
function normalizePathForContainer(hostPath) {
  // Windows: C:/Users/name/Downloads/file.jpg -> /host_downloads/file.jpg
  // Linux: /home/name/Downloads/file.jpg -> /host_downloads/file.jpg
  
  if (hostPath.includes('Downloads')) {
    return hostPath.replace(/.*Downloads[\/\\]/, '/host_downloads/');
  }
  if (hostPath.includes('Documents')) {
    return hostPath.replace(/.*Documents[\/\\]/, '/host_documents/');
  }
  return hostPath;
}
```

**Backend (Python):**
```python
def resolve_file_path(path):
    """Ensure the path exists inside the container."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"File does not exist: {path}")
    return path
```

---

## Troubleshooting

### 1. Connection Issues

**Symptom:** Electron app can't connect to Docker container

**Solutions:**
- Verify container is running: `docker ps`
- Check port mapping: `-p 8765:8765`
- Verify firewall isn't blocking port 8765
- Check logs: `docker logs aios-web`
- Try connecting to `http://localhost:8765` in browser

### 2. Python Import Errors

**Symptom:** `ModuleNotFoundError` in logs

**Solutions:**
- Update `requirements.txt` with missing packages
- Rebuild image: `docker-compose up -d --build`
- Verify pip install succeeded: `docker logs aios-web | grep "Successfully installed"`

### 3. Multimodal File Access Issues

**Symptom:** "File does not exist" errors when processing images/audio

**Solutions:**
- Verify volume mount: `docker inspect aios-web | grep Mounts`
- Check path inside container: `docker exec aios-web ls /host_downloads`
- Verify path normalization in frontend and backend
- Use absolute paths, not relative
- On Windows, always use forward slashes in Docker mounts

**Debug Commands:**
```bash
# List files in mounted directory
docker exec aios-web ls -la /host_downloads

# Check if specific file exists
docker exec aios-web test -f /host_downloads/image.jpg && echo "Found" || echo "Not found"

# View backend logs for path errors
docker logs aios-web | grep "File does not exist"
```

### 4. Redis Connection Errors

**Symptom:** Celery tasks fail or don't start

**Solutions:**
- Verify Redis is running: `docker ps | grep redis`
- Check Redis URL: `docker exec aios-web env | grep REDIS_URL`
- Test connection: `docker exec aios-web redis-cli -u $REDIS_URL ping`
- Ensure Redis started before web service: use `depends_on` in docker-compose

### 5. Gunicorn Worker Timeout

**Symptom:** "Worker timeout" errors in logs

**Solutions:**
- Increase timeout in `CMD`: `--timeout 600`
- Use eventlet worker: `--worker-class eventlet`
- Ensure only 1 worker for WebSocket: `-w 1`

### 6. Celery Flower Can't Start

**Symptom:** `celery: error: unrecognized arguments: flower`

**Solution:**
- Correct command order: `celery -A celery_app:celery_app flower`
- NOT: `celery flower -A celery_app:celery_app`

### 7. Environment Variables Not Loaded

**Symptom:** "API key not found" errors

**Solutions:**
- Verify `.env` file exists in correct location
- Check file is loaded: `docker exec aios-web env | grep OPENAI_API_KEY`
- Ensure `env_file` specified in docker-compose.yml
- Use absolute paths for env_file

### 8. Docker Build Failures

**Symptom:** Build fails during `pip install`

**Solutions:**
- Clear Docker cache: `docker builder prune`
- Update base image: Change `python:3.11-slim-bookworm` to latest
- Add build tools if needed: `gcc`, `g++`, `python3-dev`
- Check requirements.txt for incompatible versions

### 9. Port Already in Use

**Symptom:** "Address already in use" when starting container

**Solutions:**
```bash
# Find what's using port 8765
lsof -i :8765  # Mac/Linux
netstat -ano | findstr :8765  # Windows

# Kill the process or change the port
docker run -p 8766:8765 ...
```

### 10. Context Synchronization Issues

**Note:** The `context_manager.py` script runs locally in the Electron app, not in Docker. This is by design to handle local file access.

---

## Persisting Data

To persist data between container restarts:

```bash
docker run -d \
  -p 8765:8765 \
  -v $(pwd)/tmp:/app/tmp \
  -v $(pwd)/logs:/app/logs \
  --name aios-backend \
  aios-backend
```

Or in docker-compose.yml:

```yaml
services:
  web:
    volumes:
      - ./tmp:/app/tmp
      - ./logs:/app/logs
```

---

## Additional Resources

- **Main README:** Project overview and setup instructions
- **Dockerfile Comments:** Inline documentation for build steps
- **Render Documentation:** https://render.com/docs/docker
- **Railway Documentation:** https://docs.railway.app/deploy/dockerfiles
- **Docker Best Practices:** https://docs.docker.com/develop/dev-best-practices/

---

## Quick Reference

### Essential Commands

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Restart a service
docker-compose restart web

# Execute command in container
docker exec -it aios-web bash

# View resource usage
docker stats

# Clean up unused resources
docker system prune -a
```

### Port Reference

- **8765**: Main backend (Flask/SocketIO)
- **8000**: Sandbox manager (FastAPI)
- **6379**: Redis
- **5555**: Flower (Celery monitoring)

---

**Last Updated:** November 2025