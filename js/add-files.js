// js/add-files.js (Corrected with Preview Fix)

import { supabase } from './supabase-client.js';
import { chatModule } from './chat.js';

// Backend URL for file upload API - using deployed Render backend
const API_PROXY_URL = 'https://aios-web.onrender.com';

class FileAttachmentHandler {
  constructor() {
    this.supportedFileTypes = {
      'txt': 'text/plain', 'js': 'text/javascript', 'py': 'text/x-python', 'html': 'text/html',
      'css': 'text/css', 'json': 'application/json', 'c': 'text/x-c',
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
      'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'm4a': 'audio/mp4',
      'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo'
    };
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.attachedFiles = [];
    this.initialize();
  }

  initialize() {
    this.attachButton = document.getElementById('attach-file-btn');
    this.fileInput = document.getElementById('file-input');
    this.previewsContainer = document.getElementById('file-previews-container');
    
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
    if (files.length + this.attachedFiles.length > 10) {
      chatModule.showNotification("You can attach a maximum of 10 files.", "warning");
      return;
    }

    for (const file of files) {
      if (file.size > this.maxFileSize) {
        chatModule.showNotification(`File too large: ${file.name}`, "warning");
        continue;
      }

      const fileIndex = this.attachedFiles.length;
      const ext = file.name.split('.').pop().toLowerCase();
      const isText = file.type.startsWith('text/') || this.supportedFileTypes[ext] === 'text/plain';

      const fileObject = {
        id: `file_${Date.now()}_${fileIndex}`,
        name: file.name,
        type: file.type,
        status: 'uploading',
        isText,
        file,
        // ★★★ FIX: Initialize previewUrl to null. It will be populated below. ★★★
        previewUrl: null 
      };

      this.attachedFiles.push(fileObject);
      this.renderPreviews();

      try {
        if (fileObject.isText) {
          fileObject.content = await this.readFileAsText(file);
        } else {
          fileObject.path = await this.uploadFileToSupabase(file);
          // ★★★ FIX: Generate a persistent Base64 Data URL for previewing later. ★★★
          fileObject.previewUrl = await this.readFileAsDataURL(file);
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

    this.attachedFiles.forEach((fileObject, index) => {
      const previewElement = document.createElement('div');
      previewElement.className = 'file-preview-item';

      let statusIcon = '';
      if (fileObject.status === 'uploading') {
        statusIcon = '<i class="fas fa-spinner fa-spin"></i>';
      } else if (fileObject.status === 'failed') {
        statusIcon = '<i class="fas fa-exclamation-circle error-icon"></i>';
      } else {
        statusIcon = '<i class="fas fa-check-circle success-icon"></i>';
      }
      
      let previewButton = '';
      // Show preview button if a previewUrl exists and the file has completed processing
      if (fileObject.previewUrl && fileObject.status === 'completed') {
          previewButton = `<button class="preview-file-btn" data-index="${index}" title="Preview File"><i class="fas fa-eye"></i></button>`;
      }

      previewElement.innerHTML = `
        <span class="file-name">${fileObject.name}</span>
        <div class="file-actions">
          ${previewButton}
          <button class="remove-file-btn" data-index="${index}" title="Remove File">×</button>
        </div>
        <span class="file-status">${statusIcon}</span>
      `;

      this.previewsContainer.appendChild(previewElement);
    });

    this.previewsContainer.querySelectorAll('.remove-file-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const indexToRemove = parseInt(e.currentTarget.dataset.index, 10);
        this.removeFile(indexToRemove);
      });
    });
    
    this.previewsContainer.querySelectorAll('.preview-file-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const indexToPreview = parseInt(e.currentTarget.dataset.index, 10);
            this.showPreview(indexToPreview);
        });
    });
  }

  showPreview(index) {
      const fileObject = this.attachedFiles[index];
      if (!fileObject || !fileObject.previewUrl || !this.previewModal) return;

      let contentHTML = '';
      if (fileObject.type.startsWith('image/')) {
          contentHTML = `<img src="${fileObject.previewUrl}" alt="Preview of ${fileObject.name}">`;
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
}

export default FileAttachmentHandler;