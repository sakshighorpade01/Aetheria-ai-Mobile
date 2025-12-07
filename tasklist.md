Of course. Here is a detailed prompt designed to transfer the complete context and understanding we have established. An AI or developer reading this should be able to grasp the project's history, goals, architectural decisions, and the specific implementation path you have chosen.

Project Brief: Implementing Hybrid File Persistence for AI-OS

1. Executive Summary & High-Level Goal

The primary objective is to implement a robust, long-term storage solution for file attachments within the AI-OS Electron application. The current system relies on cloud storage (Supabase) for file processing, but this lacks a permanent archival strategy. The new architecture will establish the user's local machine as the permanent source of truth for all attachments, while still leveraging the cloud for immediate, in-run processing. This hybrid model prioritizes user data ownership, privacy, and long-term data durability.

2. Core Architectural Decision: The "Decoupled Metadata" Model

After analyzing several approaches, we have committed to a "Decoupled Metadata" architecture.

Rationale: This model was chosen specifically to minimize modifications to the existing Python backend and the Agno framework's agent logic. The backend will remain unaware of the long-term local storage, ensuring a clean separation of concerns.

Mechanism: The frontend (Electron app) will be responsible for managing both the local file archive and a separate metadata table in the Supabase database. The backend's role is limited to processing files for the current run only.

3. System Components & Their Defined Roles

Frontend (Electron Application): The "Archive & Metadata Manager"

Saves a permanent copy of every attached file to the user's local application data directory.

For each new message, uploads a temporary copy of the file(s) to Supabase Storage for immediate backend processing.

Directly writes metadata (linking the conversation's session_id to the local file's relativePath) into a new, dedicated attachment table in the Supabase database.

When viewing past conversations, it reads from the attachment table to find and display locally stored files.

When re-using a past conversation as context, it reads the local files and re-initiates the attachment process for the new conversation.

Backend (Python / Agno Framework): The "Stateless Processor"

Its role is purely computational for the current run. It receives a temporary Supabase path, downloads the file, and passes the content to the AI agent.

It has no knowledge of the long-term local archive or the new attachment table. Its logic will not be modified.

Database (Supabase): The "Dual Registrar"

agno_sessions Table: Continues to be managed exclusively by the Agno framework, storing conversation text and run history. We will not modify this table's schema or its data directly.

attachment Table (New): A new, separate table that acts as the index linking a session_id to its corresponding set of locally archived files. This table will be written to and read from directly by the frontend.

4. Detailed Step-by-Step Implementation Plan

Phase 1: Database Setup & Security

Define attachment Table Schema: Create a new table named attachment in Supabase with columns: id (UUID, Primary Key), created_at (timestamptz), session_id (text), user_id (UUID), and metadata (JSONB).

Enable Row Level Security (RLS): Activate RLS on the new attachment table.

Implement RLS Policies: Create SELECT, INSERT, and DELETE policies that restrict access to rows where auth.uid() = user_id. This is the core security mechanism that allows the frontend to safely interact with the table.

Phase 2: Frontend - Archival & Metadata Persistence

Implement a Local File Archiving Service: Create a utility within the Electron app to handle saving files to a dedicated attachments folder in the app's userData directory. This service should manage creating unique subdirectories for each file to prevent name collisions and return a relative path for storage.

Update the File Attachment Flow: In add-files.js, when a file is attached, the logic must perform three actions: generate a unique ID for the file, save it locally using the archiving service, and upload it to Supabase for the current run.

Update the Message Sending Flow: In chat.js, when a message is sent, use the Supabase JS client to insert the local file metadata (including the session_id and user_id) into the new attachment table. The payload sent to the Python backend socket remains unchanged.

Phase 3: Frontend - Context Retrieval & Display

Enhance Session History Loading: In context-handler.js, after fetching the list of sessions, perform a second query to the attachment table to identify which of those sessions have associated files. Display a visual indicator (e.g., a paperclip icon) on those sessions in the UI.

Implement Detailed History View: When a user opens a past conversation, query the attachment table for that session_id. Use the returned metadata and the local file archiving service to display the files and provide functionality to open them locally.

Phase 4: Frontend - Re-using Attachments as New Context

Modify "Use Context" Logic: When a user selects a past session with attachments, the frontend will query the attachment table, find the local files using the stored relative paths, and programmatically trigger the file attachment handler for the new chat. This effectively re-attaches the files, starting the entire process over for the new session.

5. Key Constraints and Explicit Design Decisions

The following points are non-negotiable constraints based on our discussion and must be adhered to:

No Backend Agent Logic Changes: The core Python code in agent_runner.py and the Agno framework's processing flow must not be altered.

No cleanup_job.py: There will be no automated job to delete files from Supabase Storage. Files will persist in the cloud, serving as a redundant backup.

Orphaned Data Cleanup is Deferred: The logic to handle the deletion of attachment metadata when a session is deleted will be implemented at a later stage.

Performance on Re-use is Accepted: The inefficiency of re-uploading files to Supabase when using them as context is an accepted trade-off for architectural simplicity.

Frontend Manages the attachment Table: All INSERT and SELECT operations on the new attachment table are the responsibility of the Electron frontend.

Your task is to fully internalize this project brief. You should now have the complete context, including the architectural goals, the specific implementation chosen, the reasoning behind that choice, and the key constraints. Be prepared to answer questions, generate code snippets for specific phases, or review an implementation against this plan.