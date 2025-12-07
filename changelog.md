# Changelog

All notable changes to AI-OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - Hybrid File Persistence System

#### 🎯 Overview
Implemented a comprehensive hybrid file persistence architecture that provides permanent local storage for all file attachments while maintaining cloud processing capabilities. This ensures user data ownership, long-term durability, and the ability to access historical attachments across sessions.

#### 🏗️ Architecture
- **Decoupled Metadata Model**: Frontend manages file lifecycle, backend remains stateless
- **Dual-Storage Strategy**: Local filesystem (permanent) + Supabase Storage (temporary processing)
- **Database Layer**: New `attachment` table with Row Level Security (RLS) policies

#### ✨ Features

##### 1. Local File Archive Service (`js/preload.js`)
- **`saveFile(file)`**: Saves files to `userData/attachments` with unique UUID directories
- **`resolvePath(relativePath)`**: Converts relative paths to absolute system paths
- **`readFile(relativePath)`**: Reads file contents from local archive
- **`fileExists(relativePath)`**: Checks file availability in local storage
- **`openFile(relativePath)`**: Opens files with system default application

##### 2. Dual-Storage File Handling (`js/add-files.js`)
- All files now save to local archive first (permanent copy)
- Media files upload to Supabase for AI processing (temporary)
- Text files read content locally for immediate use
- Each file receives unique `file_id` and `relativePath` for tracking
- Status indicators: `archiving` → `uploading`/`reading` → `completed`

##### 3. Smart Metadata Persistence (`js/chat.js`)
- Metadata stored temporarily during message sending
- **Persists to database only after successful AI response completion**
- Handles edge cases:
  - ✅ User clicks "New Chat" before AI responds
  - ✅ Session terminated for any reason
  - ✅ Window closed or app quit
  - ✅ Page refresh or navigation
- `persistAttachmentMetadata()` function with error handling
- Non-blocking operation (won't prevent message sending on failure)

##### 4. Enhanced Session Management (`js/auth-service.js`)
- **`fetchSessionTitles()`**: Now checks for attachments and adds `has_attachments` flag
- **`fetchSessionAttachments(sessionId)`**: Retrieves attachment metadata for specific session
- **`insertAttachments(records)`**: Secure method to persist attachment metadata via RLS

##### 5. Context Re-use System (`js/context-handler.js`)
- **Automatic File Re-attachment**: When selecting previous sessions as context
  1. Fetches attachment metadata from database
  2. Checks local file availability
  3. Reads files from local storage
  4. Creates File objects from buffer data
  5. Programmatically triggers attachment flow
  6. Re-uploads to Supabase for new AI run
  7. Saves new metadata for current session
- **`reattachSessionFiles(sessions)`**: Orchestrates the re-attachment process
- **`programmaticallyAttachFile(file)`**: Simulates user file selection
- Visual feedback with success notifications

##### 6. Rich UI Enhancements (`css/attachments.css`, `js/context-handler.js`)
- **Session List**: Paperclip icons (📎) indicate sessions with attachments
- **Session Details View**:
  - Dedicated attachments section with file count
  - File cards showing name, size, and status
  - Status indicators:
    - ✅ Green checkmark: Available locally
    - ⚠️ Warning icon: File not found
  - "Open" buttons to launch files with system default app
- **Responsive Design**: Mobile-friendly layout with animations
- **Dark Mode Support**: Consistent theming across all attachment UI

##### 7. Database Schema (`supabase_migration_attachment_table.sql`)
```sql
CREATE TABLE attachment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL
);
```

**Metadata Structure**:
```json
{
  "file_id": "uuid-v4",
  "name": "document.pdf",
  "type": "application/pdf",
  "size": 1024000,
  "relativePath": "attachments/uuid/document.pdf",
  "supabasePath": "user-id/uuid/document.pdf",
  "isMedia": true,
  "isText": false
}
```

**Security**:
- Row Level Security (RLS) enabled
- Policies ensure users can only access their own attachments
- SELECT, INSERT, UPDATE, DELETE policies based on `auth.uid() = user_id`

**Indexes**:
- `idx_attachment_session_id`: Fast session-based queries
- `idx_attachment_user_id`: User-specific filtering
- `idx_attachment_created_at`: Chronological sorting

#### 🔧 Technical Implementation

##### Flow Diagram
```
User Attaches File
    ↓
[1] Save to Local Archive (userData/attachments/uuid/)
    ↓
[2] Upload to Supabase Storage (for AI processing)
    ↓
[3] Store metadata temporarily in memory
    ↓
User Sends Message → AI Processes → Response Completes
    ↓
[4] Persist metadata to attachment table
    ↓
✅ File permanently archived locally
✅ Metadata saved in database
✅ Available for future context re-use
```

##### Key Design Decisions
1. **No Backend Modifications**: Python agent logic remains unchanged
2. **Frontend-Managed Metadata**: Direct Supabase client calls with RLS security
3. **Deferred Cleanup**: No automated orphan detection (future enhancement)
4. **Accepted Trade-off**: Re-upload files when re-using context (simplicity over efficiency)
5. **Non-Blocking Persistence**: Metadata save failures don't prevent messaging

#### 📊 Benefits

**For Users**:
- 🏠 **Data Ownership**: Files stored on your machine, not just in cloud
- 🔒 **Privacy**: Local-first approach with optional cloud processing
- 📂 **Permanent Access**: View and open attachments from any past conversation
- 🔄 **Context Continuity**: Automatically re-attach files when referencing old sessions
- 💾 **Redundancy**: Dual storage provides backup protection

**For Developers**:
- 🧩 **Clean Architecture**: Separation of concerns (frontend = archive, backend = processor)
- 🔐 **Secure by Default**: RLS policies prevent unauthorized access
- 🚀 **Scalable**: JSONB metadata allows schema evolution without migrations
- 🛡️ **Resilient**: Handles edge cases and failures gracefully
- 📝 **Maintainable**: Well-documented with clear phase separation

#### 🐛 Bug Fixes
- Fixed Supabase client exposure across context bridge
- Added notification service fallback for error handling
- Resolved race conditions in file processing status updates

#### 🔄 Modified Files
- `js/preload.js` - Added file archive service methods
- `js/add-files.js` - Implemented dual-storage file handling
- `js/chat.js` - Added metadata persistence with edge case handling
- `js/auth-service.js` - Extended with attachment-related methods
- `js/context-handler.js` - Implemented context re-use and file re-attachment
- `css/attachments.css` - New stylesheet for attachment UI components
- `index.html` - Linked attachments.css

#### 📦 New Files
- `css/attachments.css` - Comprehensive styling for attachment system
- `supabase_migration_attachment_table.sql` - Database schema and RLS policies

#### 🔮 Future Enhancements
- Orphaned metadata cleanup when sessions are deleted
- Cross-device file sync via cloud storage
- Attachment search and filtering
- Bulk file operations (download all, delete all)
- File versioning and conflict resolution
- Attachment size analytics and storage management

---

## [1.1.4] - Previous Release

### Features
- Core chat functionality with AI agent integration
- Session management and history
- File attachment support (cloud-only)
- Context window for previous conversations
- Dark mode support
- Electron desktop application

---

## Contributing

When adding entries to this changelog:
1. Group changes by type: Added, Changed, Deprecated, Removed, Fixed, Security
2. Include technical details for developers
3. Explain user-facing benefits
4. Reference issue/PR numbers when applicable
5. Keep entries concise but comprehensive

---

**Legend**:
- 🎯 Major Feature
- ✨ Enhancement
- 🐛 Bug Fix
- 🔒 Security
- 📝 Documentation
- 🔧 Technical Change
