# python-backend/config.py

import os
from dotenv import load_dotenv

# Load environment variables from a .env file
load_dotenv()

# --- Core Application Configuration ---
REDIS_URL = os.getenv('REDIS_URL')
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY")
SANDBOX_API_URL = os.getenv("SANDBOX_API_URL")
DATABASE_URL = os.getenv("DATABASE_URL")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# --- LLM Provider Keys (Handled automatically by Agno, listed here for clarity) ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") # For Google Search, also auto-detected

# --- OAuth Provider Credentials (Optional) ---
# These can be None if not set in the .env file. The factory will handle this.
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

VERCEL_CLIENT_ID = os.getenv("VERCEL_CLIENT_ID")
VERCEL_CLIENT_SECRET = os.getenv("VERCEL_CLIENT_SECRET")

SUPABASE_CLIENT_ID = os.getenv("SUPABASE_CLIENT_ID")
SUPABASE_CLIENT_SECRET = os.getenv("SUPABASE_CLIENT_SECRET")

# --- Celery Configuration ---
CELERY_CONFIG = {
    'broker_url': REDIS_URL,
    'result_backend': REDIS_URL
}

# --- Validation for Critical Variables ---
# The application cannot run without these.
if not FLASK_SECRET_KEY:
    raise ValueError("CRITICAL: FLASK_SECRET_KEY must be set in the environment.")
if not DATABASE_URL:
    raise ValueError("CRITICAL: DATABASE_URL must be set in the environment.")
if not REDIS_URL:
    raise ValueError("CRITICAL: REDIS_URL must be set in the environment.")