# python-backend/auth.py

import logging
import traceback
import requests
from flask import Blueprint, request, redirect, url_for, session

# Import extensions and config that the routes will use
import config
from extensions import oauth
from supabase_client import supabase_client
from gotrue.errors import AuthApiError

logger = logging.getLogger(__name__)

# Create a Blueprint object. This acts as a container for our auth routes.
auth_bp = Blueprint(
    'auth_bp', __name__,
    # You can optionally define a static folder or template folder for the blueprint
    # template_folder='templates',
    # static_folder='static'
)

@auth_bp.route('/login/<provider>')
def login_provider(provider):
    """
    Initiates the OAuth login flow for a given provider.
    It saves the user's Supabase token in the Flask session and redirects
    to the provider's authorization page.
    """
    token = request.args.get('token')
    if not token:
        return "Authentication token is missing.", 400
    
    # Store the user's JWT in the session to link the OAuth callback to the user
    session['supabase_token'] = token
    
    redirect_uri = url_for('auth_bp.auth_callback', provider=provider, _external=True)
    
    if provider not in oauth._clients:
        return "Invalid or unconfigured provider specified.", 404
        
    if provider == 'google':
        # Google requires specific parameters for offline access (to get a refresh token)
        return oauth.google.authorize_redirect(redirect_uri, access_type='offline', prompt='consent')
        
    return oauth.create_client(provider).authorize_redirect(redirect_uri)


@auth_bp.route('/auth/<provider>/callback')
def auth_callback(provider):
    """
    Handles the callback from the OAuth provider after the user has
    authorized the application. It exchanges the authorization code for an
    access token and saves the integration details to the database.
    """
    try:
        if provider == 'vercel':
            # Vercel has a slightly different flow for exchanging the code
            code = request.args.get('code')
            if not code:
                return "Vercel authorization code is missing.", 400
            
            token_response = requests.post(
                'https://api.vercel.com/v2/oauth/access_token',
                data={
                    'client_id': config.VERCEL_CLIENT_ID,
                    'client_secret': config.VERCEL_CLIENT_SECRET,
                    'code': code,
                    'redirect_uri': url_for('auth_bp.auth_callback', provider='vercel', _external=True)
                }
            )
            token_response.raise_for_status()
            token = token_response.json()
            
            # For Vercel, we need to find the user ID by matching the email
            user_info_response = requests.get('https://api.vercel.com/v2/user', headers={'Authorization': f"Bearer {token['access_token']}"})
            user_info_response.raise_for_status()
            vercel_user_email = user_info_response.json()['user']['email']
            
            user_lookup = supabase_client.from_('profiles').select('id').eq('email', vercel_user_email).single().execute()
            if not user_lookup.data:
                return "Error: Could not find a user in our system with the Vercel email address.", 400
            user_id = user_lookup.data['id']
        else:
            # Standard OAuth flow for Google, GitHub, etc.
            supabase_token = session.get('supabase_token')
            if not supabase_token:
                return "Your session has expired. Please try logging in again.", 400
            
            user = supabase_client.auth.get_user(jwt=supabase_token).user
            if not user:
                raise AuthApiError("User not found for token.", 401)
            user_id = user.id
            
            client = oauth.create_client(provider)
            token = client.authorize_access_token()

        if not user_id:
            return "Could not identify the user.", 400

        # Prepare and upsert the integration data into Supabase
        integration_data = {
            'user_id': str(user_id),
            'service': provider,
            'access_token': token.get('access_token'),
            'refresh_token': token.get('refresh_token'),
            'scopes': token.get('scope', '').split(' ')
        }
        # Remove any keys with None values before upserting
        integration_data = {k: v for k, v in integration_data.items() if v is not None}
        
        supabase_client.from_('user_integrations').upsert(integration_data).execute()
        logger.info(f"Supabase: Saved {provider} integration")
        
        # Return a success page that notifies the parent window and closes
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Successful</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }}
                .container {{
                    text-align: center;
                    padding: 2rem;
                }}
                .success-icon {{
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }}
                h1 {{
                    margin: 0 0 0.5rem 0;
                    font-size: 1.5rem;
                }}
                p {{
                    margin: 0;
                    opacity: 0.9;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✓</div>
                <h1>Authentication Successful!</h1>
                <p>You have successfully connected your {provider.capitalize()} account.</p>
                <p>This window will close automatically...</p>
            </div>
            <script>
                // Notify parent window of success
                if (window.opener) {{
                    window.opener.postMessage({{
                        type: 'oauth-callback',
                        success: true,
                        provider: '{provider}'
                    }}, '{config.FRONTEND_URL}');
                }}
                // Close window after 1.5 seconds
                setTimeout(function() {{
                    window.close();
                }}, 1500);
            </script>
        </body>
        </html>
        """

    except Exception as e:
        logger.error(f"{provider} auth error: {str(e)}")
        error_message = str(e)
        
        # Return an error page that notifies the parent window and closes
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Failed</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                }}
                .container {{
                    text-align: center;
                    padding: 2rem;
                }}
                .error-icon {{
                    font-size: 4rem;
                    margin-bottom: 1rem;
                }}
                h1 {{
                    margin: 0 0 0.5rem 0;
                    font-size: 1.5rem;
                }}
                p {{
                    margin: 0.5rem 0;
                    opacity: 0.9;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="error-icon">✗</div>
                <h1>Authentication Failed</h1>
                <p>An error occurred during authentication.</p>
                <p>This window will close automatically...</p>
            </div>
            <script>
                // Notify parent window of error
                if (window.opener) {{
                    window.opener.postMessage({{
                        type: 'oauth-callback',
                        success: false,
                        provider: '{provider}',
                        error: 'Authentication failed'
                    }}, '{config.FRONTEND_URL}');
                }}
                // Close window after 2 seconds
                setTimeout(function() {{
                    window.close();
                }}, 2000);
            </script>
        </body>
        </html>
        """