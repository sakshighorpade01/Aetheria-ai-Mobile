import logging
from typing import List, Optional, Dict, Any, Union, Callable

from agno.tools import Toolkit, tool
from agno.utils.log import logger

class LocalExecutionTools(Toolkit):
    """
    Toolkit for executing commands on the user's local machine.
    
    This toolkit doesn't execute commands directly but instead generates
    structured requests that are sent to the frontend for local execution.
    """
    
    def __init__(self, **kwargs):
        # Initialize the toolkit with the tools
        tools = [
            self.run_local_shell_command,
            self.run_local_python_script
        ]
        super().__init__(
            name="local_execution_tools",
            tools=tools,
            **kwargs
        )
        logger.info("LocalExecutionTools initialized")
    
    def run_local_shell_command(self, args: List[str], tail: int = 100) -> Dict[str, Any]:
        """
        Runs a shell command on the user's local machine and returns the output.
        
        This command will be executed on the user's local machine directly.
        
        Args:
            args (List[str]): The command to run as a list of strings.
            tail (int): The number of lines to return from the output.
            
        Returns:
            Dict[str, Any]: The structured request for local execution.
        """
        # This function doesn't actually execute anything
        # It returns a structured request that will be intercepted by the server
        # and forwarded to the frontend for execution
        logger.info(f"Generated local shell command request: {args}")
        
        # The actual execution will happen in the frontend
        # This return value will be replaced with the actual command output
        return {
            "type": "local_execution_request",
            "tool": "shell",
            "command": args,
            "tail": tail,
            "message": "This command will be executed on the user's local machine."
        }
    
    def run_local_python_script(self, code: str, filename: str = "script.py", args: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Runs a Python script on the user's local machine and returns the output.
        
        This script will be executed on the user's local machine directly.
        
        Args:
            code (str): The Python code to execute.
            filename (str): The filename to save the script as.
            args (Optional[List[str]]): Optional arguments to pass to the script.
            
        Returns:
            Dict[str, Any]: The structured request for local execution.
        """
        # This function doesn't actually execute anything
        # It returns a structured request that will be intercepted by the server
        # and forwarded to the frontend for execution
        logger.info(f"Generated local Python script request: {filename}")
        
        # The actual execution will happen in the frontend
        # This return value will be replaced with the actual script output
        return {
            "type": "local_execution_request",
            "tool": "python",
            "code": code,
            "filename": filename,
            "args": args or [],
            "message": "This Python script will be executed on the user's local machine."
        } 