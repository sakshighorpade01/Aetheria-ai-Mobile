// add-files.js (Corrected with proper URL and Race Condition Fix)

class FileAttachmentHandler {
    constructor(socket, supportedFileTypes, maxFileSize) {
        this.supportedFileTypes = supportedFileTypes || {
            // Text files
            'txt': 'text/plain', 'js': 'text/javascript', 'py': 'text/x-python', 'html': 'text/html',
            'css': 'text/css', 'json': 'application/json', 'c': 'text/x-c',
            // Media and Document files
            'pdf': 'application/pdf', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
            'svg': 'image/svg+xml', 'webp': 'image/webp', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
            'ogg': 'audio/ogg', 'm4a': 'audio/mp4', 'mp4': 'video/mp4', 'webm': 'video/webm',
            'avi': 'video/x-msvideo', 'mov': 'video/quicktime', 'mkv': 'video/x-matroska'
        };
        this.maxFileSize = maxFileSize || 50 * 1024 * 1024; // 50MB default
        this.attachedFiles = [];
        this.initialize();
    }

    initialize() {
        this.attachButton = document.getElementById('attach-file-btn');
        this.fileInput = document.getElementById('file-input');
        this.inputContainer = document.getElementById('floating-input-container');
        this.contextFilesBar = document.getElementById('context-files-bar');
        this.contextFilesContent = this.contextFilesBar.querySelector('.context-files-content');

        this.sidebar = document.getElementById('file-preview-sidebar');
        this.previewContent = this.sidebar.querySelector('.file-preview-content');
        this.fileCount = this.sidebar.querySelector('.file-count');

        this.sidebar.classList.add('hidden');
        this.contextFilesBar.classList.add('hidden');

        this.attachButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', async (event) => {
            await this.handleFileSelection(event);
        });

        this.sidebar.querySelector('.close-preview-btn').addEventListener('click', () => {
            this.toggleSidebar(false);
        });

        if (window.conversationStateManager) {
            window.conversationStateManager.setFileHandler(this);
            window.conversationStateManager.init();
        }

        this.updateInputPositioning();
    }

    async uploadFileToSupabase(file) {
        const session = await window.electron.auth.getSession();
        if (!session || !session.access_token) {
            throw new Error("User not authenticated. Please log in again.");
        }

        // --- FIX #1: Use the correct, new backend URL ---
        const response = await fetch('http://localhost:8765/api/generate-upload-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ fileName: file.name })
        });
        // --- END FIX #1 ---

        if (!response.ok) {
            // It's possible the response is not JSON on failure, so handle that gracefully.
            let errorMsg = 'Could not get an upload URL from the server.';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                errorMsg = `${errorMsg} (Status: ${response.status})`;
            }
            throw new Error(errorMsg);
        }

        const responseData = await response.json();
        const signedURL = responseData.signedURL;
        const path = responseData.path;

        if (!signedURL) {
            throw new Error('The server did not return a valid signed URL.');
        }

        const uploadResponse = await fetch(signedURL, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error("Supabase upload error:", errorText);
            throw new Error('File upload to cloud storage failed.');
        }

        return path;
    }

    async handleFileSelection(event) {
        const files = Array.from(event.target.files);
        if (files.length + this.attachedFiles.length > 50) {
            alert("You can attach a maximum of 50 files.");
            return;
        }

        for (const file of files) {
            if (file.size > this.maxFileSize) {
                alert(`File too large: ${file.name} (max size: ${Math.round(this.maxFileSize / 1024 / 1024)}MB)`);
                continue;
            }

            const extension = file.name.split('.').pop().toLowerCase();
            const isSupported = this.supportedFileTypes[extension] || file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/') || file.type === 'application/pdf';

            if (!isSupported) {
                alert(`File type not supported: ${file.name}`);
                continue;
            }

            const fileIndex = this.attachedFiles.length;
            const isMedia = file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/') || file.type === 'application/pdf' || file.type.includes('document');

            // Generate unique file ID for tracking
            const fileId = crypto.randomUUID();

            // Create placeholder with 'archiving' status
            const placeholderFileObject = {
                file_id: fileId,
                name: file.name,
                type: file.type,
                size: file.size,
                previewUrl: URL.createObjectURL(file),
                status: 'archiving', // New status for dual-action
                isMedia: isMedia,
                isText: !isMedia,
                relativePath: null,
                path: null // Supabase path
            };

            this.attachedFiles.push(placeholderFileObject);
            this.renderFilePreview();

            try {
                // STEP 1: Save to local archive (always, for all files)
                console.log(`[FileArchive] Saving ${file.name} to local archive...`);
                const archiveResult = await window.electron.fileArchive.saveFile(file);
                this.attachedFiles[fileIndex].relativePath = archiveResult.relativePath;
                console.log(`[FileArchive] Saved to: ${archiveResult.relativePath}`);

                // STEP 2: Handle file-type specific processing
                if (isMedia) {
                    // Media files: Upload to Supabase
                    this.attachedFiles[fileIndex].status = 'uploading';
                    this.renderFilePreview();
                    
                    const filePathInBucket = await this.uploadFileToSupabase(file);
                    this.attachedFiles[fileIndex].path = filePathInBucket;
                    this.attachedFiles[fileIndex].status = 'completed';
                } else {
                    // Text files: Read content
                    this.attachedFiles[fileIndex].status = 'reading';
                    this.renderFilePreview();
                    
                    const fileContent = await this.readFileAsText(file);
                    this.attachedFiles[fileIndex].content = fileContent;
                    this.attachedFiles[fileIndex].status = 'completed';
                }

                console.log(`[FileArchive] File processing completed for ${file.name}`);
            } catch (error) {
                console.error(`[FileArchive] Error processing file ${file.name}:`, error);
                alert(`Failed to process ${file.name}: ${error.message}`);
                this.attachedFiles[fileIndex].status = 'failed';
            }

            this.renderFilePreview();
        }
        this.fileInput.value = '';
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }

    getFileIcon(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            'js': 'fab fa-js', 'py': 'fab fa-python', 'html': 'fab fa-html5', 'css': 'fab fa-css3',
            'json': 'fas fa-code', 'txt': 'fas fa-file-alt', 'pdf': 'fas fa-file-pdf',
            'docx': 'fas fa-file-word', 'c': 'fas fa-file-code', 'jpg': 'fas fa-file-image',
            'jpeg': 'fas fa-file-image', 'png': 'fas fa-file-image', 'gif': 'fas fa-file-image',
            'svg': 'fas fa-file-image', 'webp': 'fas fa-file-image', 'mp3': 'fas fa-file-audio',
            'wav': 'fas fa-file-audio', 'ogg': 'fas fa-file-audio', 'm4a': 'fas fa-file-audio',
            'mp4': 'fas fa-file-video', 'webm': 'fas fa-file-video', 'avi': 'fas fa-file-video',
            'mov': 'fas fa-file-video', 'mkv': 'fas fa-file-video'
        };
        return iconMap[extension] || 'fas fa-file';
    }

    createFileChip(file, index) {
        const chip = document.createElement('div');
        chip.className = `file-chip ${file.status}`;

        const icon = document.createElement('i');
        icon.className = `${this.getFileIcon(file.name)} file-chip-icon`;

        const name = document.createElement('span');
        name.className = 'file-chip-name';
        
        // For uploading/reading files, show status in the name
        if (file.status === 'reading' || file.status === 'uploading') {
            name.innerHTML = `<span class="upload-status-text">${file.status === 'uploading' ? 'Uploading' : 'Reading'} ${file.name}</span>`;
        } else {
            name.textContent = file.name;
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-chip-remove';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.title = 'Remove file';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFile(index);
        });

        chip.appendChild(icon);
        chip.appendChild(name);
        chip.appendChild(removeBtn);

        chip.addEventListener('click', () => {
            this.showFilePreview(file, index);
        });

        this.contextFilesContent.appendChild(chip);
    }

    updateContextFilesBar() {
        const hasFiles = this.attachedFiles.length > 0;
        const hasSessions = window.contextHandler && window.contextHandler.getSelectedSessions().length > 0;
        const hasContent = hasFiles || hasSessions;

        if (hasContent) {
            this.contextFilesBar.classList.remove('hidden');
            this.inputContainer.classList.add('has-files');
            this.sidebar.classList.add('hidden');
        } else {
            this.contextFilesBar.classList.add('hidden');
            this.inputContainer.classList.remove('has-files');
            this.sidebar.classList.add('hidden');
        }

        const fileChips = this.contextFilesContent.querySelectorAll('.file-chip');
        fileChips.forEach(chip => chip.remove());
    }

    onContextChange() {
        this.updateContextFilesBar();
    }

    renderFilePreview() {
        this.previewContent.innerHTML = '';
        this.fileCount.textContent = this.attachedFiles.length;

        this.updateContextFilesBar();

        this.attachedFiles.forEach((file, index) => {
            this.createFileChip(file, index);
        });

        this.attachedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = `file-preview-item ${file.status}`;

            const headerItem = document.createElement('div');
            headerItem.className = 'file-preview-header-item';

            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            let fileName = '';
            let statusIcon = '';
            
            if (file.status === 'uploading' || file.status === 'reading') {
                const statusText = file.status === 'uploading' ? 'Uploading' : 'Reading';
                fileName = `<span class="upload-status-text">${statusText} ${file.name}</span>`;
            } else {
                fileName = file.name;
                if (file.status === 'failed') {
                    statusIcon = '<i class="fas fa-exclamation-circle status-icon-failed"></i>';
                }
            }
            
            fileInfo.innerHTML = `
                <i class="${this.getFileIcon(file.name)} file-icon"></i>
                <span class="file-name">${fileName}</span>
                ${statusIcon}
            `;

            const actions = document.createElement('div');
            actions.className = 'file-actions';
            actions.innerHTML = `
                <button class="preview-toggle" title="Toggle Preview"><i class="fas fa-eye"></i></button>
                <button class="remove-file" title="Remove File"><i class="fas fa-times"></i></button>
            `;

            headerItem.appendChild(fileInfo);
            headerItem.appendChild(actions);
            fileItem.appendChild(headerItem);

            const contentItem = document.createElement('div');
            contentItem.className = 'file-preview-content-item';

            if (file.isMedia && file.previewUrl) {
                if (file.type.startsWith('image/')) {
                    contentItem.innerHTML = `<img src="${file.previewUrl}" alt="${file.name}" class="media-preview">`;
                } else if (file.type.startsWith('audio/')) {
                    contentItem.innerHTML = `<audio controls class="media-preview"><source src="${file.previewUrl}" type="${file.type}"></audio>`;
                } else if (file.type.startsWith('video/')) {
                    contentItem.innerHTML = `<video controls class="media-preview"><source src="${file.previewUrl}" type="${file.type}"></video>`;
                } else if (file.type === 'application/pdf') {
                    contentItem.innerHTML = `<iframe src="${file.previewUrl}" class="pdf-preview"></iframe>`;
                } else {
                    contentItem.innerHTML = `<div class="doc-preview">Preview not available for this document type.</div>`;
                }
            } else if (file.content) {
                contentItem.innerHTML = `<pre>${file.content}</pre>`;
            } else {
                contentItem.innerHTML = `<p>Awaiting upload...</p>`;
            }

            fileItem.appendChild(contentItem);

            actions.querySelector('.preview-toggle').addEventListener('click', (e) => {
                e.stopPropagation();
                contentItem.classList.toggle('visible');
                const icon = e.target.closest('button').querySelector('i');
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            });
            actions.querySelector('.remove-file').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFile(index);
            });

            this.previewContent.appendChild(fileItem);
        });
    }

    toggleSidebar(show) {
        if (show === false || (show === undefined && !this.sidebar.classList.contains('hidden'))) {
            this.sidebar.classList.add('hidden');
        } else if (show === true || (show === undefined && this.sidebar.classList.contains('hidden'))) {
            if (this.attachedFiles.length > 0) {
                this.sidebar.classList.remove('hidden');
            }
        }
    }

    removeFile(index) {
        if (this.attachedFiles[index] && this.attachedFiles[index].previewUrl) {
            URL.revokeObjectURL(this.attachedFiles[index].previewUrl);
        }
        
        this.attachedFiles.splice(index, 1);
        this.renderFilePreview();
    }

    getAttachedFiles() {
        return this.attachedFiles.filter(file => file.status === 'completed');
    }

    clearAttachedFiles() {
        this.attachedFiles.forEach(file => {
            if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
        });
        
        this.attachedFiles = [];
        this.renderFilePreview();
    }

    updateInputPositioning() {
        const chatMessages = document.getElementById('chat-messages');
        const hasMessages = chatMessages && chatMessages.children.length > 0;

        if (hasMessages) {
            this.inputContainer.classList.remove('centered');
        } else {
            this.inputContainer.classList.add('centered');
        }
    }

    showFilePreview(file, index) {
        const existingModal = document.querySelector('.file-preview-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'file-preview-modal';
        
        const previewContent = this.generateFilePreview(file);
        
        modal.innerHTML = `
            <div class="file-preview-modal-backdrop"></div>
            <div class="file-preview-modal-content">
                <div class="file-preview-modal-header">
                    <div class="file-info">
                        <i class="${this.getFileIcon(file.name)} file-icon"></i>
                        <div class="file-details">
                            <h3 class="file-name">${file.name}</h3>
                            <span class="file-meta">${this.formatFileSize(file.size || 0)} • ${file.type || 'Unknown'}</span>
                        </div>
                    </div>
                    <button class="close-preview-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="file-preview-modal-body">
                    <div class="file-content-preview">
                        ${previewContent}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.close-preview-modal');
        const backdrop = modal.querySelector('.file-preview-modal-backdrop');
        
        const closeModal = () => {
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 200);
        };

        closeBtn.addEventListener('click', closeModal);
        backdrop.addEventListener('click', closeModal);
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        setTimeout(() => {
            modal.classList.add('visible');
        }, 10);
    }

    generateFilePreview(file) {
        if (file.isText && file.content) {
            return `<div class="text-file-preview"><pre class="file-text-content">${this.escapeHtml(file.content)}</pre></div>`;
        } else if (file.isText && !file.content) {
            const statusText = file.status === 'uploading' ? 'Uploading' : 'Reading';
            return `<div class="text-file-preview"><div class="loading-content"><i class="fas fa-file-alt"></i><span class="upload-status-text">${statusText} file content...</span></div></div>`;
        } else if (file.previewUrl && file.type.startsWith('image/')) {
            return `<div class="image-file-preview"><img src="${file.previewUrl}" alt="${file.name}" class="preview-image" /></div>`;
        } else if (file.isMedia) {
            const statusText = file.status === 'uploading' ? 'Uploading' : file.status === 'reading' ? 'Reading' : file.status;
            if (file.status === 'uploading' || file.status === 'reading') {
                return `<div class="media-file-preview"><div class="loading-content"><i class="fas fa-file-alt"></i><span class="upload-status-text">${statusText} media file...</span></div></div>`;
            } else {
                return `<div class="media-file-preview"><div class="media-placeholder"><i class="fas fa-file-alt"></i><p>Media file preview</p><p class="file-status">Status: ${file.status}</p></div></div>`;
            }
        } else {
            return `<div class="binary-file-preview"><div class="binary-placeholder"><i class="fas fa-file"></i><p>Binary file - preview not available</p><p class="file-info">Size: ${this.formatFileSize(file.size || 0)}</p><p class="debug-info">Type: ${file.type}, isText: ${file.isText}, hasContent: ${!!file.content}</p></div></div>`;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    onConversationStateChange() {
        this.updateInputPositioning();
    }
}

window.conversationStateManager = {
    hasMessages: false,
    fileHandler: null,

    setFileHandler(handler) { this.fileHandler = handler; },
    onMessageAdded() { this.hasMessages = true; this.updateInputPositioning(); },
    onConversationCleared() { this.hasMessages = false; this.updateInputPositioning(); },
    updateInputPositioning() {
        const inputContainer = document.getElementById('floating-input-container');
        if (!inputContainer) return;
        if (this.hasMessages) {
            inputContainer.classList.remove('centered');
        } else {
            inputContainer.classList.add('centered');
        }
        if (this.fileHandler) {
            this.fileHandler.updateInputPositioning();
        }
    },
    init() {
        const chatMessages = document.getElementById('chat-messages');
        this.hasMessages = chatMessages && chatMessages.children.length > 0;
        this.updateInputPositioning();
        if (chatMessages) {
            const observer = new MutationObserver(() => {
                const hasMessages = chatMessages.children.length > 0;
                if (hasMessages !== this.hasMessages) {
                    this.hasMessages = hasMessages;
                    this.updateInputPositioning();
                }
            });
            observer.observe(chatMessages, { childList: true });
        }
    }
};

export default FileAttachmentHandler;