# sandbox_manager/main.py
import os
import docker
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

# --- Pydantic Models for API Data Validation ---
class ExecutionRequest(BaseModel):
    command: str = Field(..., description="The shell command to execute in the sandbox.")
    timeout: int = Field(60, description="Timeout in seconds for the command execution.")

class ExecutionResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int

# --- FastAPI Application ---
app = FastAPI()
# Initialize Docker client from the environment
# This will connect to the Docker daemon on the host machine
try:
    docker_client = docker.from_env()
except docker.errors.DockerException as e:
    # This will fail if the Docker daemon is not running or accessible
    print(f"FATAL: Could not connect to Docker daemon. {e}")
    docker_client = None

# --- API Endpoints ---
@app.get("/health")
def health_check():
    """Simple health check to ensure the service is running."""
    return {"status": "ok"}

@app.post("/execute", response_model=ExecutionResponse)
def execute_command(request: ExecutionRequest):
    """
    Executes a command in a new, isolated Docker container.
    """
    if not docker_client:
        raise HTTPException(status_code=500, detail="Docker client is not available.")

    # The name of the sandbox image you pushed to Docker Hub
    # IMPORTANT: Store this in an environment variable in production
    sandbox_image = os.getenv("SANDBOX_IMAGE", "your-dockerhub-username/sandbox-image:latest")

    try:
        # Run the command in a new container.
        # This is a blocking call that waits for the container to finish.
        container = docker_client.containers.run(
            image=sandbox_image,
            command=f"/bin/bash -c '{request.command}'",
            detach=False,  # Run in the foreground and wait for completion
            remove=True,   # Automatically remove the container when it exits
            # --- SECURITY: Resource Limits ---
            mem_limit="256m",       # Max memory the container can use
            cpu_shares=512,         # Relative CPU weight (default is 1024)
            network_disabled=True,  # Disable networking for untrusted code
        )

        # The result is returned as bytes, so we decode it
        stdout = container.decode('utf-8')
        stderr = "" # Stderr is captured by the exception below if command fails
        exit_code = 0

    except docker.errors.ContainerError as e:
        # This error is raised if the command in the container exits with a non-zero status
        stdout = e.container.logs(stdout=True).decode('utf-8')
        stderr = e.container.logs(stderr=True).decode('utf-8')
        exit_code = e.exit_status
    
    except docker.errors.ImageNotFound:
        raise HTTPException(status_code=500, detail=f"Sandbox image '{sandbox_image}' not found.")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

    return ExecutionResponse(stdout=stdout, stderr=stderr, exit_code=exit_code)