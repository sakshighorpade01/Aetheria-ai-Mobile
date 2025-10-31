from browser_use import Agent, Browser, BrowserConfig
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
import json
import sys
import asyncio
import os
import logging
import time
import io
from urllib.parse import urlparse

# Custom stdout filter to ensure only valid JSON goes to stdout
class JsonOnlyStream(io.TextIOBase):
    def __init__(self, original_stdout):
        self.original_stdout = original_stdout
        
    def write(self, text):
        # Only write to stdout if it appears to be JSON (starts with '{')
        if text.strip().startswith('{'):
            return self.original_stdout.write(text)
        # Otherwise, redirect to stderr
        return sys.stderr.write(text)
        
    def flush(self):
        self.original_stdout.flush()
        sys.stderr.flush()

# Replace stdout with filtered version before anything else
original_stdout = sys.stdout
sys.stdout = JsonOnlyStream(original_stdout)

load_dotenv()

# Configure logger to explicitly use stderr for all logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler(sys.stderr)
handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Remove root logger handlers to prevent double logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                   stream=sys.stderr)  # Force all logs to stderr

# Also silence browser_use internal loggers that might bypass our configuration
for module in ['browser_use', 'playwright', 'urllib3', 'asyncio']:
    module_logger = logging.getLogger(module)
    module_logger.handlers = []
    module_logger.addHandler(handler)
    module_logger.propagate = False

class BrowserAgent:
    """
    A custom agent that uses browser_use to interact with web pages within
    an existing browser instance (provided via a CDP URL).
    """

    def __init__(self):
        """
        Initialize the BrowserAgent using CDP URL from environment
        """
        try:
            # Get CDP URL and target ID from environment (passed by Electron)
            cdp_url = os.environ.get('CDP_URL')
            target_id = os.environ.get('TARGET_ID')
            initial_url = os.environ.get('INITIAL_URL', 'https://www.google.com')
            
            self._write_output({"type": "status", "content": "Initializing browser agent..."})
            
            if cdp_url:
                # Connect to existing webview using CDP
                logger.info(f"Connecting to existing browser via CDP: {cdp_url}")
                if target_id:
                    logger.info(f"With target ID: {target_id}")
                
                # First try to verify if the CDP endpoint is actually responsive
                self._write_output({"type": "status", "content": f"Validating CDP endpoint at {cdp_url}..."})
                
                # Wait for CDP endpoint to be ready
                if not self._validate_cdp_endpoint(cdp_url):
                    logger.warning("CDP validation failed, attempting connection anyway")
                    self._write_output({"type": "status", "content": "CDP validation failed, attempting connection anyway"})
                
                # Attempt several approaches to ensure we connect only to the BrowserView
                try:
                    # Extract domain from initial URL to restrict navigation
                    parsed_url = urlparse(initial_url)
                    allowed_domain = parsed_url.netloc
                    if allowed_domain:
                        logger.info(f"Restricting navigation to domain: {allowed_domain}")
                    
                    # Create a BrowserContext config that restricts to current domain
                    from browser_use.browser.context import BrowserContextConfig
                    context_config = BrowserContextConfig(
                        # This ensures the agent can only interact with the intended website
                        allowed_domains=[allowed_domain] if allowed_domain else None,
                        # Wait longer for network to settle to ensure complete page loading
                        wait_for_network_idle_page_load_time=3.0,
                        # Don't auto-expand viewport beyond what's visible
                        viewport_expansion=0 
                    )
                    
                    # Configure browser_use with target ID if available
                    extra_args = []
                    if target_id:
                        extra_args.append(f"--target={target_id}")
                    
                    config = BrowserConfig(
                        cdp_url=cdp_url,
                        headless=False,
                        disable_security=True,
                        extra_chromium_args=extra_args,
                        new_context_config=context_config  # Apply the context config
                    )
                    
                    self._write_output({"type": "status", "content": "Connecting with domain restriction..."})
                    self.browser = Browser(config=config)
                    logger.info("Connected to browser via CDP with domain restriction")
                except Exception as browser_error:
                    logger.error(f"Failed to connect via CDP with domain restriction: {str(browser_error)}")
                    self._write_output({"type": "error", "error": f"CDP connection failed: {str(browser_error)}"})
                    
                    # Try one more time with a simpler approach
                    try:
                        logger.info("Trying fallback connection approach")
                        self._write_output({"type": "status", "content": "Trying fallback connection..."})
                        
                        config = BrowserConfig(
                            cdp_url=cdp_url,
                            headless=False,
                            disable_security=True
                        )
                        self.browser = Browser(config=config)
                        logger.info("Connected to browser via fallback CDP method")
                    except Exception as fallback_error:
                        # Fallback to launching a new browser
                        logger.error(f"Failed fallback CDP connection: {str(fallback_error)}")
                        logger.info("Falling back to launching a new browser instance")
                        self._write_output({"type": "status", "content": "Launching a new browser as last resort"})
                        config = BrowserConfig(headless=False)
                        self.browser = Browser(config=config)
            else:
                # Fallback to launching a new browser if no CDP URL
                logger.info("No CDP URL provided, launching new browser")
                config = BrowserConfig(headless=False)
                self.browser = Browser(config=config)
            
            # Initialize with appropriate model
            try:
                self.agent = Agent(
                    browser=self.browser,
                    task="search youtube for the latest news",
                    llm=ChatGoogleGenerativeAI(model="gemini-2.0-flash"),
                    use_vision=True,
                    max_failures=3,
                    retry_delay=5
                )
            except Exception as model_error:
                # Fallback to an alternate model if needed
                logger.warning(f"Failed to use gemini-2.0-flash: {model_error}. Trying alternative model.")
                self.agent = Agent(
                    browser=self.browser,
                    task="search youtube for the latest news",
                    llm=ChatGoogleGenerativeAI(model="gemini-2.0-flash"),
                    use_vision=True,
                    max_failures=3,
                    retry_delay=5
                )
            
            logger.info("BrowserAgent initialized successfully")
            self._write_output({"type": "status", "content": "Browser agent ready"})
            
        except Exception as e:
            error_msg = f"Failed to initialize BrowserAgent: {str(e)}"
            logger.error(error_msg)
            self._write_error(error_msg)
            raise

    def _validate_cdp_endpoint(self, cdp_url, max_attempts=3, timeout=3):
        """
        Validate that the CDP endpoint is accessible and responsive.
        Returns True if valid, False otherwise.
        """
        for attempt in range(1, max_attempts + 1):
            try:
                import requests
                version_url = f"{cdp_url}/json/version"
                logger.info(f"Checking CDP endpoint (attempt {attempt}/{max_attempts}): {version_url}")
                
                response = requests.get(version_url, timeout=timeout)
                
                if response.status_code == 200:
                    logger.info(f"CDP endpoint is valid: {response.json()}")
                    return True
                else:
                    logger.warning(f"CDP endpoint returned status {response.status_code}")
            except Exception as e:
                logger.warning(f"Failed to validate CDP endpoint: {str(e)}")
            
            if attempt < max_attempts:
                time.sleep(1)
                
        return False

    def _write_output(self, data):
        """Write JSON-formatted output to stdout"""
        try:
            json_str = json.dumps(data)
            # Write directly to original stdout to bypass our filter
            original_stdout.write(json_str + "\n")
            original_stdout.flush()
        except Exception as e:
            logger.error(f"Error writing output: {str(e)}")
            # Don't try to write this error to stdout as it might cause more issues

    def _write_error(self, error_msg):
        """Write error message to stdout"""
        self._write_output({"type": "error", "error": error_msg})

    async def handle_message(self, message: str):
        """Handle incoming message and return response"""
        try:
            # Set the agent's task
            self.agent.task = message
            self._write_output({"type": "status", "content": f"Processing task: {message}"})
            
            # Capture all actions during the agent's run
            try:
                history = await self.agent.run()
                
                # Process and send results
                for action in history.model_actions():
                    # Handle navigation actions
                    if 'go_to_url' in action:
                        self._write_output({
                            "type": "navigation",
                            "url": action['go_to_url']['url']
                        })
                    elif 'url' in action:  # Handle both formats
                        self._write_output({
                            "type": "navigation",
                            "url": action['url']
                        })
                    
                    # Handle interaction actions
                    if 'interacted_element' in action:
                        self._write_output({
                            "type": "interaction",
                            "element": str(action['interacted_element'])
                        })
                
                # Send final result
                final_result = history.final_result()
                if final_result:
                    self._write_output({
                        "type": "result",
                        "content": final_result
                    })
                else:
                    self._write_output({
                        "type": "result", 
                        "content": "Task completed, but no final result was provided."
                    })
            except Exception as run_error:
                logger.error(f"Error running agent: {str(run_error)}", exc_info=True)
                self._write_error(f"Error executing browser task: {str(run_error)}")

        except Exception as e:
            logger.error(f"Error processing message: {str(e)}", exc_info=True)
            self._write_error(f"Error processing message: {str(e)}")

    async def close(self):
        """
        Cleanup resources when done.
        """
        try:
            if self.browser:
                await self.browser.close()
                logger.info("Browser resources cleaned up")
        except Exception as e:
            logger.error(f"Error closing browser: {str(e)}")

async def main():
    logger.info("Starting browser agent")
    agent = None
    
    # Send startup message as valid JSON
    original_stdout.write(json.dumps({"type": "status", "content": "Browser agent starting"}) + "\n")
    original_stdout.flush()
    
    try:
        agent = BrowserAgent()
        
        # Read messages from stdin
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    logger.info("End of input stream, exiting")
                    break
                    
                logger.info(f"Received line from stdin: {line.strip()}")
                
                try:
                    message = json.loads(line)
                    if message.get("type") == "task":
                        await agent.handle_message(message["content"])
                    elif message.get("type") == "ping":
                        # Add support for checking if agent is alive
                        original_stdout.write(json.dumps({"type": "pong"}) + "\n")
                        original_stdout.flush()
                    elif message.get("type") == "shutdown":
                        # Handle clean shutdown
                        logger.info("Received shutdown command")
                        break
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON: {line.strip()} - {str(e)}")
                    if agent:
                        agent._write_error(f"Invalid JSON: {str(e)}")
                
            except Exception as e:
                logger.error(f"Error reading input: {str(e)}", exc_info=True)
                if agent:
                    agent._write_error(f"Error reading input: {str(e)}")
    
    finally:
        if agent:
            await agent.close()
            logger.info("Browser agent closed")
        
        # Send shutdown message as valid JSON
        original_stdout.write(json.dumps({"type": "status", "content": "Browser agent shutdown"}) + "\n")
        original_stdout.flush()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        # Log any unhandled exceptions to stderr
        sys.stderr.write(f"CRITICAL ERROR: {str(e)}\n")
        sys.stderr.flush()
        # Try to send a final error message through stdout
        try:
            original_stdout.write(json.dumps({"type": "error", "error": f"Critical error: {str(e)}"}) + "\n")
            original_stdout.flush()
        except:
            pass
        sys.exit(1)