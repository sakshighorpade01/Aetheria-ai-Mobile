# AI-OS: Docker Backend Configuration

This document explains how to run the AI-OS Python backend in a Docker container and connect the Electron frontend to it.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) installed and running
- Node.js and npm for the Electron app

## Building the Docker Image

1. Navigate to the project root directory
2. Build the Docker image:

```bash
docker build -t aios-backend -f Dockerfile .
```

## Running the Docker Container

Start the container with the following command:

```bash
docker run -d -p 8765:8765 --name my-aios-container aios-backend
```

This will:
- Run the container in detached mode (`-d`)
- Map the container's port 8765 to the host's port 8765 (`-p 8765:8765`)
- Name the container "my-aios-container" for easy reference

## Verifying the Container is Running

Check if the container is running:

```bash
docker ps
```

You should see your container in the list. If not, check the logs:

```bash
docker logs my-aios-container
```

You should see output similar to:
```
[2025-05-29 21:52:06 +0000] [1] [INFO] Starting gunicorn 23.0.0
[2025-05-29 21:52:06 +0000] [1] [INFO] Listening at: http://0.0.0.0:8765 (1)
[2025-05-29 21:52:06 +0000] [1] [INFO] Using worker: eventlet
[2025-05-29 21:52:06 +0000] [7] [INFO] Booting worker with pid: 7
```

## Running the Electron Application

With the Docker container running, start the Electron application:

```bash
npm start
```

The Electron app has been modified to connect to the Docker container automatically.

## Managing the Docker Container

### Stopping the Container

```bash
docker stop my-aios-container
```

### Starting an Existing Container

```bash
docker start my-aios-container
```

### Removing the Container

```bash
docker stop my-aios-container
docker rm my-aios-container
```

### Rebuilding After Code Changes

If you make changes to the Python backend code, you need to rebuild the Docker image and restart the container:

```bash
docker stop my-aios-container
docker rm my-aios-container
docker build -t aios-backend -f Dockerfile .
docker run -d -p 8765:8765 --name my-aios-container aios-backend
```

## Persisting Data (Optional)

To persist data between container restarts, you can mount volumes. For example, to persist the tmp directory:

```bash
docker run -d -p 8765:8765 -v $(pwd)/tmp:/app/tmp --name my-aios-container aios-backend
```

## Troubleshooting

1. **Connection Issues**: If the Electron app can't connect to the Docker container, make sure port 8765 is accessible and not blocked by a firewall.

2. **Python Import Errors**: If you see import errors in the Docker logs, you may need to update requirements.txt or install additional dependencies in the Dockerfile.

3. **Context Synchronization**: The context_manager.py script still runs locally in the Electron app, not in the Docker container. This is by design to handle local file access. 

---

## 1. Dockerfile and Image Build

- The backend is run in a Docker container using a `Dockerfile` in the project root.
- The Docker image installs all Python dependencies from `requirements.txt`.
- The container exposes the backend on port 8765 by default.

**Example Dockerfile excerpt:**
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8765
CMD ["python", "python-backend/app.py"]
```

---

## 2. Environment Variables

- Set API keys and other secrets in a `.env` file in the project root.
- Example:
  ```env
  OPENAI_API_KEY=sk-...
  GROQ_API_KEY=...
  # Add any other required keys
  ```
- The backend loads these automatically using `python-dotenv`.

---

## 3. File Mounting for Multimodal Inputs

**Critical for multimodal support:**
- The Electron frontend passes file paths (e.g., for images, audio, video, PDFs) to the backend.
- The backend container must have access to the same file paths as the host system.
- **Mount the host's user files directory into the container** using Docker's `-v` flag.

**Example (Windows):**
```sh
docker run -it --rm -p 8765:8765 -v C:/Users/youruser/Downloads:/host_downloads ai-os-image
```
- In the app, ensure file paths are referenced as `/host_downloads/filename.ext` inside the container.
- You may need to adjust the frontend to rewrite Windows paths to the mounted path inside the container.

---

## 4. Troubleshooting Multimodal File Access

- If the LLM says it cannot find a file, check:
  - The file path sent from the frontend matches the mounted path in the container.
  - The file exists inside the container at the expected location (`docker exec -it <container> ls /host_downloads`).
  - The backend logs for path normalization and file existence checks.
- For Windows, always use forward slashes in Docker volume mounts and inside the container.
- If you see errors like `File does not exist at path: ...`, check the path mapping and normalization logic in `app.py`.

---

## 5. Best Practices

- Always mount user-accessible directories (Downloads, Documents, etc.) into the container if you want to process files from those locations.
- Use absolute paths in the frontend and rewrite them as needed for the container's mount points.
- Keep your `.env` file out of version control (`.gitignore`) and use Docker secrets for production.
- For debugging, use `docker exec -it <container> bash` to inspect files and logs inside the running container.

---

## 6. Example Docker Compose (Optional)

If you want to use Docker Compose for easier management:

```yaml
version: '3.8'
services:
  ai-os-backend:
    build: .
    ports:
      - "8765:8765"
    env_file:
      - .env
    volumes:
      - C:/Users/youruser/Downloads:/host_downloads
```

---

## 7. Additional Notes

- If you update the backend code, rebuild the Docker image: `docker build -t ai-os-image .`
- If you change the requirements, rebuild the image as well.
- For persistent storage (e.g., session logs), mount a host directory to `/app/tmp` or similar.

---

**For more details, see the main README and comments in the Dockerfile.** 