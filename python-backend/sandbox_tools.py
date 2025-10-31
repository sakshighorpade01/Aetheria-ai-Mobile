# python-backend/sandbox_tools.py
import os
import requests
from agno.tools import Toolkit

class SandboxTools(Toolkit):
    def __init__(self):
        super().__init__(
            name="sandbox_tools",
            tools=[self.execute_shell_command]
        )
        self.sandbox_api_url = os.getenv("SANDBOX_API_URL")
        if not self.sandbox_api_url:
            raise ValueError("SANDBOX_API_URL environment variable is not set.")

    def execute_shell_command(self, command: str) -> str:
        """
        Executes a shell command in a secure, isolated sandbox environment.
        Use this for all shell operations like 'ls', 'cat', 'git clone', or running scripts.
        
        Args:
            command: The shell command to execute.

        Returns:
            A string containing the stdout and stderr from the command execution.
        """
        api_endpoint = f"{self.sandbox_api_url}/execute"
        payload = {"command": command}

        try:
            response = requests.post(api_endpoint, json=payload, timeout=70) # Timeout > sandbox timeout
            response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)
            
            data = response.json()
            
            output = ""
            if data.get("stdout"):
                output += f"STDOUT:\n{data['stdout']}\n"
            if data.get("stderr"):
                output += f"STDERR:\n{data['stderr']}\n"
            
            output += f"Exit Code: {data['exit_code']}"
            return output

        except requests.RequestException as e:
            return f"Error communicating with the sandbox service: {e}"