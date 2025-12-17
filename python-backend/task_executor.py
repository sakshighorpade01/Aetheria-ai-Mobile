# python-backend/task_executor.py
"""
Autonomous Task Execution Service
Handles background execution of tasks without streaming to chat
"""

import logging
import traceback
from typing import Dict, Any
from extensions import socketio
from supabase_client import supabase_client
from task_agent import get_task_agent

logger = logging.getLogger(__name__)


def run_autonomous_task(task_id: str, user_id: str, sid: str = None):
    """
    Executes a task autonomously in the background without user interaction.
    
    This function:
    1. Fetches task details from database
    2. Initializes autonomous executor agent
    3. Runs agent to generate deliverable
    4. Agent saves work and marks complete
    5. Emits status updates to frontend (if sid provided)
    
    Args:
        task_id: UUID of the task to execute
        user_id: User ID who owns the task
        sid: Socket ID for status notifications (optional, for real-time updates)
    """
    try:
        logger.info(f"🎯 Starting autonomous execution for task {task_id}")
        logger.info(f"   User: {user_id}")
        
        # Emit processing status to frontend (if connected)
        if sid:
            socketio.emit("task_execution_status", {
                "task_id": task_id,
                "status": "processing",
                "message": "AI is working on your task..."
            }, room=sid)
        
        # Fetch task details from database
        logger.debug(f"📥 Fetching task details from database...")
        response = supabase_client.table("tasks").select("*").eq("id", task_id).eq("user_id", user_id).single().execute()
        
        if not response.data:
            logger.error(f"❌ Task not found: {task_id}")
            if sid:
                socketio.emit("task_execution_status", {
                    "task_id": task_id,
                    "status": "error",
                    "message": "Task not found"
                }, room=sid)
            return
        
        task_data = response.data
        task_description = task_data.get('text', '')
        task_priority = task_data.get('priority', 'medium')
        
        logger.info(f"📝 Task: {task_description}")
        logger.info(f"⚡ Priority: {task_priority}")
        
        # Initialize task agent in execution mode
        logger.debug(f"🤖 Initializing task agent in execution mode...")
        from task_agent import get_task_agent
        
        executor = get_task_agent(
            user_id=user_id,
            debug_mode=False,
            execution_mode=True,
            task_id=task_id
        )
        
        # Execute the task autonomously (no streaming)
        # The agent will internally call save_task_work() and mark_task_complete()
        kickoff_prompt = f"Execute the assigned task: {task_description}"
        
        logger.info(f"▶️  Running autonomous executor for task {task_id}...")
        logger.info(f"   Agent will generate deliverable and save work")
        
        # Run without streaming - agent works silently in background
        run_response = executor.run(
            input=kickoff_prompt,
            stream=False  # No streaming for background execution
        )
        
        # Log the execution result
        if run_response and hasattr(run_response, 'content'):
            content_length = len(run_response.content)
            logger.info(f"📊 Agent response received: {content_length} characters")
            logger.debug(f"   Preview: {run_response.content[:100]}...")
        
        # Emit success status (if connected)
        if sid:
            socketio.emit("task_execution_status", {
                "task_id": task_id,
                "status": "completed",
                "message": "Task completed successfully!"
            }, room=sid)
        
        logger.info(f"✅ Autonomous execution completed for task {task_id}")
        logger.info(f"   Task should now be marked as 'completed' with deliverable saved")
        
    except Exception as e:
        logger.error(f"❌ Error in autonomous task execution for {task_id}: {e}")
        logger.error(f"   Traceback: {traceback.format_exc()}")
        
        # Try to revert task status to pending on failure
        try:
            supabase_client.table("tasks").update({
                "status": "pending"
            }).eq("id", task_id).execute()
            logger.warning(f"⏪ Reverted task {task_id} status to pending after failure")
        except Exception as revert_error:
            logger.error(f"❌ Failed to revert task status: {revert_error}")
        
        # Emit error status (if connected)
        if sid:
            socketio.emit("task_execution_status", {
                "task_id": task_id,
                "status": "error",
                "message": f"Execution failed: {str(e)}"
            }, room=sid)
