# python-backend/app.py
import os
from factory import create_app
from extensions import socketio

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