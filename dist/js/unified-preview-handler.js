import { messageFormatter } from './message-formatter.js';

class UnifiedPreviewHandler {
    constructor(contextHandler, fileAttachmentHandler) {
        this.contextHandler = contextHandler;
        this.fileAttachmentHandler = fileAttachmentHandler;

        this.viewer = document.getElementById('selected-context-viewer');
        this.contextContent = this.viewer?.querySelector('.context-preview-content') || null;
        this.filesContent = this.viewer?.querySelector('.files-preview-content') || null;
        this.tabs = this.viewer?.querySelectorAll('.viewer-tab') || [];
        this.tabContents = this.viewer?.querySelectorAll('.tab-content') || [];

        this.ensureViewerElements();
        this.bindEvents();
        this.updateContextIndicator();
    }

    ensureViewerElements() {
        if (this.viewer) return;

        const modal = document.getElementById('context-viewer-modal');
        if (!modal) {
            console.warn('UnifiedPreviewHandler: no context viewer modal found.');
            return;
        }

        this.viewer = modal;
        this.contextContent = modal.querySelector('.context-preview-content');
        this.filesContent = modal.querySelector('.files-preview-content');
        this.tabs = modal.querySelectorAll('.viewer-tab');
        this.tabContents = modal.querySelectorAll('.tab-content');
    }

    bindEvents() {
        if (!this.viewer) return;

        this.viewer.addEventListener('click', (event) => {
            if (event.target.closest('.close-viewer-btn')) {
                this.hideViewer();
            }

            const removeSessionBtn = event.target.closest('.remove-session-btn');
            if (removeSessionBtn) {
                const index = parseInt(removeSessionBtn.dataset.sessionIndex, 10);
                this.contextHandler?.removeSelectedSession?.(index);
                this.showViewer();
                return;
            }

            const removeFileBtn = event.target.closest('.remove-file');
            if (removeFileBtn) {
                const fileItem = removeFileBtn.closest('.file-preview-item');
                if (!fileItem) return;
                const fileIndex = [...fileItem.parentNode.children].indexOf(fileItem);
                this.fileAttachmentHandler?.removeFile?.(fileIndex);
                this.showViewer();
            }

            const toggle = event.target.closest('.preview-toggle');
            if (toggle) {
                const content = toggle.closest('.file-preview-item')?.querySelector('.file-preview-content-item');
                content?.classList.toggle('visible');
            }

            const viewerTab = event.target.closest('.viewer-tab');
            if (viewerTab) {
                const tabId = viewerTab.dataset.tab;
                this.tabs.forEach(tab => tab.classList.remove('active'));
                viewerTab.classList.add('active');
                this.tabContents.forEach(content => content.classList.toggle('active', content.id === `${tabId}-tab`));
            }
        });
    }

    updateContextIndicator() {
        const indicator = document.querySelector('.context-active-indicator');
        if (!indicator) return;

        const sessions = this.contextHandler?.getSelectedSessions?.() || [];
        const files = this.fileAttachmentHandler?.getAttachedFiles?.() || [];
        const hasContext = sessions.length > 0 || files.length > 0;

        indicator.classList.toggle('visible', hasContext);
        const badge = indicator.querySelector('.context-badge');
        if (badge) {
            badge.textContent = `${sessions.length + files.length}`;
            badge.classList.toggle('visible', hasContext);
        }
    }

    showViewer() {
        const sessions = this.contextHandler?.getSelectedSessions?.() || [];
        const files = this.fileAttachmentHandler?.getAttachedFiles?.() || [];
        this.renderSessions(sessions);
        this.renderFiles(files);
        this.viewer?.classList.add('visible');
        this.updateContextIndicator();
    }

    hideViewer() {
        this.viewer?.classList.remove('visible');
    }

    showHistoricalContext({ sessions = [], files = [] } = {}) {
        this.renderSessions(sessions);
        this.renderFiles(files);
        this.viewer?.classList.add('visible');
    }

    renderSessions(sessions = []) {
        if (!this.contextContent) return;

        if (!sessions.length) {
            this.contextContent.innerHTML = '<p class="empty-state">No context sessions selected</p>';
            return;
        }

        this.contextContent.innerHTML = sessions.map((session, index) => {
            const interactions = session.interactions || session.runs || [];
            const formattedInteractions = interactions
                .map((interaction) => {
                    const user = interaction.user_input || interaction.input?.input_content || '';
                    const assistant = interaction.llm_output || interaction.output?.output_text || '';
                    const userBlock = user
                        ? `<div class="interaction user-interaction"><strong>User:</strong> ${messageFormatter.format(user, { inlineArtifacts: true })}</div>`
                        : '';
                    const assistantBlock = assistant
                        ? `<div class="interaction assistant-interaction"><strong>Assistant:</strong> ${messageFormatter.format(assistant, { inlineArtifacts: true })}</div>`
                        : '';
                    return `<div class="interaction-block">${userBlock}${assistantBlock}</div>`;
                })
                .join('');

            return `
                <div class="session-block">
                    <div class="session-block-header">
                        <h4>Session ${index + 1}</h4>
                        <button class="remove-session-btn" data-session-index="${index}" title="Remove Session">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="session-block-body">${formattedInteractions || '<p class="empty-state">No turns available.</p>'}</div>
                </div>
            `;
        }).join('');

        messageFormatter.applyInlineEnhancements?.(this.contextContent);
    }

    renderFiles(files = []) {
        if (!this.filesContent) return;

        if (!files.length) {
            this.filesContent.innerHTML = '<p class="empty-state">No files attached</p>';
            return;
        }

        this.filesContent.innerHTML = files.map((file) => {
            const iconClass = this.fileAttachmentHandler?.getFileIcon?.(file.name) || 'fas fa-file';
            const previewContent = file.isMedia
                ? this.renderMediaPreview(file)
                : (file.content
                    ? `<pre class="file-content-preview">${messageFormatter.format(file.content, { inlineArtifacts: true })}</pre>`
                    : '<p>No preview available.</p>');

            return `
                <div class="file-preview-item">
                    <div class="file-preview-header-item">
                        <div class="file-info">
                            <i class="${iconClass} file-icon"></i>
                            <span class="file-name">${file.name}</span>
                        </div>
                        <div class="file-actions">
                            <button class="preview-toggle" title="Toggle Preview"><i class="fas fa-eye"></i></button>
                            <button class="remove-file" title="Remove File"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                    <div class="file-preview-content-item">${previewContent}</div>
                </div>
            `;
        }).join('');

        messageFormatter.applyInlineEnhancements?.(this.filesContent);
    }

    renderMediaPreview(file) {
        const src = file.previewUrl || file.url || '';
        if (file.type?.startsWith('image/')) {
            return `<img src="${src}" alt="${file.name}" class="media-preview" loading="lazy" />`;
        }
        if (file.type?.startsWith('audio/')) {
            return `<audio controls class="media-preview"><source src="${src}" type="${file.type}" /></audio>`;
        }
        if (file.type?.startsWith('video/')) {
            return `<video controls class="media-preview"><source src="${src}" type="${file.type}" /></video>`;
        }
        if (file.type === 'application/pdf') {
            return `<iframe src="${src}" class="pdf-preview"></iframe>`;
        }
        return file.content
            ? `<pre class="file-content-preview">${messageFormatter.format(file.content, { inlineArtifacts: true })}</pre>`
            : '<p>No preview available.</p>';
    }
}

export default UnifiedPreviewHandler;
