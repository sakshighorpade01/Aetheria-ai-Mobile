# python-backend/api.py

import logging
import uuid
from flask import Blueprint, request, jsonify

# Import the utility function from the factory (or a future utils module)
from utils import get_user_from_token
from supabase_client import supabase_client

logger = logging.getLogger(__name__)

# Create a Blueprint for API routes, with a URL prefix of /api
api_bp = Blueprint('api_bp', __name__, url_prefix='/api')


@api_bp.route('/integrations', methods=['GET'])
def get_integrations_status():
    """
    Fetches the list of connected third-party services for the authenticated user.
    """
    user, error = get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]
    
    response = supabase_client.from_('user_integrations').select('service').eq('user_id', str(user.id)).execute()
    
    return jsonify({"integrations": [item['service'] for item in response.data]})


@api_bp.route('/integrations/disconnect', methods=['POST'])
def disconnect_integration():
    """
    Removes an integration record for the authenticated user and a given service.
    """
    user, error = get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]
    
    service = request.json.get('service')
    if not service:
        return jsonify({"error": "Service not provided"}), 400
        
    supabase_client.from_('user_integrations').delete().match({'user_id': str(user.id), 'service': service}).execute()
    
    return jsonify({"message": "Disconnected"}), 200


@api_bp.route('/sessions', methods=['GET'])
def get_user_sessions():
    """
    Retrieves conversation sessions for the authenticated user with pagination support.
    Query params:
    - offset: Starting position (default: 0)
    - limit: Number of sessions to return (default: 15, max: 50)
    """
    user, error = get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]
    
    # Get pagination parameters
    try:
        offset = int(request.args.get('offset', 0))
        limit = int(request.args.get('limit', 15))
        
        # Validate parameters
        offset = max(0, offset)  # Ensure non-negative
        limit = max(1, min(limit, 50))  # Clamp between 1 and 50
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid pagination parameters"}), 400
    
    # Get paginated sessions
    response = supabase_client.from_('agno_sessions').select('*').eq('user_id', str(user.id)).order('created_at', desc=True).range(offset, offset + limit - 1).execute()
    
    # Get total count - use a separate query without range
    count_response = supabase_client.from_('agno_sessions').select('session_id', count='exact').eq('user_id', str(user.id)).execute()
    
    # Extract count from response
    total_count = 0
    if hasattr(count_response, 'count') and count_response.count is not None:
        total_count = count_response.count
    else:
        # Fallback: count the data array
        total_count = len(count_response.data) if count_response.data else 0
    
    return jsonify({
        "sessions": response.data,
        "total": total_count,
        "offset": offset,
        "limit": limit,
        "hasMore": offset + limit < total_count
    }), 200


@api_bp.route('/generate-upload-url', methods=['POST'])
def generate_upload_url():
    """
    Generates a pre-signed URL for securely uploading a file to Supabase storage.
    The file is placed in a user-specific folder.
    """
    user, error = get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]
        
    file_name = request.json.get('fileName')
    if not file_name:
        return jsonify({"error": "fileName is required"}), 400
        
    # Create a unique path for the file to prevent collisions
    file_path = f"{user.id}/{uuid.uuid4()}/{file_name}"
    
    upload_details = supabase_client.storage.from_('media-uploads').create_signed_upload_url(file_path)
    
    return jsonify({"signedURL": upload_details['signed_url'], "path": upload_details['path']}), 200

@api_bp.route('/healthz')
def health_check():
    """A simple health check endpoint for monitoring."""
    return "OK", 200

@api_bp.route('/health')
def health():
    """Detailed health check endpoint with memory stats."""
    try:
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        
        return jsonify({
            "status": "ok",
            "message": "Backend is running",
            "service": "aios-web",
            "memory": {
                "rss_mb": round(memory_info.rss / 1024 / 1024, 2),
                "vms_mb": round(memory_info.vms / 1024 / 1024, 2),
                "percent": round(process.memory_percent(), 2)
            },
            "cpu_percent": round(process.cpu_percent(interval=0.1), 2)
        }), 200
    except ImportError:
        # psutil not available, return basic health
        return jsonify({
            "status": "ok",
            "message": "Backend is running",
            "service": "aios-web"
        }), 200
    except Exception as e:
        logger.error(f"Error in health check: {e}")
        return jsonify({
            "status": "ok",
            "message": "Backend is running",
            "service": "aios-web"
        }), 200