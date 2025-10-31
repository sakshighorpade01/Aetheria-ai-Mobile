import os
import json
from pathlib import Path
import re

def sanitize_filename(text):
    """
    Convert text into a valid filename by:
    1. Taking first 50 characters
    2. Removing invalid filename characters
    3. Converting spaces to underscores
    """
    if not text:
        return "unknown_session"
    
    # Take first 50 chars and remove invalid filename characters
    text = text[:50]
    # Replace invalid characters with underscore
    text = re.sub(r'[<>:"/\\|?*]', '_', text)
    # Replace spaces with underscore
    text = text.replace(' ', '_')
    # Remove multiple underscores
    text = re.sub(r'_+', '_', text)
    # Remove leading/trailing underscores
    text = text.strip('_')
    
    return text or "unknown_session"

def get_existing_session_ids(context_folder):
    """
    Scan the context folder and return a set of all existing session IDs
    """
    existing_ids = set()
    
    # Create context directory if it doesn't exist
    context_folder.mkdir(parents=True, exist_ok=True)
    
    # Read all JSON files in the context folder
    for file_path in context_folder.glob("*.json"):
        try:
            with file_path.open('r', encoding='utf-8') as f:
                data = json.load(f)
                if "session_id" in data:
                    existing_ids.add(data["session_id"])
        except Exception as e:
            print(f"Warning: Could not read {file_path}: {str(e)}")
            
    return existing_ids

def deduplicate_llm_outputs(outputs):
    """
    Remove duplicate LLM outputs while preserving order
    """
    seen = set()
    unique_outputs = []
    for output in outputs:
        if output not in seen:
            seen.add(output)
            unique_outputs.append(output)
    return unique_outputs

def extract_conversation_data(base_dir):
    """
    Extract conversation data from JSON files and save each session
    to a separate JSON file in the context folder.
    """
    # Setup paths relative to the script location
    base_path = Path(base_dir)
    input_folder = base_path / "tmp" / "agent_sessions_json"
    context_folder = base_path / "context"
    
    # Get existing session IDs from context folder
    existing_ids = get_existing_session_ids(context_folder)
    print(f"Found {len(existing_ids)} existing sessions in context folder")
    
    # Process each JSON file
    if not input_folder.exists():
        raise FileNotFoundError(f"Input folder not found: {input_folder}")
    
    new_sessions = 0
    skipped_sessions = 0
        
    for file_path in input_folder.glob("*.json"):
        try:
            with file_path.open('r', encoding='utf-8') as f:
                data = json.load(f)
                
            session_id = data.get("session_id")
            if not session_id:
                continue
                
            # Skip if session already exists in context folder
            if session_id in existing_ids:
                skipped_sessions += 1
                continue
                
            interactions = []
            first_user_input = None
            
            for run in data.get("memory", {}).get("runs", []):
                user_msg = run.get("message", {}).get("content")
                if user_msg and first_user_input is None:
                    first_user_input = user_msg
                    
                llm_outputs = []
                
                # Get main response
                response = run.get("response", {})
                if response.get("content"):
                    llm_outputs.append(response["content"])
                
                # Get additional model responses
                for msg in response.get("messages", []):
                    if msg.get("role") == "model" and msg.get("content"):
                        llm_outputs.append(msg["content"])
                
                # Deduplicate LLM outputs
                llm_outputs = deduplicate_llm_outputs(llm_outputs)
                
                if user_msg or llm_outputs:
                    interactions.append({
                        "user_input": user_msg,
                        "llm_output": llm_outputs
                    })
            
            if interactions:
                # Create session data
                session_data = {
                    "session_id": session_id,
                    "file_path": str(file_path),
                    "interactions": interactions
                }
                
                # Generate filename from first user input
                filename = sanitize_filename(first_user_input)
                if not filename.endswith('.json'):
                    filename = f"{filename}.json"
                
                # Ensure filename uniqueness
                output_path = context_folder / filename
                counter = 1
                while output_path.exists():
                    base_name = filename[:-5]  # Remove .json
                    output_path = context_folder / f"{base_name}_{counter}.json"
                    counter += 1
                
                # Save session data to individual file
                with output_path.open('w', encoding='utf-8') as f:
                    json.dump(session_data, f, indent=2, ensure_ascii=False)
                
                new_sessions += 1
                print(f"Saved new session to: {output_path}")
                
        except Exception as e:
            print(f"Error processing {file_path}: {str(e)}")
    
    print(f"\nExtraction completed:")
    print(f"- New sessions processed: {new_sessions}")
    print(f"- Sessions skipped (already exist): {skipped_sessions}")
    print(f"- Results saved in: {context_folder}")

if __name__ == "__main__":
    # Use the parent directory of the script location as base directory
    script_dir = Path(__file__).parent
    base_dir = script_dir.parent
    
    try:
        extract_conversation_data(base_dir)
    except Exception as e:
        print(f"Error: {str(e)}")