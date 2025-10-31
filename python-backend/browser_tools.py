import asyncio
import json
import logging
from typing import Any, Dict, Optional

from agno.tools import Toolkit
from agno.tools.mcp import MCPTools

# Configure a logger for this toolkit to aid in debugging.
logger = logging.getLogger(__name__)

class BrowserTools(Toolkit):
    """
    A state-aware toolkit that provides interactive web browsing capabilities to an agent.

    This toolkit acts as a client to the Browser-Use MCP (Model Context Protocol) server.
    It starts and manages a local instance of the Browser-Use server and wraps its
    core functions (navigate, click, type) to automatically provide a screenshot and
    the page's current state after every action. This ensures that agents always have
    up-to-date visual context for their next decision.
    """

    def __init__(self, **kwargs: Any):
        """
        Initializes the BrowserTools toolkit.

        This sets up the connection to the Browser-Use MCP server, which is launched
        as a local subprocess. The tools exposed to the agent are the public wrapper
        methods defined in this class.
        """
        # The tools list registers the public methods of this class as available
        # tools for any agent that uses this toolkit.
        super().__init__(
            name="interactive_browser",
            tools=[
                self.navigate,
                self.click,
                self.type,
                self.get_current_state,
            ],
            **kwargs,
        )

        # Instantiate the MCPTools client from Agno.
        # The `command` argument tells MCPTools to start the Browser-Use server
        # as a subprocess and communicate with it over stdio. This is the most
        # efficient method for locally managed tools.
        # The lifecycle of this subprocess is automatically managed by MCPTools.
        self.mcp_tools = MCPTools(command="uvx browser-use --mcp")
        logger.info("BrowserTools initialized, ready to launch MCP server on first use.")

    async def _execute_and_get_state(
        self, action_tool: str, action_params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        A private helper method that executes a browser action and immediately
        fetches the new state of the page, including a screenshot.

        Args:
            action_tool: The name of the MCP tool to execute (e.g., 'browser_navigate').
            action_params: A dictionary of parameters for the action tool.

        Returns:
            A dictionary containing the result of the action and the new state of the browser.
        """
        try:
            # 1. Execute the primary action (e.g., click a button).
            logger.info(f"Executing browser action: {action_tool} with params: {action_params}")
            action_result = await self.mcp_tools.run_tool(action_tool, **action_params)
            logger.info(f"Action '{action_tool}' completed. Result: {action_result}")

            # 2. Immediately fetch the new state of the browser.
            return await self.get_current_state(action_summary=str(action_result))

        except Exception as e:
            logger.error(f"An error occurred during browser action '{action_tool}': {e}", exc_info=True)
            return {"error": f"Failed to execute {action_tool}: {e}"}

    async def get_current_state(self, action_summary: Optional[str] = None) -> Dict[str, Any]:
        """
        Gets the current state of the browser page, including the URL, title,
        interactive elements, and a Base64-encoded screenshot. This tool is essential
        for an agent to "see" the page before deciding on its next action.

        Args:
            action_summary: An optional summary of the last action taken, to be included in the output.

        Returns:
            A dictionary containing the full state of the current browser page.
        """
        logger.info("Fetching current browser state with screenshot.")
        try:
            # The `browser_get_state` tool from the Browser-Use MCP server is called.
            # `include_screenshot=True` is critical for our visual feedback loop.
            state_json_str = await self.mcp_tools.run_tool(
                "browser_get_state", include_screenshot=True
            )

            # The result is a JSON string, so we must parse it.
            state_data = json.loads(state_json_str)

            # Structure the output for clarity and consistency.
            # This dictionary is what the agent will receive as the tool's output.
            # The frontend will later extract the 'screenshot_base64' key for display.
            output = {
                "summary": action_summary or "Successfully retrieved browser state.",
                "url": state_data.get("url"),
                "title": state_data.get("title"),
                "interactive_elements": state_data.get("interactive_elements", []),
                "screenshot_base64": state_data.get("screenshot"),
            }
            logger.info(f"Successfully fetched browser state for URL: {output['url']}")
            return output

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from browser_get_state: {e}")
            return {"error": "Failed to parse state from browser. The response was not valid JSON."}
        except Exception as e:
            logger.error(f"An error occurred while getting browser state: {e}", exc_info=True)
            return {"error": f"An unexpected error occurred: {e}"}

    async def navigate(self, url: str) -> Dict[str, Any]:
        """
        Navigates the browser to a specific URL.

        Args:
            url: The fully qualified URL to navigate to (e.g., 'https://www.google.com').

        Returns:
            The new state of the browser after the page has loaded.
        """
        return await self._execute_and_get_state(
            "browser_navigate", {"url": url}
        )

    async def click(self, element_index: int, description: str) -> Dict[str, Any]:
        """
        Clicks on an interactive element on the current page.

        Args:
            element_index: The numeric index of the element to click, obtained from
                           the 'interactive_elements' list provided by a previous state.
            description: A brief description of the element being clicked (e.g.,
                         'the search button' or 'the link to the contact page').
                         This is for the agent's reasoning clarity and is not used by the tool.

        Returns:
            The new state of the browser after the click action has completed.
        """
        return await self._execute_and_get_state(
            "browser_click", {"index": element_index}
        )

    async def type(self, element_index: int, text: str, description: str) -> Dict[str, Any]:
        """
        Types text into an input field on the current page.

        Args:
            element_index: The numeric index of the input field, obtained from
                           the 'interactive_elements' list.
            text: The text to type into the field.
            description: A brief description of the input field (e.g., 'the username field').
                         This is for the agent's reasoning clarity.

        Returns:
            The new state of the browser after the text has been entered.
        """
        return await self._execute_and_get_state(
            "browser_type", {"index": element_index, "text": text}
        )


# This block allows for standalone testing of the toolkit.
# You can run `python -m browser_tools` from your terminal to test it.
if __name__ == "__main__":

    async def main():
        print("--- Testing BrowserTools Toolkit ---")
        browser = BrowserTools()

        try:
            # Test 1: Navigate to a website
            print("\n1. Navigating to duckduckgo.com...")
            state = await browser.navigate("https://www.duckduckgo.com")
            if "error" in state:
                print(f"Error: {state['error']}")
                return
            print(f"   - Success! Current URL: {state.get('url')}")
            print(f"   - Screenshot captured: {'Yes' if state.get('screenshot_base64') else 'No'}")
            print(f"   - Found {len(state.get('interactive_elements', []))} interactive elements.")

            # Test 2: Find the search bar and type into it
            search_bar = next(
                (el for el in state["interactive_elements"] if el.get("aria-label") == "Search input"),
                None,
            )
            if not search_bar:
                print("\nCould not find the search bar. Exiting.")
                return

            print("\n2. Typing 'Agno Framework' into the search bar...")
            search_bar_index = search_bar["index"]
            state = await browser.type(
                search_bar_index, "Agno Framework", "The main search input"
            )
            if "error" in state:
                print(f"Error: {state['error']}")
                return
            print(f"   - Success! Current URL: {state.get('url')}")
            print(f"   - Screenshot captured: {'Yes' if state.get('screenshot_base64') else 'No'}")

            # Test 3: Find the search button and click it
            search_button = next(
                (el for el in state["interactive_elements"] if el.get("aria-label") == "Search button"),
                None,
            )
            if not search_button:
                print("\nCould not find the search button. Exiting.")
                return

            print("\n3. Clicking the search button...")
            search_button_index = search_button["index"]
            state = await browser.click(search_button_index, "The search button")
            if "error" in state:
                print(f"Error: {state['error']}")
                return
            print(f"   - Success! Now on results page: {state.get('url')}")
            print(f"   - Screenshot captured: {'Yes' if state.get('screenshot_base64') else 'No'}")
            print(f"   - Found {len(state.get('interactive_elements', []))} interactive elements on the results page.")

        finally:
            # Gracefully close the MCP server process
            if hasattr(browser.mcp_tools, "close"):
                print("\n--- Shutting down MCP server ---")
                await browser.mcp_tools.close()
                print("--- Test complete ---")

    # Run the async main function
    asyncio.run(main())