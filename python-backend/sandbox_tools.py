# python-backend/sandbox_tools.py (Complete, Updated Version)

import os
import requests
from agno.tools import Toolkit
from typing import Optional, Set, Dict, Any
import logging

logger = logging.getLogger(__name__)

class SandboxTools(Toolkit):
    """
    A state-aware toolkit for interacting with an isolated sandbox environment.
    It ensures one sandbox is created and reused per session.
    """
    def __init__(self, session_info: Dict[str, Any]):
        """
        Initializes the SandboxTools with session-specific information.
        Args:
            session_info (Dict[str, Any]): The dictionary for the current user session.
                                           It must contain 'sandbox_ids' and can contain 'active_sandbox_id'.
        """
        super().__init__(
            name="sandbox_tools",
            # --- CHANGE: The agent now only sees one tool, which simplifies its logic. ---
            tools=[self.execute_in_sandbox]
        )
        self.session_info = session_info
        self.sandbox_api_url = os.getenv("SANDBOX_API_URL")
        if not self.sandbox_api_url:
            raise ValueError("SANDBOX_API_URL environment variable is not set.")

    def _create_or_get_sandbox_id(self) -> Optional[str]:
        """
        Internal helper function. Creates a new sandbox if one doesn't exist for this session,
        otherwise returns the ID of the existing sandbox.
        Returns the unique sandbox_id string or None if creation fails.
        """
        active_id = self.session_info.get("active_sandbox_id")
        if active_id:
            logger.info(f"Reusing existing sandbox for session: {active_id}")
            return active_id

        logger.info("No active sandbox found for session, creating a new one.")
        try:
            response = requests.post(f"{self.sandbox_api_url}/sessions", timeout=30)
            response.raise_for_status()
            data = response.json()
            new_sandbox_id = data.get("sandbox_id")

            if new_sandbox_id:
                self.session_info["active_sandbox_id"] = new_sandbox_id
                # This correctly handles the list from Redis session data.
                if "sandbox_ids" not in self.session_info:
                    self.session_info["sandbox_ids"] = []
                if new_sandbox_id not in self.session_info["sandbox_ids"]:
                    self.session_info["sandbox_ids"].append(new_sandbox_id)
                
                logger.info(f"Created and stored new sandbox ID: {new_sandbox_id}")
                return new_sandbox_id
            else:
                logger.error("Sandbox service did not return a valid ID.")
                return None

        except requests.RequestException as e:
            logger.error(f"Failed to create sandbox: {e}", exc_info=True)
            return None

    def execute_in_sandbox(self, command: str) -> str:
        """
        Executes a shell command inside an isolated sandbox environment.
        If a sandbox for the current session does not exist, it will be created automatically.
        Args:
            command (str): The shell command to execute (e.g., 'ls -la', 'git clone ...').
        """
        # --- CHANGE: Implicitly create sandbox if it doesn't exist ---
        sandbox_id = self._create_or_get_sandbox_id()
        if not sandbox_id:
            return "Error: Failed to create or retrieve the sandbox session. Cannot execute command."
        
        try:
            response = requests.post(
                f"{self.sandbox_api_url}/sessions/{sandbox_id}/exec",
                json={"command": command},
                timeout=310
            )
            response.raise_for_status()
            data = response.json()
            
            output = ""
            if data.get("stdout"):
                output += f"STDOUT:\n{data['stdout']}\n"
            if data.get("stderr"):
                output += f"STDERR:\n{data['stderr']}\n"
            
            if data.get("exit_code", 0) != 0:
                output += f"Exit Code: {data['exit_code']}"

            return output if output else "Command executed successfully with no output."
            
        except requests.RequestException as e:
            logger.error(f"Failed to execute command in sandbox {sandbox_id}: {e}", exc_info=True)
            return f"Error executing command: {e}"