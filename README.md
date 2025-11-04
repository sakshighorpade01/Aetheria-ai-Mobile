# Aetheria AI - Intelligent Multi-Agent Desktop & Mobile Assistant

[![Version](https://img.shields.io/badge/version-1.0.5-blue.svg)](https://github.com/yourusername/aetheria-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-orange.svg)](https://web.dev/progressive-web-apps/)

**Aetheria AI** is a powerful, extensible AI assistant that seamlessly bridges desktop and mobile experiences. Originally built as an Electron desktop application, it has evolved into a Progressive Web App (PWA) that brings advanced AI capabilities to any device with a web browser.

---

## 🌟 Overview

Aetheria AI is a sophisticated multi-agent system that combines:
- **Hierarchical AI Architecture**: Coordinator agents delegate tasks to specialized sub-agents
- **Multi-Modal Support**: Process text, images, PDFs, audio, video, and documents
- **Real-Time Streaming**: See AI responses as they're generated
- **Context Management**: Load previous conversations as context for new queries
- **Tool Integration**: Web search, code execution, file operations, GitHub, Google services, and more
- **Cross-Platform**: Desktop (Electron) and Mobile/Web (PWA) with shared backend

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Electron Desktop App          │    PWA (Mobile/Web)        │
│  - Native OS integration        │    - Service Worker        │
│  - File system access           │    - Offline support       │
│  - Browser automation           │    - Installable           │
└─────────────────────────────────────────────────────────────┘
                            │
    *   **DeepSearch:** Provides in-depth research capabilities, combining knowledge base search, web search (DuckDuckGo), and tool/assistant delegation. Powered by Gemini (`deepsearch.py`).
    *   **Web Crawler:** Extracts and summarizes information from provided URLs (`assistant.py`, `Crawl4aiTools`).
    *   **Investment Assistant:** Generates investment reports for given stock symbols using YFinanceTools (`assistant.py`).
    *   **Python Assistant:** Writes and executes Python code, with support for installing pip packages (`assistant.py`, `PythonTools`).
*   **Tool Integration:**
    *   **Calculator:** Performs mathematical calculations.
    *   **DuckDuckGo Search:** Retrieves information from the web.
    *   **YFinanceTools:** Accesses financial data (stock prices, company info, news, analyst recommendations).
    *   **Shell Tools:** Executes shell commands for file system and system operations.
    *   **Crawl4aiTools:** Used by the Web Crawler for web content extraction.
    *   **Python Tools:** Executes Python code.
*   **Context Management:**
    *   Load and utilize previous chat sessions as context (`context-handler.js`).
    *   Select and combine multiple sessions to create a richer context.
    *   View selected context (sessions and files) in a unified sidebar (`chat.js` - `UnifiedPreviewHandler`).
    *   Automatic synchronization of chat sessions using `context_manager.py`.
*   **File Attachments:**
    *   Attach various file types (text, images, PDFs, documents, audio, video) (`add-files.js`).
    *   Automatic text extraction from PDFs (using PDF.js).
    *   OCR (Optical Character Recognition) for images (using Tesseract.js).
    *   Preview attached files and extracted text in the unified context viewer.
    *   Placeholder implementations for document, audio, and video transcription.
*   **To-Do List:** Manage tasks directly within the application, with features for descriptions, priorities, deadlines, and tags (`to-do-list.js`, `to-do-list.html`, `to-do-list.css`).
*   **User Context:** Customize AI-OS behavior with user preferences and system access settings (`to-do-list.js` - context modal).
*   **AIOS Settings:** Manage profile information, account actions (logout, delete), view application info, and submit support requests (`aios.js`, `aios.html`, `aios.css`).
*   **Long-Term Memory (Optional):**
    *   Enable persistent memory using an SQLite database (`agent_memory.db`).
    *   Includes memory classification and summarization (using Groq).
    *   Searchable knowledge base (`search_knowledge_base` tool).
*   **Streamed Responses:** See responses generated in real-time.
*   **Code and Diagram Viewers:**
    *   View code snippets with syntax highlighting (using highlight.js) (`artifact-handler.js`, `artifact-ui.css`).
    *   Render Mermaid diagrams.
    *   Copy code/diagrams to clipboard.
    *   Download code/diagrams as files (using Electron IPC for save dialog).
*   **Dark Mode:** A visually appealing dark theme is enabled by default (toggleable via window controls).
*   **Error Handling & Reconnection:** Robust error handling for the Python backend connection (`python-bridge.js`).
*   **Window Controls:** Standard minimize, maximize/restore, and close controls.

## Architecture

AI-OS utilizes a client-server architecture:

*   **Frontend (Electron.js):** Built with HTML, CSS, and JavaScript. Provides the user interface, manages application windows, handles user input, displays formatted responses (Markdown, code, diagrams), and communicates with the backend.
*   **Backend (Python):** A Flask-SocketIO server (`app.py`) manages agent sessions (`assistant.py`, `deepsearch.py`), handles LLM interactions (using `phi-agent`, Gemini, Groq), executes tools, and manages optional memory.
*   **Communication:** Real-time, bidirectional communication between the frontend and backend is handled via Socket.IO, managed by `python-bridge.js` in the Electron main process.

## Prerequisites

*   **Python 3.7+:** Required for the backend server and agents.
*   **Node.js and npm:** Required for the Electron.js frontend and JavaScript dependencies.
*   **pip:** Python's package installer.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <your_repository_url>
    cd <repository_name>
    ```

2.  **Install Python dependencies:**
    It's highly recommended to use a virtual environment:
    ```bash
    # Create and activate virtual environment (example for Linux/macOS)
    python3 -m venv aios_env
    source aios_env/bin/activate
    # On Windows: aios_env\Scripts\activate

    # Install dependencies
    pip install -r requirements.txt # Ensure requirements.txt is in the root or adjust path
    # Or if requirements are in python-backend:
    # pip install -r python-backend/requirements.txt
    ```

3.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

4.  **Create necessary directories (if they don't exist):**
    The application might require specific directories at runtime. Based on the code, ensure the following exist in the project root:
    ```bash
    mkdir -p tmp/agent_sessions_json
    mkdir -p context
    mkdir -p userData # Used by aios.js
    ```
    *(Adjust paths based on actual implementation if needed)*

## Usage

### Starting the Application

```bash
npm start
```

This command launches the Electron application. The Python backend server (`app.py`) should start automatically, managed by `python-bridge.js`.

### Chat Interface

*   **Send Messages:** Type your message in the input field at the bottom and press Enter or click the send button.
*   **New Chat:** Click the "+" button to start a new conversation, clearing history and resetting the agent state.
*   **Minimize Chat:** Click the minimize button ("-") in the chat window header.

### Tools and Capabilities

*   **Memory (Brain Icon):** Toggles the use of long-term memory (requires `use_memory=True` in agent configuration).
*   **Context (Network Icon):** Opens the context management window.
*   **Tasks (List Icon):** Toggles the inclusion of `user_context.txt` and `tasklist.txt` in the agent's context.

### Context Management

1.  Click the "Context" icon in the chat tools area to open the session list.
2.  **Sync Sessions:** Click the sync button (refresh icon) to process recent agent interactions (`tmp/agent_sessions_json`) into loadable context files (`context/`).
3.  **Select Sessions:** Check the boxes next to the sessions you want to use as context.
4.  **Use Selected:** Click "Use Selected". The chosen sessions will provide context for the *next* message sent in a *new* chat session.
5.  **Clear Selection:** Click "Clear" to deselect all sessions.
6.  **View Details:** Click on a session item to see the conversation history within that session.
7.  **View Selected Context:** Click the "Context" indicator above the chat input (visible when context is selected) or use the unified viewer sidebar to see the content of selected sessions and files.

### File Attachments

1.  Click the "Attach" button (paperclip icon) in the input area.
2.  Select one or more files. Supported types include text, PDF, images, etc. (see `add-files.js` for details).
3.  Text content is automatically extracted where possible (plain text, PDF text, image OCR).
4.  Attached files and their extracted text (if any) are sent with the *next* message.
5.  View attached files and previews in the "Files" tab of the unified context viewer sidebar.

### To-Do List

1.  Click the "Tasks" icon (list icon) in the main taskbar to open the To-Do List window.
2.  **Add Task:** Click the "+" button, fill in the details (name required, others optional) in the modal, and click "Add Task".
3.  **Manage Tasks:** Check boxes to mark complete, click the trash icon to delete.
4.  **User Context:** Click the user-cog icon to open the User Context modal. Fill in personal details, preferences, capabilities, goals, and system access settings. This data is saved to `user_context.txt` and can be used by the agent when the "Tasks" toggle is active.

### AIOS Settings

1.  Click the "AIOS" icon (atom icon) in the main taskbar.
2.  Navigate through the tabs (Profile, Account, About, Support) to manage settings, view information, or submit feedback.
3.  Profile changes are saved locally (`userData/profile.json`).
4.  Support submissions are saved locally (`userData/feedback.json`).

## Key Components

*   **`main.js`:** Electron main process logic, window creation, IPC handling, BrowserView management.
*   **`renderer.js`:** Frontend UI management, state handling (`StateManager`), module loading.
*   **`python-bridge.js`:** Manages the Python backend process lifecycle and Socket.IO communication bridge.
*   **`chat.js`:** Core chat UI logic, message sending/receiving, tool/context integration.
*   **`add-files.js`:** File attachment handling, text extraction (PDF, OCR).
*   **`context-handler.js`:** Logic for loading, selecting, and viewing chat session context.
*   **`artifact-handler.js`:** Displays code and Mermaid diagrams in a dedicated viewer.
*   **`to-do-list.js`:** Functionality for the To-Do list and User Context management.
*   **`aios.js`:** Logic for the AIOS settings window.
*   **`python-backend/app.py`:** Flask-SocketIO server, session management, agent interaction entry point.
*   **`python-backend/assistant.py`:** Defines the main AI-OS agent, tools, and team configuration.
*   **`python-backend/deepsearch.py`:** Defines the DeepSearch agent configuration.
*   **`python-backend/context_manager.py`:** Utility script to process raw agent session logs into usable context files.

## Dependencies

### Frontend (Node.js / Electron)

*   **Electron:** Core framework for desktop application.
*   **socket.io-client:** Real-time communication with the backend.
*   **highlight.js / prismjs:** Syntax highlighting for code blocks.
*   **mermaid:** Rendering Mermaid diagrams.
*   **marked:** Markdown parsing.
*   **DOMPurify:** HTML sanitization.
*   **pdf.js (mozilla):** PDF parsing and text extraction.
*   **tesseract.js:** OCR for images.

### Backend (Python)

*   **Flask / Flask-SocketIO / eventlet:** Web server and real-time communication.
*   **phi-agent:** Core AI agent library (likely custom or internal).
*   **langchain-google-genai:** Google Gemini LLM integration.
*   **groq:** Groq LLM integration.
*   **browser-use:** Library for browser automation (used by `browser_agent.py`).
*   **duckduckgo-search:** Tool for web search.
*   **yfinance:** Tool for financial data.
*   **python-dotenv:** Environment variable management.
*   *(See `requirements.txt` for a full list)*

## Contributing

Contributions are welcome! Please follow standard Git workflow practices:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## Troubleshooting

*   **Python server fails to start:**
    *   Ensure all Python dependencies (`requirements.txt`) are installed in the correct virtual environment.
    *   Check console logs (`npm start` output) for specific Python errors.
    *   Verify that port 8765 is not already in use.
    *   Try running `python python-backend/app.py` directly to isolate backend issues.
*   **Socket.IO connection issues:**
    *   Confirm the Python server (`app.py`) is running.
    *   Check for firewall issues blocking port 8765.
    *   Look for "Connection error" messages in the UI or console. Use the "Retry Connection" button if it appears.

*   **Context not loading:** Run the sync script (`python python-backend/context_manager.py`) to process session logs.
*   **UI Glitches:** Use Electron's Developer Tools (Ctrl+Shift+I or Cmd+Option+I) to inspect elements and check the console for JavaScript errors.

## License

Distributed under the MIT License. See `LICENSE` for more information. (Note: You need to add a LICENSE file).

## Roadmap

*   **Improved User Context Management:** UI for editing/deleting context files, keyword search within context.
*   **Enhanced Task Management:** Subtasks, recurring tasks, potential calendar integration.
*   **Agent Customization:** UI for users to define custom agents, tools, and prompts.
*   **Plugin System:** Allow third-party extensions.
*   **Voice Input/Output:** Integrate speech-to-text and text-to-speech.
*   **Knowledge Base Editor:** UI for managing the agent's long-term memory/knowledge base.
*   **Testing:** Implement comprehensive unit and integration tests.
*   **Cloud Sync:** Option to sync tasks, settings, and context.
