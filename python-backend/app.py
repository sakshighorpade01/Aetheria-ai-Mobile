# python-backend/app.py
import os
import logging
import sys
from factory import create_app
from extensions import socketio

# Configure logging for production
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Set specific loggers
logging.getLogger('task_poller').setLevel(logging.INFO)
logging.getLogger('task_executor').setLevel(logging.INFO)
logging.getLogger('task_agent').setLevel(logging.INFO)

logger = logging.getLogger(__name__)
logger.info("🚀 Starting AI-OS Backend Application")

# Create the application instance using the factory
app = create_app()

# This block is for local development and debugging.
if __name__ == "__main__":
    # Use socketio.run to correctly handle both Flask and SocketIO requests
    socketio.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8765)),
        debug=os.environ.get("DEBUG", "False").lower() == "true",
        use_reloader=os.environ.get("DEBUG", "False").lower() == "true"
    )