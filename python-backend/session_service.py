# python-backend/session_service.py

import logging
import json
import requests
import datetime

# Import from our centralized config and extensions modules
import config
from extensions import RedisClient

logger = logging.getLogger(__name__)

class ConnectionManager:
    """
    Manages the lifecycle of user sessions, including creation, retrieval,
    and termination. It uses Redis for session storage and handles the cleanup
    of associated resources like sandbox environments.
    """
    def __init__(self, redis_client: RedisClient):
        """
        Initializes the ConnectionManager with a Redis client instance.

        Args:
            redis_client (RedisClient): An initialized Redis client.
        """
        self.redis_client = redis_client

    def create_session(self, conversation_id: str, user_id: str, agent_config: dict) -> dict:
        """
        Creates a new session record in Redis.

        Args:
            conversation_id (str): The unique ID for the conversation.
            user_id (str): The ID of the user starting the session.
            agent_config (dict): The agent configuration for this session.

        Returns:
            dict: The newly created session data.
        """
        logger.info(f"Creating new session shell in Redis for conversation_id: {conversation_id}")
        
        # Ensure a default set of tools is enabled for a new session
        agent_config.update({
            'enable_github': True, 'enable_google_email': True, 'enable_google_drive': True,
            'enable_browser': True, 'enable_vercel': True, 'enable_supabase': True
        })
        
        session_data = {
            "user_id": user_id,
            "config": agent_config,
            "created_at": datetime.datetime.now().isoformat(),
            "sandbox_ids": []
        }
        
        # Store the session data in Redis with a 24-hour expiration (86400 seconds)
        self.redis_client.set(f"session:{conversation_id}", json.dumps(session_data), ex=86400)
        return session_data

    def terminate_session(self, conversation_id: str):
        """
        Terminates a session, cleans up associated resources (like sandboxes),
        and removes the session record from Redis.

        Args:
            conversation_id (str): The ID of the session to terminate.
        """
        session_json = self.redis_client.get(f"session:{conversation_id}")
        if session_json:
            session_data = json.loads(session_json)
            
            # If a sandbox manager is configured, attempt to clean up any sandboxes
            if config.SANDBOX_API_URL:
                for sandbox_id in session_data.get("sandbox_ids", []):
                    try:
                        requests.delete(f"{config.SANDBOX_API_URL}/sessions/{sandbox_id}", timeout=30)
                        logger.info(f"Successfully requested cleanup for sandbox {sandbox_id}")
                    except requests.RequestException as e:
                        logger.error(f"Failed to clean up sandbox {sandbox_id}: {e}")
            
            # Delete the session from Redis
            self.redis_client.delete(f"session:{conversation_id}")
            logger.info(f"Terminated session {conversation_id} and cleaned up resources.")

    def get_session(self, conversation_id: str) -> dict | None:
        """
        Retrieves a session's data from Redis.

        Args:
            conversation_id (str): The ID of the session to retrieve.

        Returns:
            dict | None: The session data as a dictionary, or None if not found.
        """
        session_json = self.redis_client.get(f"session:{conversation_id}")
        return json.loads(session_json) if session_json else None