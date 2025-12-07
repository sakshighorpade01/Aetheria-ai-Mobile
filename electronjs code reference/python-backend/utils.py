# python-backend/utils.py

import logging
from flask import request
from gotrue.errors import AuthApiError

# Import the supabase_client directly, as this is its dependency
from supabase_client import supabase_client

logger = logging.getLogger(__name__)

def get_user_from_token(request_object):
    """
    Validates a JWT from an Authorization header and retrieves the user.
    This is a shared utility function used by multiple API routes.

    Args:
        request_object: The Flask request object.

    Returns:
        A tuple of (user, error_tuple) or (None, error_tuple).
    """
    auth_header = request_object.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, ('Authorization header is missing or invalid', 401)
    
    jwt = auth_header.split(' ')[1]
    try:
        user_response = supabase_client.auth.get_user(jwt=jwt)
        if not user_response.user:
            raise AuthApiError("User not found for token.", 401)
        return user_response.user, None
    except AuthApiError as e:
        logger.error(f"API authentication error: {e.message}")
        return None, ('Invalid or expired token', 401)