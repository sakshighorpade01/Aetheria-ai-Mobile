# python-backend/factory.py (Updated for Redis Pub/Sub)

import logging
from flask import Flask

# --- Local Module Imports ---
import config
from extensions import socketio, oauth, RedisClient

# --- Service Layer Imports ---
from session_service import ConnectionManager

# --- Route and Handler Registration Imports ---
from auth import auth_bp
from api import api_bp
import sockets 

logger = logging.getLogger(__name__)

# ==============================================================================
# APPLICATION FACTORY
# ==============================================================================

def create_app():
    """
    Creates and configures the Flask application and its extensions.
    """
    app = Flask(__name__)
    app.secret_key = config.FLASK_SECRET_KEY

    # --- 1. Initialize Extensions ---
    socketio.init_app(app, message_queue=config.REDIS_URL)
    oauth.init_app(app)
    
    # --- 2. Instantiate Services ---
    redis_client = RedisClient.from_url(config.REDIS_URL)
    connection_manager = ConnectionManager(redis_client)

    # --- 3. Inject Dependencies into Modules ---
    # Pass BOTH the connection_manager and the redis_client to the sockets module.
    sockets.set_dependencies(manager=connection_manager, redis_client=redis_client)

    # --- 4. Register OAuth Providers ---
    # (This section is unchanged)
    if config.GITHUB_CLIENT_ID and config.GITHUB_CLIENT_SECRET:
        oauth.register(
            name='github', client_id=config.GITHUB_CLIENT_ID, client_secret=config.GITHUB_CLIENT_SECRET,
            access_token_url='https://github.com/login/oauth/access_token', authorize_url='https://github.com/login/oauth/authorize',
            api_base_url='https://api.github.com/', client_kwargs={'scope': 'repo user:email'}
        )
        logger.info("GitHub OAuth provider registered.")
    else:
        logger.warning("GitHub OAuth credentials not set. GitHub integration will be disabled.")

    if config.GOOGLE_CLIENT_ID and config.GOOGLE_CLIENT_SECRET:
        oauth.register(
            name='google', client_id=config.GOOGLE_CLIENT_ID, client_secret=config.GOOGLE_CLIENT_SECRET,
            authorize_url='https://accounts.google.com/o/oauth2/auth', access_token_url='https://accounts.google.com/o/oauth2/token',
            api_base_url='https://www.googleapis.com/oauth2/v1/',
            client_kwargs={'scope': 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/drive', 'access_type': 'offline', 'prompt': 'consent'}
        )
        logger.info("Google OAuth provider registered.")
    else:
        logger.warning("Google OAuth credentials not set. Google integration will be disabled.")

    if config.VERCEL_CLIENT_ID and config.VERCEL_CLIENT_SECRET:
        oauth.register(
            name='vercel', client_id=config.VERCEL_CLIENT_ID, client_secret=config.VERCEL_CLIENT_SECRET,
            access_token_url='https://api.vercel.com/v2/oauth/access_token', authorize_url='https://vercel.com/oauth/authorize',
            api_base_url='https://api.vercel.com/', client_kwargs={'scope': 'users:read teams:read projects:read deployments:read'}
        )
        logger.info("Vercel OAuth provider registered.")
    else:
        logger.warning("Vercel OAuth credentials not set. Vercel integration will be disabled.")

    if config.SUPABASE_CLIENT_ID and config.SUPABASE_CLIENT_SECRET:
        oauth.register(
            name='supabase', client_id=config.SUPABASE_CLIENT_ID, client_secret=config.SUPABASE_CLIENT_SECRET,
            access_token_url='https://api.supabase.com/v1/oauth/token', authorize_url='https://api.supabase.com/v1/oauth/authorize',
            api_base_url='https://api.supabase.com/v1/', client_kwargs={'scope': 'organizations:read projects:read'}
        )
        logger.info("Supabase OAuth provider registered.")
    else:
        logger.warning("Supabase OAuth credentials not set. Supabase integration will be disabled.")

    # --- 5. Register Blueprints (HTTP Routes) ---
    app.register_blueprint(auth_bp)
    app.register_blueprint(api_bp)

    # --- 6. Start Background Task Poller ---
    from task_poller import start_task_poller
    start_task_poller(poll_interval=43200)  # Check every 12 hours (43200 seconds)
    logger.info("Task poller started (12 hour interval)")

    return app