# python-backend/browser_tools.py (Updated for Redis Pub/Sub)

import logging
import uuid
import json
from typing import Dict, Any, Literal, Union

from redis import Redis

from agno.media import Image
from agno.tools import Toolkit
from agno.tools.function import ToolResult
from supabase_client import supabase_client

BROWSER_COMMAND_TIMEOUT_SECONDS = 120

logger = logging.getLogger(__name__)

class BrowserTools(Toolkit):
    """
    A scalable, distributed toolkit that acts as a server-side proxy for
    controlling a client-side browser. It uses Redis Pub/Sub for asynchronous
    request/response handling, making it safe for multi-worker environments.
    """

    def __init__(self, sid: str, socketio, redis_client: Redis, **kwargs):
        """
        Initializes the BrowserTools toolkit.

        Args:
            sid (str): The unique Socket.IO session ID for the connected client.
            socketio: The main Flask-SocketIO server instance.
            redis_client (Redis): An initialized Redis client for Pub/Sub.
        """
        self.sid = sid
        self.socketio = socketio
        self.redis_client = redis_client

        super().__init__(
            name="browser_tools",
            tools=[
                self.get_status, self.navigate, self.get_current_view,
                self.click, self.type_text, self.scroll, self.go_back,
                self.go_forward, self.list_tabs, self.open_new_tab,
                self.switch_to_tab, self.close_tab, self.hover_over_element,
                self.select_dropdown_option, self.handle_alert, self.press_key,
                self.extract_text_from_element, self.get_element_attributes,
                self.extract_table_data, self.refresh_page,
                self.wait_for_element, self.manage_cookies,
            ],
        )

    def _process_view_result(self, result: Dict[str, Any]) -> ToolResult:
        if result.get("status") == "success" and "screenshot_path" in result:
            screenshot_path = result.pop("screenshot_path")
            try:
                image_bytes = supabase_client.storage.from_('media-uploads').download(screenshot_path)
                image_artifact = Image(content=image_bytes)
                return ToolResult(content=json.dumps(result), images=[image_artifact])
            except Exception as e:
                logger.error(f"Supabase screenshot download failed: {e}")
                result["error"] = f"Error: Could not retrieve screenshot from path {screenshot_path}."
                return ToolResult(content=json.dumps(result))
        
        return ToolResult(content=json.dumps(result))

    def _send_command_and_wait(self, command_payload: Dict[str, Any]) -> Union[Dict[str, Any], ToolResult]:
        """
        Sends a command to the client via SocketIO and waits for the response
        on a unique Redis Pub/Sub channel. This is a non-blocking, scalable pattern.
        """
        request_id = str(uuid.uuid4())
        command_payload['request_id'] = request_id
        
        response_channel = f"browser-response:{request_id}"
        pubsub = self.redis_client.pubsub()
        
        try:
            pubsub.subscribe(response_channel)
            
            # 1. Send the command to the client
            self.socketio.emit('browser-command', command_payload, room=self.sid)

            # 2. Wait for a message on the subscribed channel
            for message in pubsub.listen():
                if message['type'] == 'message':
                    result = json.loads(message['data'])
                    
                    if "screenshot_path" in result:
                        return self._process_view_result(result)
                    
                    return ToolResult(content=json.dumps(result))

        except Exception as e:
            logger.error(f"Browser command error: {e}")
            return {"status": "error", "error": f"An internal error occurred while waiting for the browser: {e}"}
        finally:
            # 3. Always clean up the subscription
            pubsub.unsubscribe(response_channel)
            pubsub.close()

    # --- Public Tool Methods ---
    # The function signatures remain the same. Their implementation via
    # _send_command_and_wait is now scalable.
    
    def get_status(self) -> Dict[str, Any]:
        return self._send_command_and_wait({'action': 'status'})

    def navigate(self, url: str) -> Union[Dict[str, Any], ToolResult]:
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
        return self._send_command_and_wait({'action': 'navigate', 'url': url})

    def get_current_view(self) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'get_view'})

    def click(self, element_id: int, description: str) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'click', 'element_id': element_id})

    def type_text(self, element_id: int, text: str, description: str) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'type', 'element_id': element_id, 'text': text})

    def scroll(self, direction: Literal['up', 'down']) -> Union[Dict[str, Any], ToolResult]:
        if direction not in ['up', 'down']:
            return {"status": "error", "error": "Invalid scroll direction. Must be 'up' or 'down'."}
        return self._send_command_and_wait({'action': 'scroll', 'direction': direction})

    # ... (The rest of the tool methods: go_back, go_forward, etc., are unchanged) ...
    def go_back(self) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'go_back'})

    def go_forward(self) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'go_forward'})

    def list_tabs(self) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'list_tabs'})

    def open_new_tab(self, url: str) -> Union[Dict[str, Any], ToolResult]:
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
        return self._send_command_and_wait({'action': 'open_new_tab', 'url': url})

    def switch_to_tab(self, tab_index: int) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'switch_to_tab', 'tab_index': tab_index})

    def close_tab(self, tab_index: int) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'close_tab', 'tab_index': tab_index})

    def hover_over_element(self, element_id: int) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'hover', 'element_id': element_id})

    def select_dropdown_option(self, element_id: int, value: str) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'select_option', 'element_id': element_id, 'value': value})

    def handle_alert(self, action: Literal['accept', 'dismiss']) -> Dict[str, Any]:
        if action not in ['accept', 'dismiss']:
            return {"status": "error", "error": "Invalid alert action. Must be 'accept' or 'dismiss'."}
        return self._send_command_and_wait({'action': 'handle_alert', 'alert_action': action})

    def press_key(self, key: str) -> Union[Dict[str, Any], ToolResult]:
        allowed_keys = {'Enter', 'Escape', 'Tab', 'ArrowDown', 'ArrowUp'}
        if key not in allowed_keys:
            return {"status": "error", "error": f"Invalid key. Allowed keys are: {', '.join(allowed_keys)}"}
        return self._send_command_and_wait({'action': 'press_key', 'key': key})

    def extract_text_from_element(self, element_id: int) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'extract_text', 'element_id': element_id})

    def get_element_attributes(self, element_id: int) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'get_attributes', 'element_id': element_id})

    def extract_table_data(self, element_id: int) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'extract_table', 'element_id': element_id})

    def refresh_page(self) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'refresh'})

    def wait_for_element(self, selector: str, timeout: int = 10) -> Union[Dict[str, Any], ToolResult]:
        return self._send_command_and_wait({'action': 'wait_for_element', 'selector': selector, 'timeout': timeout})

    def manage_cookies(self, action: Literal['accept_all', 'clear_all']) -> Union[Dict[str, Any], ToolResult]:
        if action not in ['accept_all', 'clear_all']:
            return {"status": "error", "error": "Invalid cookie action. Must be 'accept_all' or 'clear_all'."}
        return self._send_command_and_wait({'action': 'manage_cookies', 'cookie_action': action})