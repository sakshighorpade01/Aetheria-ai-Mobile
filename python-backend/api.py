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
    Retrieves the 15 most recent conversation sessions for the authenticated user.
    """
    user, error = get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]
        
    response = supabase_client.from_('agno_sessions').select('*').eq('user_id', str(user.id)).order('created_at', desc=True).limit(15).execute()
    
    # Debug logging to help diagnose session count issues
    logger.info(f"Sessions query for user {user.id}: requested 15, returned {len(response.data)}")
    
    return jsonify(response.data), 200


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
    """Detailed health check endpoint."""
    return jsonify({
        "status": "ok",
        "message": "Backend is running",
        "service": "aios-web"
    }), 200