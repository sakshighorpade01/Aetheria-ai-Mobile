// js/add-files.js (Corrected with Preview Fix)

import { supabase } from './supabase-client.js';
import { chatModule } from './chat.js';

// Backend URL for file upload API - using deployed Render backend
const API_PROXY_URL = 'http://localhost:8765';

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
        } else {
          iconElement.classList.add('fa-file');
        }
        
        thumbnailDiv.appendChild(iconElement);
      }

      // Create file name label
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

      // Create status indicator
      const statusSpan = document.createElement('span');
      statusSpan.className = 'file-status';
      if (fileObject.status === 'uploading') {
        statusSpan.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      } else if (fileObject.status === 'failed') {
        statusSpan.innerHTML = '<i class="fas fa-exclamation-circle error-icon"></i>';
      } else {
        statusSpan.innerHTML = '<i class="fas fa-check-circle success-icon"></i>';
      }

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
      previewElement.appendChild(statusSpan);

      this.previewsContainer.appendChild(previewElement);
    });

    // Setup scroll detection after rendering
    this.setupScrollDetection();

    window.contextHandler?.updateContextFilesBarVisibility?.();
  }

  setupScrollDetection() {
    if (!this.previewsContainer || !this.attachmentStrip) return;

    // Remove existing listeners first
    this.removeScrollListeners();

    // Check if content is scrollable
    const checkScrollable = () => {
      const isScrollable = this.previewsContainer.scrollWidth > this.previewsContainer.clientWidth;
      const scrollLeft = this.previewsContainer.scrollLeft;
      const isAtEnd = scrollLeft + this.previewsContainer.clientWidth >= this.previewsContainer.scrollWidth - 5;
      const isAtStart = scrollLeft <= 5;

      // Toggle overflow indicator
      if (isScrollable) {
        this.attachmentStrip.classList.add('has-overflow');
      } else {
        this.attachmentStrip.classList.remove('has-overflow');
      }

      // Toggle end indicator
      if (isAtEnd) {
        this.attachmentStrip.classList.add('scrolled-to-end');
      } else {
        this.attachmentStrip.classList.remove('scrolled-to-end');
      }

      // Toggle start indicator
      if (!isAtStart && isScrollable) {
        this.attachmentStrip.classList.add('scrolled-from-start');
      } else {
        this.attachmentStrip.classList.remove('scrolled-from-start');
      }
    };

    // Create bound function for removal later
    this.scrollHandler = checkScrollable;

    // Check initially (with delay to ensure rendering is complete)
    setTimeout(checkScrollable, 100);

    // Check on scroll
    this.previewsContainer.addEventListener('scroll', this.scrollHandler, { passive: true });

    // Check on window resize
    window.addEventListener('resize', this.scrollHandler);
  }

  removeScrollListeners() {
    if (this.scrollHandler && this.previewsContainer) {
      this.previewsContainer.removeEventListener('scroll', this.scrollHandler);
      window.removeEventListener('resize', this.scrollHandler);
      this.scrollHandler = null;
    }
    
    if (this.attachmentStrip) {
      this.attachmentStrip.classList.remove('has-overflow', 'scrolled-to-end', 'scrolled-from-start');
    }
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
    this.removeScrollListeners();
    this.renderPreviews();
  }
}

export default FileAttachmentHandler;