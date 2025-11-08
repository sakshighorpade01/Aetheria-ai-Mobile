// js/add-files.js (Corrected with Preview Fix)

import { supabase } from './supabase-client.js';
import { chatModule } from './chat.js';

// Backend URL for file upload API - Local development
const API_PROXY_URL = 'https://aios-web-production.up.railway.app';

class FileAttachmentHandler {
  constructor() {
    this.supportedFileTypes = {
      // Text/Code files
      'txt': 'text/plain', 'md': 'text/markdown', 'js': 'text/javascript', 'jsx': 'text/javascript',
      'ts': 'text/typescript', 'tsx': 'text/typescript', 'py': 'text/x-python', 'java': 'text/x-java',
      'cpp': 'text/x-c++', 'c': 'text/x-c', 'h': 'text/x-c', 'cs': 'text/x-csharp',
      'php': 'text/x-php', 'rb': 'text/x-ruby', 'go': 'text/x-go', 'rs': 'text/x-rust',
      'swift': 'text/x-swift', 'kt': 'text/x-kotlin', 'scala': 'text/x-scala',
      'html': 'text/html', 'htm': 'text/html', 'xml': 'text/xml', 'css': 'text/css',
      'scss': 'text/x-scss', 'sass': 'text/x-sass', 'less': 'text/x-less',
      'json': 'application/json', 'yaml': 'text/yaml', 'yml': 'text/yaml',
      'sql': 'text/x-sql', 'sh': 'text/x-sh', 'bat': 'text/x-bat', 'ps1': 'text/x-powershell',
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'odt': 'application/vnd.oasis.opendocument.text', 'ods': 'application/vnd.oasis.opendocument.spreadsheet',
      'odp': 'application/vnd.oasis.opendocument.presentation',
      'rtf': 'application/rtf', 'csv': 'text/csv',
      // Images
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
      'bmp': 'image/bmp', 'webp': 'image/webp', 'svg': 'image/svg+xml', 'ico': 'image/x-icon',
      'tiff': 'image/tiff', 'tif': 'image/tiff',
      // Audio
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'm4a': 'audio/mp4',
      'aac': 'audio/aac', 'flac': 'audio/flac', 'wma': 'audio/x-ms-wma',
      // Video
      'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska', 'flv': 'video/x-flv', 'wmv': 'video/x-ms-wmv',
      // Archives
      'zip': 'application/zip', 'rar': 'application/x-rar-compressed', '7z': 'application/x-7z-compressed',
      'tar': 'application/x-tar', 'gz': 'application/gzip'
    };
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.attachedFiles = [];
    this.initialize();
    if (typeof window !== 'undefined') {
      window.fileAttachmentHandler = this;
    }
  }

  initialize() {
    this.attachButton = document.getElementById('attach-file-btn');
    this.fileInput = document.getElementById('file-input');
    this.previewsContainer = document.getElementById('file-previews-container');
    this.attachmentStrip = document.getElementById('attachment-strip');
    this.inputField = document.querySelector('#floating-input-container .input-field');

    this.previewModal = document.getElementById('file-preview-modal');
    this.previewContentArea = document.getElementById('preview-content-area');
    this.closePreviewBtn = this.previewModal?.querySelector('.close-preview-btn');

    this.fileInput?.addEventListener('change', (event) => {
      this.handleFileSelection(event);
    });

    this.closePreviewBtn?.addEventListener('click', () => this.hidePreview());
    this.previewModal?.addEventListener('click', (e) => {
      if (e.target === this.previewModal) {
        this.hidePreview();
      }
    });
  }

  openFilePicker() {
    this.fileInput?.click();
  }

  async uploadFileToSupabase(file) {
    await supabase.auth.refreshSession();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error("User not authenticated. Please log in again.");
    }

    const response = await fetch(`${API_PROXY_URL}/api/generate-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ fileName: file.name })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Could not get an upload URL.');
    }

    const { signedURL, path } = await response.json();
    if (!signedURL) throw new Error('Server did not return a valid signed URL.');

    const uploadResponse = await fetch(signedURL, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });

    if (!uploadResponse.ok) throw new Error('File upload to cloud storage failed.');
    return path;
  }

  async handleFileSelection(event) {
    const files = Array.from(event.target.files);
    if (files.length + this.attachedFiles.length > 20) {
      chatModule.showNotification("You can attach a maximum of 20 files.", "warning");
      return;
    }

    for (const file of files) {
      if (file.size > this.maxFileSize) {
        chatModule.showNotification(`File too large: ${file.name}`, "warning");
        continue;
      }

      const fileIndex = this.attachedFiles.length;
      const ext = file.name.split('.').pop().toLowerCase();
      
      // Map extensions to backend-accepted MIME types
      const mimeTypeMap = {
        'pdf': 'application/pdf',
        'js': 'application/x-javascript',
        'jsx': 'application/x-javascript',
        'py': 'application/x-python',
        'txt': 'text/plain',
        'html': 'text/html',
        'htm': 'text/html',
        'css': 'text/css',
        'csv': 'text/csv',
        'xml': 'text/xml',
        'rtf': 'text/rtf'
      };
      
      // Backend-supported MIME types (excluding text/md as it's not supported)
      const backendSupportedMimeTypes = [
        'application/pdf',
        'application/x-javascript',
        'text/javascript',
        'application/x-python',
        'text/x-python',
        'text/plain',
        'text/html',
        'text/css',
        'text/csv',
        'text/xml',
        'text/rtf'
      ];
      
      // Text file extensions that can be read as text
      const textExtensions = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'sh', 'bat', 'ps1', 'yaml', 'yml', 'sql', 'rtf'];
      const isText = file.type.startsWith('text/') || textExtensions.includes(ext) || this.supportedFileTypes[ext]?.startsWith('text/');
      
      // Get the correct MIME type for backend
      let backendMimeType = file.type;
      if (mimeTypeMap[ext]) {
        backendMimeType = mimeTypeMap[ext];
      }
      
      // Check if backend supports this MIME type
      const isBackendSupported = backendSupportedMimeTypes.includes(backendMimeType);

      const fileObject = {
        id: `file_${Date.now()}_${fileIndex}`,
        name: file.name,
        type: file.type,
        backendMimeType: backendMimeType,
        status: 'uploading',
        isText,
        isBackendSupported,
        file,
        previewUrl: null
      };

      this.attachedFiles.push(fileObject);
      this.renderPreviews();

      try {
        if (fileObject.isText) {
          // Read text files as text content
          fileObject.content = await this.readFileAsText(file);
        } else {
          // Upload binary files (images, videos, audio, PDFs, documents) to Supabase
          fileObject.path = await this.uploadFileToSupabase(file);
          // Generate preview URL for media files
          if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
            fileObject.previewUrl = await this.readFileAsDataURL(file);
          }
        }
        fileObject.status = 'completed';
      } catch (error) {
        console.error(`Failed to process ${file.name}:`, error);
        fileObject.status = 'failed';
        chatModule.showNotification(`Upload failed for ${file.name}: ${error.message}`, "error");
      }

      this.renderPreviews();
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

  // ★★★ FIX: New function to read file as a Base64 Data URL ★★★
  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  renderPreviews() {
    if (!this.previewsContainer) return;
    this.previewsContainer.innerHTML = '';

    if (this.attachedFiles.length === 0) {
      this.attachmentStrip?.classList.add('hidden');
      this.inputField?.classList.remove('with-attachments');
      this.removeScrollListeners();
      return;
    }

    this.attachmentStrip?.classList.remove('hidden');
    this.inputField?.classList.add('with-attachments');

    this.attachedFiles.forEach((fileObject, index) => {
      const previewElement = document.createElement('div');
      previewElement.className = `file-preview-chip ${fileObject.status}`;
      previewElement.setAttribute('role', 'listitem');

      // Add image-file class for images
      if (fileObject.type.startsWith('image/')) {
        previewElement.classList.add('image-file');
      }

      // Create thumbnail container
      const thumbnailDiv = document.createElement('div');
      thumbnailDiv.className = 'file-thumbnail';

      // Show preview for images or icon for other files
      if (fileObject.type.startsWith('image/') && fileObject.previewUrl) {
        const img = document.createElement('img');
        img.src = fileObject.previewUrl;
        img.alt = fileObject.name;
        thumbnailDiv.appendChild(img);
      } else {
        // Show appropriate icon based on file type
        const iconElement = document.createElement('i');
        iconElement.className = 'file-icon fas';

        if (fileObject.type === 'application/pdf') {
          iconElement.classList.add('fa-file-pdf');
        } else if (fileObject.type.startsWith('video/')) {
          iconElement.classList.add('fa-file-video');
        } else if (fileObject.type.startsWith('audio/')) {
          iconElement.classList.add('fa-file-audio');
        } else if (fileObject.type.includes('word') || fileObject.type.includes('document')) {
          iconElement.classList.add('fa-file-word');
        } else if (fileObject.type.includes('excel') || fileObject.type.includes('spreadsheet') || fileObject.name.endsWith('.csv')) {
          iconElement.classList.add('fa-file-excel');
        } else if (fileObject.type.includes('powerpoint') || fileObject.type.includes('presentation')) {
          iconElement.classList.add('fa-file-powerpoint');
        } else if (fileObject.type.includes('zip') || fileObject.type.includes('rar') || fileObject.type.includes('7z') || fileObject.type.includes('tar') || fileObject.type.includes('gzip')) {
          iconElement.classList.add('fa-file-archive');
        } else if (fileObject.name.match(/\.(js|jsx|ts|tsx|py|java|cpp|c|cs|php|rb|go|rs|swift|kt|scala|html|css|json|xml|sql|sh|md)$/i)) {
          iconElement.classList.add('fa-file-code');
        } else {
          iconElement.classList.add('fa-file');
        }

        thumbnailDiv.appendChild(iconElement);
      }

      // Create file name label (shown for non-image files)
      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-name';
      nameSpan.textContent = fileObject.name;

      // Create remove button (X in top-left corner)
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-file-btn';
      removeButton.dataset.index = index;
      removeButton.title = 'Remove file';
      removeButton.innerHTML = '<i class="fas fa-times"></i>';
      removeButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
        this.removeFile(indexToRemove);
      });

      // Click on card to preview (if available)
      if (fileObject.previewUrl && fileObject.status === 'completed') {
        previewElement.style.cursor = 'pointer';
        previewElement.addEventListener('click', (e) => {
          if (!e.target.closest('.remove-file-btn')) {
            this.showPreview(index);
          }
        });
      }

      previewElement.appendChild(thumbnailDiv);
      previewElement.appendChild(nameSpan);
      previewElement.appendChild(removeButton);
      
      // Add indicator for unsupported files
      if (fileObject.isText && !fileObject.isBackendSupported && fileObject.status === 'completed') {
        const indicator = document.createElement('div');
        indicator.className = 'file-processing-indicator';
        indicator.title = 'Content will be included in message';
        indicator.innerHTML = '<i class="fas fa-file-alt"></i>';
        previewElement.appendChild(indicator);
      }

      this.previewsContainer.appendChild(previewElement);
    });

    window.contextHandler?.updateContextFilesBarVisibility?.();
  }

  showPreview(index) {
    const fileObject = this.attachedFiles[index];
    if (!fileObject || !fileObject.previewUrl || !this.previewModal) return;

    let contentHTML = '';
    if (fileObject.type.startsWith('image/')) {
      contentHTML = `
            <div class="preview-header">
              <h3 class="preview-title">${fileObject.name}</h3>
            </div>
            <img src="${fileObject.previewUrl}" alt="Preview of ${fileObject.name}">
          `;
    } else if (fileObject.type.startsWith('video/')) {
      contentHTML = `<video src="${fileObject.previewUrl}" controls autoplay></video>`;
    } else if (fileObject.type.startsWith('audio/')) {
      contentHTML = `<audio src="${fileObject.previewUrl}" controls autoplay></audio>`;
    } else if (fileObject.type === 'application/pdf') {
      contentHTML = `<iframe class="pdf-preview" src="${fileObject.previewUrl}"></iframe>`;
    } else {
      contentHTML = `<p>Preview is not available for this file type.</p>`;
    }

    this.previewContentArea.innerHTML = contentHTML;
    this.previewModal.classList.remove('hidden');
  }

  hidePreview() {
    if (!this.previewModal) return;
    this.previewModal.classList.add('hidden');
    this.previewContentArea.innerHTML = '';
  }

  removeFile(index) {
    this.attachedFiles.splice(index, 1);
    this.renderPreviews();
  }

  getAttachedFiles() {
    return this.attachedFiles.filter(file => file.status === 'completed');
  }

  clearAttachedFiles() {
    this.attachedFiles = [];
    this.renderPreviews();
  }

  removeScrollListeners() {
    // Placeholder method - no scroll listeners to remove in current implementation
  }
}

export default FileAttachmentHandler;