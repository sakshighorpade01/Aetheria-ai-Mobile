// js/artifact-handler.js (Updated)

import NotificationService from './notification-service.js';

class ArtifactHandler {
    constructor() {
        this.artifacts = new Map();
        this.currentId = 0;
        this.currentArtifactId = null;
        this.notificationService = new NotificationService();
        this.init();
    }

    init() {
        const container = document.createElement('div');
        container.id = 'artifact-container';
        container.className = 'artifact-container hidden';

        container.innerHTML = `
            <div class="artifact-window">
                <div class="artifact-header">
                    <div id="artifact-title" class="artifact-title">Artifact Viewer</div>
                    <div class="artifact-controls">
                        <button id="copy-artifact-btn" class="copy-artifact-btn" title="Copy to Clipboard"><i class="fas fa-copy"></i></button>
                        <button id="download-artifact-btn" class="download-artifact-btn" title="Download"><i class="fas fa-download"></i></button>
                        <button id="close-artifact-btn" class="close-artifact-btn" title="Close"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div id="artifact-content" class="artifact-content"></div>
            </div>
        `;
        document.body.appendChild(container);

        container.querySelector('#close-artifact-btn').addEventListener('click', () => this.hideArtifact());
        container.querySelector('#copy-artifact-btn').addEventListener('click', () => this.copyArtifactContent());
        container.querySelector('#download-artifact-btn').addEventListener('click', () => this.downloadArtifact());
    }

    createArtifact(content, type, artifactId = null) {
        const id = artifactId || `artifact-${this.currentId++}`;

        let stringContent = content;
        if (typeof content === 'object' && content !== null) {
            try {
                stringContent = JSON.stringify(content, null, 2);
            } catch (error) {
                stringContent = '[object Object]';
            }
        } else if (typeof content !== 'string') {
            stringContent = String(content);
        }

        this.artifacts.set(id, { content: stringContent, type });
        return id;
    }

    showArtifact(content, type, artifactId = null) {
        this.currentArtifactId = artifactId || this.createArtifact(content, type, artifactId);

        const container = document.getElementById('artifact-container');
        const contentDiv = container.querySelector('#artifact-content');
        const titleDiv = container.querySelector('#artifact-title');

        contentDiv.innerHTML = '';

        const artifact = this.artifacts.get(this.currentArtifactId);
        const displayContent = artifact ? artifact.content : (typeof content === 'string' ? content : JSON.stringify(content, null, 2));

        switch (type) {
            case 'image':
                titleDiv.textContent = 'Image Artifact';
                this.renderImageArtifact(contentDiv, displayContent);
                break;
            case 'mermaid':
                titleDiv.textContent = 'Mermaid Diagram';
                this.renderMermaidArtifact(contentDiv, displayContent);
                break;
            default:
                titleDiv.textContent = type === 'browser_view' ? 'Interactive Browser' : `Code: ${type}`;
                this.renderCodeArtifact(contentDiv, displayContent, type);
        }

        container.classList.remove('hidden');
        container.dataset.activeArtifactId = this.currentArtifactId;
        container.dataset.activeArtifactType = type;
        return this.currentArtifactId;
    }

    hideArtifact() {
        const container = document.getElementById('artifact-container');
        container.classList.add('hidden');
        this.currentArtifactId = null;
        delete container.dataset.activeArtifactId;
        delete container.dataset.activeArtifactType;
    }

    reopenArtifact(artifactId) {
        const artifact = this.artifacts.get(artifactId);
        if (artifact) this.showArtifact(artifact.content, artifact.type, artifactId);
    }

    renderImageArtifact(container, content) {
        const src = typeof content === 'string' && content.startsWith('data:')
            ? content
            : `data:image/png;base64,${content}`;

        const wrapper = document.createElement('div');
        wrapper.className = 'artifact-image-wrapper';

        const img = document.createElement('img');
        img.className = 'artifact-image';
        img.alt = 'Generated artifact image';
        img.src = src;
        img.loading = 'lazy';

        wrapper.appendChild(img);
        container.appendChild(wrapper);
    }

    renderMermaidArtifact(container, content) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-artifact-wrapper';

        const panContainer = document.createElement('div');
        panContainer.className = 'mermaid-pan-container';

        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.removeAttribute?.('data-processed');
        mermaidDiv.textContent = content;

        panContainer.appendChild(mermaidDiv);
        wrapper.appendChild(panContainer);
        container.appendChild(wrapper);

        const runMermaid = () => {
            if (typeof window === 'undefined' || !window.mermaid) return;
            if (typeof window.mermaid.run === 'function') {
                window.mermaid.run({ nodes: [mermaidDiv] });
            } else if (typeof window.mermaid.init === 'function') {
                window.mermaid.init(undefined, [mermaidDiv]);
            }
        };

        requestAnimationFrame(runMermaid);
    }

    renderCodeArtifact(container, content, language) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = `language-${language || 'plaintext'}`;
        code.textContent = content;
        pre.appendChild(code);
        container.appendChild(pre);

        if (typeof hljs !== 'undefined' && typeof hljs.highlightElement === 'function') {
            try {
                hljs.highlightElement(code);
            } catch (_) {
                /* no-op */
            }
        }
    }

    async copyArtifactContent() {
        if (!this.currentArtifactId) return;
        const artifact = this.artifacts.get(this.currentArtifactId);
        if (!artifact) return;
        try {
            await navigator.clipboard.writeText(artifact.content);
            this.showNotification('Content copied to clipboard!', 'success');
        } catch (err) {
            this.showNotification('Failed to copy content', 'error');
        }
    }

    async downloadArtifact() {
        if (!this.currentArtifactId) return;
        const artifact = this.artifacts.get(this.currentArtifactId);
        if (!artifact) return;

        let { content, type } = artifact;
        let suggestedName = 'artifact';
        let extension = '.txt';
        let mimeType = 'text/plain';

        if (type === 'mermaid') {
            extension = '.mmd';
            suggestedName = 'diagram';
        } else {
            extension = this.getFileExtension(type);
            suggestedName = `code`;
            mimeType = this.getMimeType(extension);
        }

        try {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = suggestedName + extension;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showNotification('File download started', 'success');
        } catch (error) {
            console.error('Browser Save Error:', error);
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    getFileExtension(language) {
        const map = {
            javascript: '.js', python: '.py', html: '.html', css: '.css', json: '.json',
            typescript: '.ts', java: '.java', cpp: '.cpp', c: '.c', ruby: '.rb',
            php: '.php', go: '.go', rust: '.rs', swift: '.swift', kotlin: '.kt',
            plaintext: '.txt'
        };
        return map[language] || '.txt';
    }

    getMimeType(extension) {
        const map = {
            '.js': 'application/javascript', '.py': 'text/x-python', '.html': 'text/html',
            '.css': 'text/css', '.json': 'application/json', '.ts': 'application/typescript',
            '.txt': 'text/plain', '.mmd': 'text/plain', '.cpp': 'text/x-c++src',
            '.c': 'text/x-c', '.java': 'text/x-java-source'
        };
        return map[extension] || 'text/plain';
    }

    showNotification(message, type = 'info') {
        if (this.notificationService) {
            this.notificationService.show(message, type, 3000);
        }
    }
    
    // --- NEW: Functions to handle terminal display ---
    showTerminal(artifactId) {
        const container = document.getElementById('artifact-container');
        const contentDiv = container.querySelector('#artifact-content');
        container.querySelector('#artifact-title').textContent = 'Sandbox Terminal';
        contentDiv.innerHTML = `<div class="terminal-output"><pre><code><span class="log-line log-status">Waiting for command...</span></code></pre></div>`;
        container.classList.remove('hidden');
        container.dataset.activeArtifactId = artifactId;
    }

    updateCommand(artifactId, command) {
        const container = document.getElementById('artifact-container');
        if (container.dataset.activeArtifactId !== artifactId) return;
        const codeEl = container.querySelector('code');
        if (codeEl) {
            codeEl.innerHTML = `<span class="log-line log-command">$ ${command}</span><span class="log-line log-status terminal-spinner">Running...</span>`;
        }
    }

    updateTerminalOutput(artifactId, stdout, stderr, exitCode) {
        const container = document.getElementById('artifact-container');
        if (container.dataset.activeArtifactId !== artifactId) return;
        const codeEl = container.querySelector('code');
        if (codeEl) {
            const spinner = codeEl.querySelector('.terminal-spinner');
            if (spinner) spinner.remove();
            if (stdout) {
                const stdoutSpan = document.createElement('span');
                stdoutSpan.className = 'log-line log-stdout';
                stdoutSpan.textContent = stdout;
                codeEl.appendChild(stdoutSpan);
            }
            if (stderr) {
                const stderrSpan = document.createElement('span');
                stderrSpan.className = 'log-line log-error';
                stderrSpan.textContent = stderr;
                codeEl.appendChild(stderrSpan);
            }
            const statusSpan = document.createElement('span');
            statusSpan.className = 'log-line log-status';
            statusSpan.textContent = `\n--- Process finished with exit code ${exitCode} ---`;
            codeEl.appendChild(statusSpan);
        }
    }
}

export const artifactHandler = new ArtifactHandler();