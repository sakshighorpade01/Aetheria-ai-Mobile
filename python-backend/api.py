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
    OPTIMIZED: Fetches runs but extracts only title from first message.
    """
    user, error = get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]
    
    try:
        # Fetch sessions with runs to extract titles
        response = supabase_client.from_('agno_sessions')\
            .select('session_id,created_at,user_id,updated_at,runs')\
            .eq('user_id', str(user.id))\
            .order('created_at', desc=True)\
            .limit(15)\
            .execute()
        
        # Process sessions to extract titles and remove heavy runs data
        sessions_with_titles = []
        for session in response.data:
            # Extract title from first user message
            title = f"Session {session['session_id'][:8]}"  # Default title
            
            runs = session.get('runs', [])
            if runs:
                # Find first top-level run
                top_level_runs = [run for run in runs if not run.get('parent_run_id')]
                if top_level_runs:
                    first_run = top_level_runs[0]
                    user_input = first_run.get('input', {}).get('input_content', '') or first_run.get('content', '')
                    
                    if user_input:
                        # Extract first line as title
                        lines = user_input.strip().split('\n')
                        title = lines[0][:100]  # First 100 chars of first line
                        
                        # Clean up "Current message:" marker if present
                        if 'Current message:' in title:
                            title = title.split('Current message:')[-1].strip()
            
            # Return session without heavy runs array
            sessions_with_titles.append({
                'session_id': session['session_id'],
                'created_at': session['created_at'],
                'user_id': session['user_id'],
                'updated_at': session.get('updated_at'),
                'title': title
            })
        
        logger.info(f"Sessions query for user {user.id}: returned {len(sessions_with_titles)} sessions")
        
        return jsonify(sessions_with_titles), 200
        
    except Exception as e:
        logger.error(f"Error fetching sessions for user {user.id}: {e}")
        return jsonify({"error": "Failed to fetch sessions"}), 500


@api_bp.route('/sessions/<session_id>', methods=['GET'])
def get_session_details(session_id: str):
    """
    Retrieves full details for a specific session (including runs).
    This is called only when user clicks on a session (lazy loading).
    """
    user, error = get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]
    
    try:
        # Fetch full session data only when needed
        response = supabase_client.from_('agno_sessions')\
            .select('*')\
            .eq('session_id', session_id)\
            .eq('user_id', str(user.id))\
            .single()\
            .execute()
        
        if not response.data:
            return jsonify({"error": "Session not found"}), 404
        
        logger.info(f"Fetched full details for session {session_id}")
        return jsonify(response.data), 200
        
    except Exception as e:
        logger.error(f"Error fetching session {session_id}: {e}")
        return jsonify({"error": "Failed to fetch session details"}), 500


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