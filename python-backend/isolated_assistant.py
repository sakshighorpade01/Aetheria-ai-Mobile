# isolated_assistant.py
from concurrent.futures import ThreadPoolExecutor
import threading
from queue import Queue
import traceback

class IsolatedAssistant:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.response_queue = Queue()
        
    def run_safely(self, agent, message):
        """Runs agent in isolated thread and handles crashes"""
        try:
            # Run agent in separate thread
            future = self.executor.submit(agent.run, message, stream=True)
            
            # Stream responses while running
            for chunk in future.result():
                if chunk and chunk.content:
                    yield {"content": chunk.content, "streaming": True}
                    
            yield {"content": "", "done": True}
            
        except Exception as e:
            # Capture crash but keep connection alive
            error_msg = f"Tool error: {str(e)}\n{traceback.format_exc()}"
            yield {"content": error_msg, "error": True, "done": True}
            
            # Recreate agent's tools
            agent._reinitialize_tools()

    def terminate(self):
        self.executor.shutdown(wait=False)