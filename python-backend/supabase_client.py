# supabase_client.py (Corrected and Final Version)

import os
import supabase
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)
load_dotenv()

# --- CRITICAL FIX: Use the SERVICE_ROLE KEY for backend operations ---
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY") # <-- Use the service key

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in your environment.")

logger.info(f"Initializing Supabase client with URL: {supabase_url}")
supabase_client = supabase.create_client(supabase_url, supabase_key)

# --- REMOVED ---
# The old, deprecated functions are removed. The client object is all that's needed.