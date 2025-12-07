# python-backend/agent_runner.py (Corrected for Dependency Injection)

import logging
import json
import traceback
from typing import Dict, Any, List, Tuple
from redis import Redis

# --- Local Module Imports ---
from extensions import socketio
from assistant import get_llm_os
from supabase_client import supabase_client
from session_service import ConnectionManager

# --- Agno Framework Imports ---
from agno.media import Image, Audio, Video, File
from agno.run.agent import RunEvent
from agno.run.team import TeamRunEvent, TeamRunOutput

logger = logging.getLogger(__name__)


def process_files(files_data: List[Dict[str, Any]]) -> Tuple[List[Image], List[Audio], List[Video], List[File]]:
    """
    Processes a list of file data from the frontend, downloading media from
    Supabase storage or encoding text content, and converting them into
    Agno media objects.
    """
    images, audio, videos, other_files = [], [], [], []
    if not files_data:
        return images, audio, videos, other_files

    for file_data in files_data:
        file_name = file_data.get('name', 'untitled')
        file_type = file_data.get('type', 'application/octet-stream')

        if 'path' in file_data:
            try:
                file_bytes = supabase_client.storage.from_('media-uploads').download(file_data['path'])
                
                if file_type.startswith('image/'):
                    images.append(Image(content=file_bytes, name=file_name))
                elif file_type.startswith('audio/'):
                    audio.append(Audio(content=file_bytes, format=file_type.split('/')[-1], name=file_name))
                elif file_type.startswith('video/'):
                    videos.append(Video(content=file_bytes, name=file_name))
                else:
                    other_files.append(File(content=file_bytes, name=file_name, mime_type=file_type))
            except Exception as e:
                logger.error(f"Supabase file download failed ({file_name}): {e}")
        
        elif file_data.get('isText') and 'content' in file_data:
            other_files.append(File(content=file_data['content'].encode('utf-8'), name=file_name, mime_type=file_type))

    return images, audio, videos, other_files


def run_agent_and_stream(
    sid: str,
    conversation_id: str,
    message_id: str,
    turn_data: dict,
    context_session_ids: List[str],
    connection_manager: ConnectionManager,
    redis_client: Redis
):
    """
    Orchestrates a full agent run, ensuring all real-time tools receive the
    necessary per-request dependencies for communication.
    """
    try:
        # 1. Retrieve Session and User Data
        session_data = connection_manager.get_session(conversation_id)
        if not session_data:
            raise Exception(f"Session not found: {conversation_id}")
        user_id = session_data['user_id']

        # Create realtime tool config for browser and image tools
        realtime_tool_config = {
            'socketio': socketio,
            'sid': sid,
            'message_id': message_id,
            'redis_client': redis_client
        }

        # 2. Initialize the Agent
        agent = get_llm_os(
            user_id=user_id,
            session_info=session_data,
            custom_tool_config=realtime_tool_config,
            **session_data['config']
        )

        # 3. Process Input Data
        images, audio, videos, other_files = process_files(turn_data.get('files', []))
        
        # Log media processing if files were attached
        total_files = len(images) + len(audio) + len(videos) + len(other_files)
        if total_files > 0:
            logger.info(f"{sid[:8]} | Files: {total_files} (img={len(images)}, aud={len(audio)}, vid={len(videos)}, doc={len(other_files)})")
        
        current_session_state = {'turn_context': turn_data}
        user_message = turn_data.get("user_message", "")
        
        # 4. Fetch and Prepend Historical Context
        historical_context_str = ""
        if context_session_ids:
            logger.info(f"{sid[:8]} | Loading context: {len(context_session_ids)} sessions")
            historical_context_str = "CONTEXT FROM PREVIOUS CHATS:\n---\n"
            for session_id in context_session_ids:
                try:
                    response = supabase_client.from_('agno_sessions').select('runs').eq('session_id', session_id).single().execute()
                    if response.data and response.data.get('runs'):
                        runs = response.data['runs']
                        top_level_runs = [run for run in runs if not run.get('parent_run_id')]
                        for run in top_level_runs:
                            user_input = run.get('input', {}).get('input_content', '')
                            assistant_output = run.get('content', '')
                            if user_input:
                                historical_context_str += f"User: {user_input}\nAssistant: {assistant_output}\n---\n"
                except Exception as e:
                    logger.error(f"{sid[:8]} | Supabase context fetch failed: {e}")
            historical_context_str += "\n"
        
        final_user_message = f"{historical_context_str}CURRENT QUESTION:\n{user_message}" if historical_context_str else user_message

        # 5. Run the Agent and Stream Results
        run_output: TeamRunOutput | None = None
        for chunk in agent.run(
            input=final_user_message,
            images=images or None,
            audio=audio or None,
            videos=videos or None,
            files=other_files or None,
            session_id=conversation_id,
            session_state=current_session_state,
            stream=True,
            stream_intermediate_steps=True,
            add_history_to_context=True
        ):
            if not chunk or not hasattr(chunk, 'event'):
                continue

            if isinstance(chunk, TeamRunOutput):
                run_output = chunk

            owner_name = getattr(chunk, 'agent_name', None) or getattr(chunk, 'team_name', None)

            if chunk.event in (RunEvent.run_content.value, TeamRunEvent.run_content.value):
                is_final = owner_name == "Aetheria_AI" and not getattr(chunk, 'member_responses', [])
                socketio.emit("response", {"content": chunk.content, "streaming": True, "id": message_id, "agent_name": owner_name, "is_log": not is_final}, room=sid)
                # Force immediate transmission without buffering
                socketio.sleep(0)
            elif chunk.event in (RunEvent.tool_call_started.value, TeamRunEvent.tool_call_started.value):
                socketio.emit("agent_step", {"type": "tool_start", "name": getattr(chunk.tool, 'tool_name', None), "agent_name": owner_name, "id": message_id}, room=sid)
            elif chunk.event in (RunEvent.tool_call_completed.value, TeamRunEvent.tool_call_completed.value):
                socketio.emit("agent_step", {"type": "tool_end", "name": getattr(chunk.tool, 'tool_name', None), "agent_name": owner_name, "id": message_id}, room=sid)

        # 6. Finalize the Stream and Log Metrics
        socketio.emit("response", {"done": True, "id": message_id}, room=sid)
        logger.info(f"{sid[:8]} | Message sent")
        
        if run_output and run_output.metrics and (run_output.metrics.input_tokens > 0 or run_output.metrics.output_tokens > 0):
            try:
                supabase_client.from_('request_logs').insert({
                    'user_id': user_id,
                    'input_tokens': run_output.metrics.input_tokens,
                    'output_tokens': run_output.metrics.output_tokens
                }).execute()
                logger.info(f"{sid[:8]} | Supabase: Logged tokens (in={run_output.metrics.input_tokens}, out={run_output.metrics.output_tokens})")
            except Exception as db_error:
                logger.error(f"{sid[:8]} | Supabase token log failed: {db_error}")

    except Exception as e:
        logger.error(f"{sid[:8]} | Agent error: {str(e)}")
        socketio.emit("error", {"message": f"An error occurred: {str(e)}. Your conversation is preserved."}, room=sid)
    
    finally:
        # CRITICAL: Clean up media objects to prevent memory leaks
        try:
            cleanup_count = 0
            
            # Clear media object references
            if 'images' in locals() and images:
                count = len(images)
                for img in images:
                    if hasattr(img, 'content'):
                        img.content = None
                images.clear()
                cleanup_count += count
            
            if 'audio' in locals() and audio:
                count = len(audio)
                for aud in audio:
                    if hasattr(aud, 'content'):
                        aud.content = None
                audio.clear()
                cleanup_count += count
            
            if 'videos' in locals() and videos:
                count = len(videos)
                for vid in videos:
                    if hasattr(vid, 'content'):
                        vid.content = None
                videos.clear()
                cleanup_count += count
            
            if 'other_files' in locals() and other_files:
                count = len(other_files)
                for file in other_files:
                    if hasattr(file, 'content'):
                        file.content = None
                other_files.clear()
                cleanup_count += count
            
            # Clear agent reference to allow garbage collection
            if 'agent' in locals():
                agent = None
            
            # Only log if we actually cleaned up media
            if cleanup_count > 0:
                logger.info(f"{sid[:8]} | Cleaned {cleanup_count} media objects")
            
        except Exception as cleanup_error:
            logger.error(f"{sid[:8]} | Cleanup error: {cleanup_error}")