# python-backend/app.py
import eventlet
eventlet.monkey_patch()

import os
import logging
from logging_config import setup_logging
from factory import create_app
from extensions import socketio, celery

# Setup clean logging
logger = setup_logging()

# Create the application instance using the factory
app = create_app()

# This block is for local development and debugging.
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    logger.info(f"🚀 Aetheria AI Backend starting on port {port}")
    
    # Use socketio.run to correctly handle both Flask and SocketIO requests
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=os.environ.get("DEBUG", "False").lower() == "true",
        use_reloader=os.environ.get("DEBUG", "False").lower() == "true"
    )