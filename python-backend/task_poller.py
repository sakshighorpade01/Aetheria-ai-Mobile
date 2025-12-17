# python-backend/task_poller.py
"""
Background Task Polling Service
Checks for pending tasks every 60 seconds and triggers autonomous execution
"""

import logging
import time
import threading
from typing import List, Dict, Any
from supabase_client import supabase_client
from task_executor import run_autonomous_task

logger = logging.getLogger(__name__)


class TaskPoller:
    """
    Background service that polls for pending tasks and executes them autonomously.
    """
    
    def __init__(self, poll_interval: int = 60):
        """
        Initialize the task poller.
        
        Args:
            poll_interval: Seconds between each poll (default: 43200 = 12 hours)
        """
        self.poll_interval = poll_interval
        self.running = False
        self.thread = None
        self.processing_tasks = set()  # Track tasks currently being processed
        
    def start(self):
        """Start the background polling thread."""
        if self.running:
            logger.warning("Task poller already running")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._poll_loop, daemon=True)
        self.thread.start()
        logger.info(f"Task poller started (interval: {self.poll_interval}s)")
    
    def stop(self):
        """Stop the background polling thread."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("Task poller stopped")
    
    def _poll_loop(self):
        """Main polling loop that runs in background thread."""
        logger.info("🔄 Task poller loop started")
        while self.running:
            try:
                logger.debug(f"🔍 Scanning for pending tasks...")
                self._check_and_execute_pending_tasks()
            except Exception as e:
                logger.error(f"❌ Error in task polling loop: {e}")
            
            # Sleep for poll interval
            logger.debug(f"💤 Sleeping for {self.poll_interval} seconds")
            time.sleep(self.poll_interval)
    
    def _check_and_execute_pending_tasks(self):
        """
        Query database for pending tasks and execute them.
        Only processes tasks that aren't already being processed.
        """
        try:
            # Query for pending tasks
            logger.debug("📊 Querying database for pending tasks...")
            response = supabase_client.table("tasks").select("id, user_id, text, description, priority, deadline, tags").eq("status", "pending").execute()
            
            if not response.data:
                logger.debug("✅ No pending tasks found")
                return
            
            pending_tasks = response.data
            logger.info(f"📋 Found {len(pending_tasks)} pending task(s)")
            
            for task in pending_tasks:
                task_id = task['id']
                user_id = task['user_id']
                task_title = task['text']
                
                # Skip if already processing
                if task_id in self.processing_tasks:
                    logger.debug(f"⏭️  Task {task_id} already being processed, skipping")
                    continue
                
                # Mark as processing
                self.processing_tasks.add(task_id)
                logger.info(f"🚀 Starting execution for task {task_id}")
                logger.info(f"   Title: {task_title}")
                logger.info(f"   User: {user_id}")
                
                # Update status to in_progress to prevent duplicate processing
                try:
                    supabase_client.table("tasks").update({
                        "status": "in_progress"
                    }).eq("id", task_id).execute()
                    logger.debug(f"✏️  Updated task {task_id} status to 'in_progress'")
                except Exception as e:
                    logger.error(f"❌ Failed to update task status: {e}")
                    self.processing_tasks.discard(task_id)
                    continue
                
                # Spawn execution in separate thread to avoid blocking
                execution_thread = threading.Thread(
                    target=self._execute_task_wrapper,
                    args=(task_id, user_id, task_title),
                    daemon=True
                )
                execution_thread.start()
                logger.debug(f"🧵 Spawned execution thread for task {task_id}")
                
        except Exception as e:
            logger.error(f"❌ Error checking pending tasks: {e}")
    
    def _execute_task_wrapper(self, task_id: str, user_id: str, task_title: str):
        """
        Wrapper to execute task and handle cleanup.
        
        Args:
            task_id: Task ID to execute
            user_id: User ID who owns the task
            task_title: Task title for logging
        """
        try:
            logger.info(f"🤖 Executing task agent for: {task_title}")
            # Execute the task (no sid since this is background)
            run_autonomous_task(task_id, user_id, sid=None)
        except Exception as e:
            logger.error(f"❌ Error executing task {task_id}: {e}")
            # Revert status back to pending on failure
            try:
                supabase_client.table("tasks").update({
                    "status": "pending"
                }).eq("id", task_id).execute()
                logger.warning(f"⏪ Reverted task {task_id} status to 'pending' after failure")
            except Exception as revert_error:
                logger.error(f"❌ Failed to revert task status: {revert_error}")
        finally:
            # Remove from processing set
            self.processing_tasks.discard(task_id)
            logger.info(f"✅ Finished processing task {task_id}")


# Global instance
_task_poller_instance = None


def get_task_poller(poll_interval: int = 60) -> TaskPoller:
    """
    Get or create the global task poller instance.
    
    Args:
        poll_interval: Seconds between polls (default: 43200 = 12 hours)
    
    Returns:
        TaskPoller instance
    """
    global _task_poller_instance
    if _task_poller_instance is None:
        _task_poller_instance = TaskPoller(poll_interval=poll_interval)
    return _task_poller_instance


def start_task_poller(poll_interval: int = 60):
    """
    Start the global task poller.
    
    Args:
        poll_interval: Seconds between polls (default: 43200 = 12 hours)
    """
    poller = get_task_poller(poll_interval)
    poller.start()


def stop_task_poller():
    """Stop the global task poller."""
    global _task_poller_instance
    if _task_poller_instance:
        _task_poller_instance.stop()
