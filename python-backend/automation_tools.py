#python-backend/automation_tools.py
from typing import Optional, List, Union, Dict
import time
import os
from phi.tools import Toolkit
from phi.utils.log import logger


class AutomationTools(Toolkit):
    def __init__(self):
        super().__init__(name="automation_tools")
        # Register all the tool functions
        self.register(self.move_mouse)
        self.register(self.click_mouse)
        self.register(self.right_click)
        self.register(self.double_click)
        self.register(self.scroll)
        self.register(self.type_text)
        self.register(self.press_key)
        self.register(self.press_hotkey)
        self.register(self.press_function_key)
        self.register(self.press_windows_key)
        self.register(self.press_mac_key)
        self.register(self.press_multimedia_key)
        self.register(self.press_common_shortcut)
        self.register(self.get_screen_size)
        self.register(self.get_mouse_position)
        self.register(self.screenshot)
        self.register(self.find_on_screen)
        self.register(self.pause)
        self.register(self.key_down)
        self.register(self.key_up)
        self.register(self.screenshot_and_analyze)


    def move_mouse(self, x: int, y: int, duration: float = 0.5) -> str:
        """Moves the mouse cursor to the specified x,y coordinates.

        Args:
            x (int): The x-coordinate (horizontal position) to move to.
            y (int): The y-coordinate (vertical position) to move to.
            duration (float): Time in seconds for the movement to complete (smoother with higher values).

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            pyautogui.moveTo(x, y, duration=duration)
            return f"Mouse moved to position ({x}, {y})"
        except Exception as e:
            logger.warning(f"Failed to move mouse: {e}")
            return f"Error moving mouse: {e}"

    def click_mouse(self, x: Optional[int] = None, y: Optional[int] = None) -> str:
        """Performs a left mouse click at the current position or specified coordinates.

        Args:
            x (int, optional): The x-coordinate to click at. If None, uses current position.
            y (int, optional): The y-coordinate to click at. If None, uses current position.

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            if x is not None and y is not None:
                pyautogui.click(x, y)
                return f"Clicked at position ({x}, {y})"
            else:
                pyautogui.click()
                position = pyautogui.position()
                return f"Clicked at current position ({position.x}, {position.y})"
        except Exception as e:
            logger.warning(f"Failed to click mouse: {e}")
            return f"Error clicking mouse: {e}"

    def right_click(self, x: Optional[int] = None, y: Optional[int] = None) -> str:
        """Performs a right mouse click at the current position or specified coordinates.

        Args:
            x (int, optional): The x-coordinate to right-click at. If None, uses current position.
            y (int, optional): The y-coordinate to right-click at. If None, uses current position.

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            if x is not None and y is not None:
                pyautogui.rightClick(x, y)
                return f"Right-clicked at position ({x}, {y})"
            else:
                pyautogui.rightClick()
                position = pyautogui.position()
                return f"Right-clicked at current position ({position.x}, {position.y})"
        except Exception as e:
            logger.warning(f"Failed to right-click: {e}")
            return f"Error right-clicking: {e}"

    def double_click(self, x: Optional[int] = None, y: Optional[int] = None) -> str:
        """Performs a double mouse click at the current position or specified coordinates.

        Args:
            x (int, optional): The x-coordinate to double-click at. If None, uses current position.
            y (int, optional): The y-coordinate to double-click at. If None, uses current position.

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            if x is not None and y is not None:
                pyautogui.doubleClick(x, y)
                return f"Double-clicked at position ({x}, {y})"
            else:
                pyautogui.doubleClick()
                position = pyautogui.position()
                return f"Double-clicked at current position ({position.x}, {position.y})"
        except Exception as e:
            logger.warning(f"Failed to double-click: {e}")
            return f"Error double-clicking: {e}"

    def scroll(self, clicks: int) -> str:
        """Scrolls the mouse wheel.

        Args:
            clicks (int): The number of "clicks" to scroll. Positive values scroll up, negative values scroll down.

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            pyautogui.scroll(clicks)
            direction = "up" if clicks > 0 else "down"
            return f"Scrolled {abs(clicks)} clicks {direction}"
        except Exception as e:
            logger.warning(f"Failed to scroll: {e}")
            return f"Error scrolling: {e}"

    def type_text(self, text: str, interval: float = 0.01) -> str:
        """Types the specified text with an optional interval between keypresses.

        Args:
            text (str): The text to type.
            interval (float): Time in seconds between each keypress (for more human-like typing).

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            pyautogui.write(text, interval=interval)
            return f"Typed text: '{text}'"
        except Exception as e:
            logger.warning(f"Failed to type text: {e}")
            return f"Error typing text: {e}"

    def press_key(self, key: str) -> str:
        """Presses a single key on the keyboard.

        Args:
            key (str): The key to press (e.g., 'enter', 'tab', 'a', '1').

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            pyautogui.press(key)
            return f"Pressed key: '{key}'"
        except Exception as e:
            logger.warning(f"Failed to press key: {e}")
            return f"Error pressing key: {e}"

    def press_hotkey(self, *keys: str) -> str:
        """Presses a combination of keys simultaneously (hotkey).

        Args:
            *keys (str): The keys to press together (e.g., 'ctrl', 'c' for copy).

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            pyautogui.hotkey(*keys)
            return f"Pressed hotkey: {' + '.join(keys)}"
        except Exception as e:
            logger.warning(f"Failed to press hotkey: {e}")
            return f"Error pressing hotkey: {e}"

    def press_function_key(self, f_key: int) -> str:
        """Presses a function key (F1-F12).

        Args:
            f_key (int): The function key number (1-12).

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            if 1 <= f_key <= 12:
                key = f'f{f_key}'
                pyautogui.press(key)
                return f"Pressed function key: {key.upper()}"
            else:
                return f"Error: Invalid function key number. Must be between 1 and 12."
        except Exception as e:
            logger.warning(f"Failed to press function key: {e}")
            return f"Error pressing function key: {e}"

    def press_windows_key(self, combination: Optional[str] = None) -> str:
        """Presses the Windows key alone or in combination with another key.

        Args:
            combination (str, optional): Another key to press with the Windows key (e.g., 'e' for Explorer).

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            import platform

            # Use 'win' on Windows and 'command' on Mac
            win_key = 'win' if platform.system() == 'Windows' else 'command'

            if combination:
                pyautogui.hotkey(win_key, combination)
                return f"Pressed Windows+{combination}"
            else:
                pyautogui.press(win_key)
                return f"Pressed Windows key"
        except Exception as e:
            logger.warning(f"Failed to press Windows key: {e}")
            return f"Error pressing Windows key: {e}"

    def press_mac_key(self, key: str, *modifiers: str) -> str:
        """Presses a Mac-specific key combination.

        Args:
            key (str): The main key to press.
            *modifiers (str): Modifier keys like 'command', 'option', 'shift', 'control'.

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            import platform

            if platform.system() != 'Darwin':
                return "Warning: This function is designed for macOS but executed on another operating system"

            # Add the key at the end of modifiers
            keys = list(modifiers) + [key]
            pyautogui.hotkey(*keys)

            return f"Pressed Mac key combination: {' + '.join(keys)}"
        except Exception as e:
            logger.warning(f"Failed to press Mac key combination: {e}")
            return f"Error pressing Mac key combination: {e}"

    def press_multimedia_key(self, key: str) -> str:
        """Presses a multimedia key.

        Args:
            key (str): The multimedia key to press. Options include:
                 'volumeup', 'volumedown', 'volumemute',
                 'playpause', 'prevtrack', 'nexttrack',
                 'browserhome', 'browserback', 'browserforward', 'browsersearch',
                 'launchmail', 'launchcalc'

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui

            valid_keys = [
                'volumeup', 'volumedown', 'volumemute',
                'playpause', 'prevtrack', 'nexttrack',
                'browserhome', 'browserback', 'browserforward', 'browsersearch',
                'launchmail', 'launchcalc'
            ]

            if key not in valid_keys:
                return f"Error: Invalid multimedia key. Valid options are: {', '.join(valid_keys)}"

            pyautogui.press(key)
            return f"Pressed multimedia key: {key}"
        except Exception as e:
            logger.warning(f"Failed to press multimedia key: {e}")
            return f"Error pressing multimedia key: {e}"

    def press_common_shortcut(self, shortcut_name: str) -> str:
        """Presses a common keyboard shortcut by name.

        Args:
            shortcut_name (str): Name of the shortcut to execute. Options include:
                'copy', 'paste', 'cut', 'select_all', 'save', 'save_as', 'open',
                'new', 'close', 'print', 'undo', 'redo', 'find', 'help',
                'refresh', 'lock_screen', 'switch_app', 'screenshot',
                'task_manager' (Windows), 'force_quit' (Mac)

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            import platform

            # Define OS-specific key mappings
            is_mac = platform.system() == 'Darwin'
            ctrl_key = 'command' if is_mac else 'ctrl'
            alt_key = 'option' if is_mac else 'alt'

            # Define common shortcuts with OS-specific variations
            shortcuts = {
                'copy': (ctrl_key, 'c'),
                'paste': (ctrl_key, 'v'),
                'cut': (ctrl_key, 'x'),
                'select_all': (ctrl_key, 'a'),
                'save': (ctrl_key, 's'),
                'save_as': (ctrl_key, 'shift', 's'),
                'open': (ctrl_key, 'o'),
                'new': (ctrl_key, 'n'),
                'close': (ctrl_key, 'w'),
                'print': (ctrl_key, 'p'),
                'undo': (ctrl_key, 'z'),
                'redo': (ctrl_key, 'shift', 'z') if is_mac else (ctrl_key, 'y'),
                'find': (ctrl_key, 'f'),
                'help': ('f1',),
                'refresh': ('f5',) if not is_mac else (ctrl_key, 'r'),
                'lock_screen': ('win', 'l') if not is_mac else ('command', 'control', 'q'),
                'switch_app': (alt_key, 'tab'),
                'screenshot': ('win', 'shift', 's') if not is_mac else ('command', 'shift', '3'),
                'task_manager': ('ctrl', 'shift', 'esc') if not is_mac else None,
                'force_quit': (None) if not is_mac else ('command', 'option', 'esc')
            }

            if shortcut_name not in shortcuts:
                return f"Error: Unknown shortcut name. Valid options are: {', '.join(shortcuts.keys())}"

            shortcut = shortcuts[shortcut_name]
            if shortcut is None:
                return f"Error: The '{shortcut_name}' shortcut is not available on this operating system"

            pyautogui.hotkey(*shortcut)
            return f"Executed {shortcut_name} shortcut: {' + '.join(shortcut)}"
        except Exception as e:
            logger.warning(f"Failed to execute shortcut: {e}")
            return f"Error executing shortcut: {e}"

    def key_down(self, key: str) -> str:
        """Holds down a key.

        Args:
            key (str): The key to hold down.

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            pyautogui.keyDown(key)
            return f"Holding down key: {key}"
        except Exception as e:
            logger.warning(f"Failed to hold down key: {e}")
            return f"Error holding down key: {e}"

    def key_up(self, key: str) -> str:
        """Releases a key that was held down.

        Args:
            key (str): The key to release.

        Returns:
            str: Confirmation message.
        """
        try:
            import pyautogui
            pyautogui.keyUp(key)
            return f"Released key: {key}"
        except Exception as e:
            logger.warning(f"Failed to release key: {e}")
            return f"Error releasing key: {e}"

    def get_screen_size(self) -> str:
        """Gets the current screen resolution.

        Returns:
            str: Screen width and height.
        """
        try:
            import pyautogui
            width, height = pyautogui.size()
            return f"Screen size: {width}x{height} pixels"
        except Exception as e:
            logger.warning(f"Failed to get screen size: {e}")
            return f"Error getting screen size: {e}"

    def get_mouse_position(self) -> str:
        """Gets the current position of the mouse cursor.

        Returns:
            str: Current x,y coordinates of the mouse.
        """
        try:
            import pyautogui
            position = pyautogui.position()
            return f"Mouse position: ({position.x}, {position.y})"
        except Exception as e:
            logger.warning(f"Failed to get mouse position: {e}")
            return f"Error getting mouse position: {e}"

    def screenshot(self, filename: Optional[str] = None, region: Optional[List[int]] = None) -> str:
        """Takes a screenshot of the entire screen or a specific region.

        Args:
            filename (str, optional): Filename to save the screenshot. If None, doesn't save to file.
            region (List[int], optional): Region to capture as [left, top, width, height]. If None, captures entire screen.

        Returns:
            str: Path to saved screenshot or confirmation message.
        """
        try:
            import pyautogui
            import os
            from datetime import datetime

            if filename is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"screenshot_{timestamp}.png"

            if not filename.endswith('.png'):
                filename += '.png'

            if region is not None:
                screenshot = pyautogui.screenshot(region=tuple(region))
            else:
                screenshot = pyautogui.screenshot()

            screenshot.save(filename)

            abs_path = os.path.abspath(filename)
            return f"Screenshot saved to {abs_path}"
        except Exception as e:
            logger.warning(f"Failed to take screenshot: {e}")
            return f"Error taking screenshot: {e}"

    def find_on_screen(self, image_path: str, confidence: float = 0.9) -> str:
        """Finds the position of an image on the screen.

        Args:
            image_path (str): Path to the image file to find on screen.
            confidence (float): Confidence threshold for the match (0-1).

        Returns:
            str: Position of the image if found, or error message.
        """
        try:
            import pyautogui
            import os

            if not os.path.exists(image_path):
                return f"Error: Image file not found at {image_path}"

            location = pyautogui.locateOnScreen(image_path, confidence=confidence)

            if location is None:
                return "Image not found on screen"

            center = pyautogui.center(location)
            return f"Image found at position: ({center.x}, {center.y})"
        except Exception as e:
            logger.warning(f"Failed to find image on screen: {e}")
            return f"Error finding image on screen: {e}"

    def pause(self, seconds: float) -> str:
        """Pauses execution for the specified number of seconds.

        Args:
            seconds (float): Number of seconds to pause.

        Returns:
            str: Confirmation message.
        """
        try:
            time.sleep(seconds)
            return f"Paused for {seconds} seconds"
        except Exception as e:
            logger.warning(f"Failed to pause: {e}")
            return f"Error pausing: {e}"

    def screenshot_and_analyze(self, filename: Optional[str] = None, region: Optional[List[int]] = None) -> str:
        """Takes a screenshot and returns the ABSOLUTE path.  This is key!

        Args:
            filename (str, optional):  If None, uses a timestamp.
            region (List[int], optional): [left, top, width, height].  If None, full screen.

        Returns:
            str:  ABSOLUTE path to the saved screenshot.  Or an error message.
        """
        try:
            import pyautogui
            import os
            from datetime import datetime

            if filename is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"screenshot_{timestamp}.png"

            if not filename.endswith('.png'):
                filename += '.png'

            if region is not None:
                screenshot = pyautogui.screenshot(region=tuple(region))
            else:
                screenshot = pyautogui.screenshot()

            screenshot.save(filename)
            abs_path = os.path.abspath(filename)  # Get the absolute path
            return abs_path  # Return the absolute path
        except Exception as e:
            logger.warning(f"Failed to take screenshot: {e}")
            return f"Error taking screenshot: {e}"