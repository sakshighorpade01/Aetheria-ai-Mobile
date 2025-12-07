# python-backend/sockets.py (Corrected to align with refactored agent_runner)

import logging
import json
import uuid
import traceback
from typing import Dict, Any
from redis import Redis

import eventlet
from flask import request
from gotrue.errors import AuthApiError

# Import the shared socketio instance from extensions
from extensions import socketio
from supabase_client import supabase_client
from session_service import ConnectionManager
from agent_runner import run_agent_and_stream

logger = logging.getLogger(__name__)

# --- Dependency Injection Placeholders ---
connection_manager_service: ConnectionManager = None
redis_client_instance: Redis = None

def set_dependencies(manager: ConnectionManager, redis_client: Redis):
    """A setter function to inject dependencies from the factory."""
    global connection_manager_service, redis_client_instance
    connection_manager_service = manager
    redis_client_instance = redis_client


# ==============================================================================
# SOCKET.IO EVENT HANDLERS
# ==============================================================================

@socketio.on("connect")
def on_connect():
    logger.info(f"Client connected: {request.sid[:8]}")
    socketio.emit("status", {"message": "Connected to server"}, room=request.sid)


@socketio.on("disconnect")
def on_disconnect():
    logger.info(f"Client disconnected: {request.sid[:8]}")
    pass  # Connection lifecycle managed by socket.io


@socketio.on('browser-command-result')
def handle_browser_command_result(data: Dict[str, Any]):
    """
    Receives a result from the client and PUBLISHES it to the corresponding
    Redis channel, waking up the waiting agent tool.
    """
    if not redis_client_instance:
        logger.error("Redis not initialized")
        return

    request_id = data.get('request_id')
    result_payload = data.get('result', {})

    if request_id:
        response_channel = f"browser-response:{request_id}"
        try:
            redis_client_instance.publish(response_channel, json.dumps(result_payload))
        except Exception as e:
            logger.error(f"Redis publish failed: {e}")
    else:
        logger.error("Browser result missing request_id")


@socketio.on("send_message")
def on_send_message(data: str):
    """The main message handler for incoming chat messages."""
    sid = request.sid
    if not connection_manager_service or not redis_client_instance:
        logger.error("Services not initialized")
        return

    try:
        data = json.loads(data)
        access_token = data.get("accessToken")
        conversation_id = data.get("conversationId")

        if not conversation_id:
            return socketio.emit("error", {"message": "Critical error: conversationId is missing."}, room=sid)
        if not access_token:
            return socketio.emit("error", {"message": "Authentication token is missing.", "reset": True}, room=sid)

        user = supabase_client.auth.get_user(jwt=access_token).user
        if not user:
            raise AuthApiError("User not found for token.", 401)

        if data.get("type") == "terminate_session":
            connection_manager_service.terminate_session(conversation_id)
            logger.info(f"{sid[:8]} | Session terminated")
            return socketio.emit("status", {"message": f"Session {conversation_id} terminated"}, room=sid)

        if not connection_manager_service.get_session(conversation_id):
            connection_manager_service.create_session(conversation_id, str(user.id), data.get("config", {}))

        turn_data = {"user_message": data.get("message", ""), "files": data.get("files", [])}
        context_session_ids = data.get("context_session_ids", [])
        message_id = data.get("id") or str(uuid.uuid4())
        
        # Log message received
        msg_preview = data.get("message", "")[:50]
        logger.info(f"{sid[:8]} | Message received: {msg_preview}{'...' if len(data.get('message', '')) > 50 else ''}")
        
        eventlet.spawn(
            run_agent_and_stream,
            sid,
            conversation_id,
            message_id,
            turn_data,
            context_session_ids,
            connection_manager_service,
            redis_client_instance
        )

    except AuthApiError as e:
        logger.error(f"{sid[:8]} | Auth failed: {e.message}")
        socketio.emit("error", {"message": "Your session has expired. Please log in again."}, room=sid)
    except Exception as e:
        logger.error(f"{sid[:8]} | Error: {str(e)}")
        socketio.emit("error", {"message": "An error occurred. Your conversation is preserved. Please try again."}, room=sid)