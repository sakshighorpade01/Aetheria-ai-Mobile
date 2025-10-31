# python-backend/app.py (Async Version)

import os
import logging
import json
import uuid
import traceback
import asyncio
import httpx  # Replaces the 'requests' library for async HTTP calls
from pathlib import Path
from quart import Quart, request, jsonify, redirect, url_for, session, websocket
from quart_cors import cors
from dotenv import load_dotenv
import datetime
from typing import Union, Dict, Any, List, Tuple

from authlib.integrations.starlette_client import OAuth # Changed from flask_client to quart_client

from assistant import get_llm_os
from deepsearch import get_deepsearch
from supabase_client import supabase_client

# Import all necessary event and response types
from agno.agent import Agent
from agno.team import Team
from agno.media import Image, Audio, Video, File
from agno.run.response import RunEvent, RunResponse
from agno.run.team import TeamRunEvent, TeamRunResponse
from gotrue.errors import AuthApiError

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# The SocketIOHandler is no longer needed as we are using native WebSockets.
# We can implement a custom logging handler for WebSockets if needed, but for now,
# standard logging will go to the console.

app = Quart(__name__)
app = cors(app, allow_origin="*") 

app = Quart(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY") # Quart uses the same secret_key config
if not app.secret_key:
    raise ValueError("FLASK_SECRET_KEY is not set. Please set it in your environment variables.")

# The SocketIO instance is removed. WebSocket logic is now handled by a route.

oauth = OAuth(app)

# The OAuth registration remains almost identical.
oauth.register(
    name='github',
    client_id=os.getenv("GITHUB_CLIENT_ID"),
    client_secret=os.getenv("GITHUB_CLIENT_SECRET"),
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'repo user:email'},
)

oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    access_token_url='https://accounts.google.com/o/oauth2/token',
    access_token_params=None,
    refresh_token_url=None,
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    client_kwargs={
        'scope': 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/drive',
        'access_type': 'offline',
        'prompt': 'consent'
    }
)

class IsolatedAssistant:
    """
    This class is now fully asynchronous. It requires a reference to the active
    websocket connection to send data back to the client.
    """
    def __init__(self, ws):
        self.websocket = ws
        self.message_id = None
        self.final_assistant_response = ""

    async def _process_and_emit_response(self, response: Union[RunResponse, TeamRunResponse], is_top_level: bool = True):
        """
        Recursively processes a response and sends socket events. Now async.
        """
        if not response:
            return

        owner_name = getattr(response, 'agent_name', None) or getattr(response, 'team_name', None)
        is_final_content = is_top_level and owner_name == "Aetheria_AI"

        if response.content:
            await self.websocket.send_json({
                "content": response.content,
                "streaming": True,
                "id": self.message_id,
                "agent_name": owner_name,
                "team_name": owner_name,
                "is_log": not is_final_content,
            })

        if hasattr(response, 'member_responses') and response.member_responses:
            for member_response in response.member_responses:
                await self._process_and_emit_response(member_response, is_top_level=False)

    async def arun_safely(self, agent: Union[Agent, Team], message: str, user, context=None, images=None, audio=None, videos=None, files=None):
        """
        This is the main async execution method, replacing the eventlet-spawned function.
        """
        try:
            if context:
                complete_message = f"Previous conversation context:\n{context}\n\nCurrent message: {message}"
            else:
                complete_message = message

            import inspect
            params = inspect.signature(agent.arun).parameters
            supported_params = {
                'message': complete_message,
                'stream': True,
                'stream_intermediate_steps': True,
                'user_id': str(user.id)
            }
            if 'images' in params and images: supported_params['images'] = images
            if 'audio' in params and audio: supported_params['audio'] = audio
            if 'videos' in params and videos: supported_params['videos'] = videos
            if 'files' in params and files: supported_params['files'] = files

            logger.info(f"Calling agent.arun for user {user.id} with params: {list(supported_params.keys())}")
            
            self.final_assistant_response = ""
            
            # Use `async for` to iterate over the asynchronous generator from `agent.arun`
            async for chunk in agent.arun(**supported_params):
                if not chunk or not hasattr(chunk, 'event'):
                    continue

                await asyncio.sleep(0) # Yield control to the event loop
                
                if (chunk.event == RunEvent.run_response_content.value or
                    chunk.event == TeamRunEvent.run_response_content.value):
                    await self._process_and_emit_response(chunk, is_top_level=True)
                    
                    owner_name = getattr(chunk, 'agent_name', None) or getattr(chunk, 'team_name', None)
                    is_final_chunk = owner_name == "Aetheria_AI" and (not hasattr(chunk, 'member_responses') or not chunk.member_responses)

                    if chunk.content and is_final_chunk:
                        self.final_assistant_response += chunk.content

                elif (chunk.event == RunEvent.tool_call_started.value or
                      chunk.event == TeamRunEvent.tool_call_started.value) and hasattr(chunk, 'tool'):
                    await self.websocket.send_json({
                        "type": "tool_start",
                        "name": chunk.tool.tool_name,
                        "agent_name": getattr(chunk, 'agent_name', None),
                        "team_name": getattr(chunk, 'team_name', None),
                        "id": self.message_id
                    })

                elif (chunk.event == RunEvent.tool_call_completed.value or
                      chunk.event == TeamRunEvent.tool_call_completed.value) and hasattr(chunk, 'tool'):
                    # *** CRITICAL FIX IMPLEMENTED HERE ***
                    # The full `tool` object is now included in the payload.
                    await self.websocket.send_json({
                        "type": "tool_end",
                        "name": chunk.tool.tool_name,
                        "agent_name": getattr(chunk, 'agent_name', None),
                        "team_name": getattr(chunk, 'team_name', None),
                        "id": self.message_id,
                        "tool": chunk.tool.to_dict() # Serialize the tool object
                    })

            await self.websocket.send_json({
                "content": "",
                "done": True,
                "id": self.message_id,
            })

            if hasattr(agent, 'session_metrics') and agent.session_metrics:
                logger.info(
                    f"Run complete. Cumulative session tokens for SID {self.websocket.sid}: "
                    f"{agent.session_metrics.input_tokens} in, "
                    f"{agent.session_metrics.output_tokens} out."
                )
            
            # This method is now synchronous as it doesn't perform I/O
            self._save_conversation_turn(complete_message)

        except Exception as e:
            error_msg = f"Tool error: {str(e)}\n{traceback.format_exc()}"
            logger.error(error_msg)
            await self.websocket.send_json({
                "content": "An error occurred while processing your request. Starting a new session...",
                "error": True, "done": True, "id": self.message_id,
            })
            await self.websocket.send_json({"message": "Session reset required", "reset": True})

    def _save_conversation_turn(self, user_message):
        # This method remains synchronous as it's just manipulating in-memory dictionaries.
        try:
            # We need a way to get the session info. Let's assume the websocket SID is used.
            session_info = connection_manager.sessions.get(self.websocket.sid)
            if not session_info:
                logger.warning(f"Cannot save conversation turn: no session found for SID {self.websocket.sid}")
                return
                
            turn_data = {
                "role": "user",
                "content": user_message,
                "timestamp": datetime.datetime.now().isoformat()
            }
            
            if 'history' not in session_info:
                session_info['history'] = []
            session_info['history'].append(turn_data)
            
            assistant_turn = {
                "role": "assistant",
                "content": self.final_assistant_response,
                "timestamp": datetime.datetime.now().isoformat()
            }
            session_info['history'].append(assistant_turn)
            
            logger.info(f"Added conversation turn to history for SID {self.websocket.sid}. History length: {len(session_info['history'])}")
        except Exception as e:
            logger.error(f"Error saving conversation turn: {e}")

    def terminate(self):
        pass

class ConnectionManager:
    def __init__(self):
        self.sessions = {}
        self.isolated_assistants = {}

    def create_session(self, sid: str, user_id: str, config: dict, ws, is_deepsearch: bool = False) -> Union[Agent, Team]:
        if sid in self.sessions:
            # This should be awaited now
            asyncio.create_task(self.terminate_session(sid))

        logger.info(f"Creating new session for user: {user_id}")
        config['enable_github'] = True 
        config['enable_google_email'] = True
        config['enable_google_drive'] = True

        session_info = {
            "agent": None,
            "config": config,
            "history": [],
            "user_id": user_id,
            "created_at": datetime.datetime.now().isoformat(),
            "sandbox_ids": set(),
            "active_sandbox_id": None
        }
        
        if is_deepsearch:
            agent = get_deepsearch(user_id=user_id, session_info=session_info, **config)
        else:
            agent = get_llm_os(user_id=user_id, session_info=session_info, **config)

        session_info["agent"] = agent
        self.sessions[sid] = session_info
        
        # Pass the websocket object to the assistant
        self.isolated_assistants[sid] = IsolatedAssistant(ws)
        logger.info(f"Created session {sid} for user {user_id} with config {config}")
        return agent

    async def terminate_session(self, sid):
        if sid in self.sessions:
            session_info = self.sessions.pop(sid)
            if not session_info: return
            
            agent = session_info.get("agent")
            history = session_info.get("history", [])
            user_id = session_info.get("user_id")

            sandbox_ids_to_clean = session_info.get("sandbox_ids", set())
            if sandbox_ids_to_clean:
                logger.info(f"Cleaning up {len(sandbox_ids_to_clean)} sandbox sessions for SID {sid}.")
                sandbox_api_url = os.getenv("SANDBOX_API_URL")
                # Use httpx for async requests
                async with httpx.AsyncClient() as client:
                    for sandbox_id in sandbox_ids_to_clean:
                        try:
                            await client.delete(f"{sandbox_api_url}/sessions/{sandbox_id}", timeout=10)
                            logger.info(f"Successfully terminated sandbox {sandbox_id}.")
                        except httpx.RequestError as e:
                            logger.error(f"Failed to clean up sandbox {sandbox_id}: {e}")

            if agent and hasattr(agent, 'session_metrics') and agent.session_metrics:
                try:
                    final_metrics = agent.session_metrics
                    input_tokens, output_tokens = final_metrics.input_tokens, final_metrics.output_tokens
                    if input_tokens > 0 or output_tokens > 0:
                        user_id_str = str(agent.user_id) if hasattr(agent, 'user_id') else user_id
                        # Supabase calls must be awaited
                        await supabase_client.from_('request_logs').insert({
                            'user_id': user_id_str, 'input_tokens': input_tokens, 'output_tokens': output_tokens
                        }).execute()
                except Exception as e:
                    logger.error(f"Failed to log usage metrics for session {sid} on termination: {e}\n{traceback.format_exc()}")
            
            if history and len(history) > 0:
                try:
                    now = int(datetime.datetime.now().timestamp())
                    payload = {
                        "session_id": sid, "user_id": user_id, "agent_id": "AI_OS",
                        "created_at": now, "updated_at": now, "memory": { "runs": history }, "session_data": {}
                    }
                    if agent and hasattr(agent, 'session_metrics') and agent.session_metrics:
                        payload["session_data"]["metrics"] = {
                            "input_tokens": agent.session_metrics.input_tokens,
                            "output_tokens": agent.session_metrics.output_tokens,
                            "total_tokens": agent.session_metrics.input_tokens + agent.session_metrics.output_tokens
                        }
                    # Supabase calls must be awaited
                    await supabase_client.from_('ai_os_sessions').upsert(payload).execute()
                except Exception as e:
                    logger.error(f"Failed to save conversation history for SID {sid}: {e}\n{traceback.format_exc()}")
            
            if sid in self.isolated_assistants:
                self.isolated_assistants[sid].terminate()
                del self.isolated_assistants[sid]
            logger.info(f"Terminated and cleaned up session {sid}")

    def get_session(self, sid):
        return self.sessions.get(sid)

    async def remove_session(self, sid):
        await self.terminate_session(sid)

connection_manager = ConnectionManager()

# All routes must now be `async def`
@app.route('/login/<provider>')
async def login_provider(provider):
    token = request.args.get('token')
    if not token:
        return "Authentication token is missing.", 400
    session['supabase_token'] = token
    
    redirect_uri = await url_for('auth_callback', provider=provider, _external=True)
    
    if provider not in oauth._clients:
        return "Invalid provider specified.", 404
    
    # Authlib's authorize_redirect is now an async method
    if provider == 'google':
        return await oauth.google.authorize_redirect(
            redirect_uri,
            access_type='offline',
            prompt='consent'
        )
        
    return await oauth.create_client(provider).authorize_redirect(redirect_uri)

@app.route('/auth/<provider>/callback')
async def auth_callback(provider):
    try:
        supabase_token = session.get('supabase_token')
        if not supabase_token:
            return "Your session has expired. Please try connecting again.", 400
        
        try:
            # Supabase calls must be awaited
            user_response = await supabase_client.auth.get_user(jwt=supabase_token)
            user = user_response.user
            if not user:
                raise AuthApiError("User not found for the provided token.", 401)
        except AuthApiError as e:
            logger.error(f"Invalid token during {provider} auth callback: {e.message}")
            return "Your session is invalid. Please log in and try again.", 401
        
        client = oauth.create_client(provider)
        # Authlib's authorize_access_token is now an async method
        token = await client.authorize_access_token()

        logger.info(f"Received token data from {provider}: {token}")
        
        integration_data = {
            'user_id': str(user.id),
            'service': provider,
            'access_token': token.get('access_token'),
            'refresh_token': token.get('refresh_token'),
            'scopes': token.get('scope', '').split(' '),
        }
        
        integration_data = {k: v for k, v in integration_data.items() if v is not None}

        # Supabase calls must be awaited
        await supabase_client.from_('user_integrations').upsert(integration_data).execute()
        
        logger.info(f"Successfully saved {provider} integration for user {user.id}")

        return f"""
            <h1>Authentication Successful!</h1>
            <p>You have successfully connected your {provider.capitalize()} account. You can now close this window.</p>
        """
    except Exception as e:
        logger.error(f"Error in {provider} auth callback: {e}\n{traceback.format_exc()}")
        return "An error occurred during authentication. Please try again.", 500

async def get_user_from_token(request):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None, ('Authorization header is missing or invalid', 401)
    
    jwt = auth_header.split(' ')[1]
    try:
        # Supabase calls must be awaited
        user_response = await supabase_client.auth.get_user(jwt=jwt)
        if not user_response.user:
            raise AuthApiError("User not found for token.", 401)
        return user_response.user, None
    except AuthApiError as e:
        logger.error(f"API authentication error: {e.message}")
        return None, ('Invalid or expired token', 401)

@app.route('/api/integrations', methods=['GET'])
async def get_integrations_status():
    user, error = await get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]

    try:
        # Supabase calls must be awaited
        response = await supabase_client.from_('user_integrations').select('service').eq('user_id', str(user.id)).execute()
        connected_services = [item['service'] for item in response.data]
        return jsonify({"integrations": connected_services})
    except Exception as e:
        logger.error(f"Failed to get integration status for user {user.id}: {e}")
        return jsonify({"error": "Failed to retrieve integration status"}), 500

@app.route('/api/integrations/disconnect', methods=['POST'])
async def disconnect_integration():
    user, error = await get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]

    data = await request.get_json()
    service_to_disconnect = data.get('service')
    if not service_to_disconnect:
        return jsonify({"error": "Service name not provided"}), 400

    try:
        # Supabase calls must be awaited
        await supabase_client.from_('user_integrations').delete().eq('user_id', str(user.id)).eq('service', service_to_disconnect).execute()
        logger.info(f"User {user.id} disconnected from {service_to_disconnect}")
        return jsonify({"message": f"Successfully disconnected from {service_to_disconnect}"}), 200
    except Exception as e:
        logger.error(f"Failed to disconnect {service_to_disconnect} for user {user.id}: {e}")
        return jsonify({"error": "Failed to disconnect integration"}), 500

@app.route('/api/sessions', methods=['GET'])
async def get_user_sessions():
    user, error = await get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]

    try:
        # Supabase calls must be awaited
        response = await supabase_client.from_('ai_os_sessions') \
            .select('session_id, created_at, memory') \
            .eq('user_id', str(user.id)) \
            .order('created_at', desc=True) \
            .limit(50) \
            .execute()
        return jsonify(response.data), 200
    except Exception as e:
        logger.error(f"Failed to get sessions for user {user.id}: {e}")
        return jsonify({"error": "Failed to retrieve session history"}), 500

@app.route('/api/generate-upload-url', methods=['POST'])
async def generate_upload_url():
    user, error = await get_user_from_token(request)
    if error:
        return jsonify({"error": error[0]}), error[1]

    data = await request.get_json()
    file_name = data.get('fileName')
    if not file_name:
        return jsonify({"error": "fileName is required"}), 400

    file_path = f"{user.id}/{file_name}"
    
    try:
        # Supabase calls must be awaited
        upload_details = await supabase_client.storage.from_('media-uploads').create_signed_upload_url(file_path)
        response_data = {
            "signedURL": upload_details['signed_url'],
            "path": upload_details['path']
        }
        return jsonify(response_data), 200
    except Exception as e:
        logger.error(f"Failed to create signed URL for user {user.id}: {e}\n{traceback.format_exc()}")
        return jsonify({"error": "Could not create signed URL"}), 500

async def process_files(files_data: List[Dict[str, Any]]) -> Tuple[List[Image], List[Audio], List[Video], List[File]]:
    """
    This function is now async because it downloads files from Supabase.
    """
    images, audio, videos, other_files = [], [], [], []
    logger.info(f"Processing {len(files_data)} files into agno objects")

    for file_data in files_data:
        file_name = file_data.get('name', 'unnamed_file')
        file_type = file_data.get('type', '')
        
        if 'path' in file_data:
            file_path_in_bucket = file_data['path']
            try:
                # Supabase calls must be awaited
                file_bytes = await supabase_client.storage.from_('media-uploads').download(file_path_in_bucket)
                
                if file_type.startswith('image/'):
                    images.append(Image(content=file_bytes, name=file_name))
                elif file_type.startswith('audio/'):
                    audio.append(Audio(content=file_bytes, format=file_type.split('/')[-1], name=file_name))
                elif file_type.startswith('video/'):
                    videos.append(Video(content=file_bytes, name=file_name))
                else:
                    other_files.append(File(content=file_bytes, name=file_name, mime_type=file_type))
            except Exception as e:
                logger.error(f"Error downloading file from Supabase Storage at path {file_path_in_bucket}: {str(e)}")
            continue

        if file_data.get('isText') and 'content' in file_data:
            try:
                content_bytes = file_data['content'].encode('utf-8')
                file_obj = File(content=content_bytes, name=file_name, mime_type=file_type)
                other_files.append(file_obj)
            except Exception as e:
                logger.error(f"Error creating File object for {file_name}: {e}")
            continue

    return images, audio, videos, other_files

# This new route replaces all the `@socketio.on` decorators.
@app.websocket('/ws')
async def ws():
    sid = str(uuid.uuid4()) # Generate a unique ID for this connection
    logger.info(f"Client connected with SID: {sid}")
    await websocket.send_json({"message": "Connected to server"})

    try:
        # This loop runs as long as the client is connected.
        async for data_str in websocket:
            user = None
            try:
                data = json.loads(data_str)
                access_token = data.get("accessToken")
                if not access_token:
                    await websocket.send_json({"message": "Authentication token is missing. Please log in again.", "reset": True})
                    continue
                try:
                    user_response = await supabase_client.auth.get_user(jwt=access_token)
                    user = user_response.user
                    if not user:
                        raise AuthApiError("User not found for the provided token.", 401)
                    logger.info(f"Request authenticated for user: {user.id}")
                except AuthApiError as e:
                    logger.error(f"Invalid token for SID {sid}: {e.message}")
                    await websocket.send_json({"message": "Your session has expired. Please log in again.", "reset": True})
                    continue
                    
                message = data.get("message", "")
                context = data.get("context", "")
                files = data.get("files", [])
                is_deepsearch = data.get("is_deepsearch", False)

                if data.get("type") == "terminate_session":
                    await connection_manager.terminate_session(sid)
                    await websocket.send_json({"message": "Session terminated"})
                    continue
                    
                session_data = connection_manager.get_session(sid)
                if not session_data:
                    config = data.get("config", {})
                    agent = connection_manager.create_session(
                        sid, user_id=str(user.id), config=config, ws=websocket, is_deepsearch=is_deepsearch
                    )
                else:
                    agent = session_data["agent"]
                    
                message_id = data.get("id") or str(uuid.uuid4())
                isolated_assistant = connection_manager.isolated_assistants.get(sid)
                if not isolated_assistant:
                    await websocket.send_json({"message": "Session error. Starting new chat...", "reset": True})
                    await connection_manager.terminate_session(sid)
                    continue
                isolated_assistant.message_id = message_id
                
                # Process files asynchronously
                images, audio, videos, other_files = await process_files(files)
                
                turn_context = {
                    "user_message": message,
                    "images": images,
                    "audio": audio,
                    "videos": videos,
                    "files": other_files,
                }

                if agent.team_session_state is None:
                    agent.team_session_state = {}
                agent.team_session_state['turn_context'] = turn_context
                logger.info(f"Injected turn_context into team_session_state for SID {sid}")

                # Launch the agent's execution as a background task so it doesn't block the websocket.
                asyncio.create_task(isolated_assistant.arun_safely(
                    agent, message, user=user, context=context,
                    images=images or None, 
                    audio=audio or None, 
                    videos=videos or None,
                    files=other_files or None
                ))

            except Exception as e:
                logger.error(f"Error in message handler: {e}\n{traceback.format_exc()}")
                await websocket.send_json({"message": "AI service error. Starting new chat...", "reset": True})
                await connection_manager.terminate_session(sid)
    finally:
        # This block runs when the client disconnects.
        logger.info(f"Client disconnected: {sid}")
        await connection_manager.remove_session(sid)


@app.route('/healthz', methods=['GET'])
async def health_check():
    return "OK", 200

# The `if __name__ == "__main__"` block is no longer the primary way to run the app.
# You will now use an ASGI server like Uvicorn from the command line.
# For example: `uvicorn app:app --host 0.0.0.0 --port 8765`
# This is configured in your updated Dockerfile.