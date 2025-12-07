// artifact-handler.js (Final, Race-Condition-Proof Version)

class ArtifactHandler {
    constructor() {
        this.artifacts = new Map();
        this.pendingImages = new Map();
        this.currentId = 0;
        this.browserArtifactId = 'browser_view_artifact';
        this.currentViewMode = 'preview';
        this.init();
    }

    init() {
        const container = document.createElement('div');
        container.id = 'artifact-container';
        container.className = 'artifact-container hidden';
        
        container.innerHTML = `
            <div class="artifact-window">
                <div class="artifact-header">
                    <div class="artifact-title">Artifact Viewer</div>
                    <div class="artifact-controls">
                        <div class="artifact-view-toggle hidden" role="group" aria-label="View mode">
                            <button type="button" class="view-toggle-btn active" data-view="preview" aria-pressed="true" title="Preview mode">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button type="button" class="view-toggle-btn" data-view="source" aria-pressed="false" title="Source mode">
                                <i class="fas fa-code"></i>
                            </button>
                        </div>
                        <button class="copy-artifact-btn" title="Copy to Clipboard">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="download-artifact-btn" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="close-artifact-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="artifact-content"></div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        container.querySelector('.close-artifact-btn').addEventListener('click', () => this.hideArtifact());
        container.querySelector('.copy-artifact-btn').addEventListener('click', () => this.copyArtifactContent());
        container.querySelector('.download-artifact-btn').addEventListener('click', () => this.downloadArtifact());

        this.viewToggleContainer = container.querySelector('.artifact-view-toggle');
        this.viewToggleButtons = Array.from(this.viewToggleContainer.querySelectorAll('.view-toggle-btn'));
        this.viewToggleButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const mode = button.dataset.view;
                this.setViewMode(mode);
            });
        });
    }

    cachePendingImage(artifactId, base64Data) {
        if (!base64Data || base64Data.length === 0) {
            console.error(`[HANDLER] Received empty base64 data for artifact ${artifactId}`);
            return;
        }

        // Check if a placeholder artifact already exists (text-first scenario)
        if (this.artifacts.has(artifactId)) {
            const artifact = this.artifacts.get(artifactId);
            
            if (artifact && artifact.isPending) {
                // Finalize the artifact by adding the content and updating its state
                artifact.content = base64Data;
                artifact.isPending = false;
                this.showArtifact('image', base64Data, artifactId);
                return;
            } else if (artifact && !artifact.isPending) {
                return;
            }
        }
        
        // If no placeholder exists, cache it for later (data-first scenario)
        this.pendingImages.set(artifactId, base64Data);
    }

    createArtifact(content, type, artifactId = null, viewMode = 'preview') {
        if (type === 'image') {
            const imageId = content.trim();
            
            // If ANY artifact already exists (pending or complete), return immediately
            // This prevents duplicate placeholder creation during streaming
            if (this.artifacts.has(imageId)) {
                return imageId;
            }

            // Data-First Scenario: The image data arrived before the text reference.
            if (this.pendingImages.has(imageId)) {
                const imageContent = this.pendingImages.get(imageId);
                this.artifacts.set(imageId, { content: imageContent, type: 'image', isPending: false });
                this.pendingImages.delete(imageId);
                return imageId;
            } 
            // Text-First Scenario: The text reference arrived first. Create a placeholder.
            else {
                this.artifacts.set(imageId, { content: null, type: 'image', isPending: true });
                return imageId;
            }
        }

        // For all other artifact types (code, mermaid), the logic is simple.
        const id = artifactId || `artifact-${this.currentId++}`;
        const artifactData = { content, type };
        if (type === 'mermaid') {
            artifactData.viewMode = viewMode;
        }
        this.artifacts.set(id, artifactData);
        return id;
    }

    showArtifact(type, data, artifactId = null) {
        const container = document.getElementById('artifact-container');
        const contentDiv = container.querySelector('.artifact-content');
        const titleEl = container.querySelector('.artifact-title');
        const copyBtn = container.querySelector('.copy-artifact-btn');
        const downloadBtn = container.querySelector('.download-artifact-btn');
        const viewToggle = container.querySelector('.artifact-view-toggle');

        contentDiv.innerHTML = '';
        let currentArtifactId = artifactId;

        if (viewToggle) {
            viewToggle.classList.add('hidden');
        }

        switch (type) {
            case 'browser_view':
                titleEl.textContent = 'Interactive Browser';
                copyBtn.style.display = 'none';
                downloadBtn.style.display = 'none';
                this.renderBrowserView(data);
                currentArtifactId = this.browserArtifactId;
                this.artifacts.set(currentArtifactId, { content: data, type });
                break;

            case 'image':
                titleEl.textContent = 'Image Viewer';
                copyBtn.style.display = 'none';
                downloadBtn.style.display = 'inline-flex';
                if (data === null) {
                    contentDiv.innerHTML = '<div class="artifact-loading"><span>Loading image...</span></div>';
                } else {
                    this.renderImage(data, contentDiv);
                }
                break;

            case 'mermaid':
                titleEl.textContent = 'Diagram Viewer';
                copyBtn.style.display = 'inline-flex';
                downloadBtn.style.display = 'inline-flex';
                if (viewToggle) {
                    viewToggle.classList.remove('hidden');
                }
                const existingArtifact = currentArtifactId ? this.artifacts.get(currentArtifactId) : null;
                const viewMode = existingArtifact && existingArtifact.viewMode ? existingArtifact.viewMode : 'preview';
                this.currentViewMode = viewMode;
                this.updateViewToggleButtons(viewMode);
                this.renderMermaidView(data, contentDiv, viewMode);
                if (!currentArtifactId) {
                    currentArtifactId = this.createArtifact(data, type, null, viewMode);
                } else {
                    this.updateArtifactViewMode(currentArtifactId, viewMode);
                }
                break;

            default: // Handles code blocks
                titleEl.textContent = 'Code Viewer';
                copyBtn.style.display = 'inline-flex';
                downloadBtn.style.display = 'inline-flex';
                this.renderCode(data, type, contentDiv);
                if (!currentArtifactId) {
                    currentArtifactId = this.createArtifact(data, type);
                }
                break;
        }
        
        const chatContainer = document.querySelector('.chat-container');
        const inputContainer = document.querySelector('.floating-input-container');
        container.classList.remove('hidden');
        chatContainer.classList.add('with-artifact');
        inputContainer.classList.add('with-artifact');

        if (currentArtifactId) {
            container.dataset.activeArtifactId = currentArtifactId;
        } else {
            delete container.dataset.activeArtifactId;
        }

        return currentArtifactId;
    }

    updateArtifactViewMode(artifactId, viewMode) {
        const artifact = this.artifacts.get(artifactId);
        if (artifact && artifact.type === 'mermaid') {
            artifact.viewMode = viewMode;
        }
    }

    setViewMode(mode) {
        if (!mode || this.currentViewMode === mode) {
            return;
        }

        this.currentViewMode = mode;
        this.updateViewToggleButtons(mode);

        const container = document.getElementById('artifact-container');
        const contentDiv = container.querySelector('.artifact-content');
        const activeId = container.dataset.activeArtifactId;

        if (!activeId || !contentDiv) {
            return;
        }

        const artifact = this.artifacts.get(activeId);
        if (!artifact || artifact.type !== 'mermaid') {
            return;
        }

        this.updateArtifactViewMode(activeId, mode);
        contentDiv.innerHTML = '';
        this.renderMermaidView(artifact.content, contentDiv, mode);
    }

    updateViewToggleButtons(mode) {
        if (!Array.isArray(this.viewToggleButtons)) {
            return;
        }

        this.viewToggleButtons.forEach((button) => {
            const isActive = button.dataset.view === mode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    renderBrowserView(data) {
        const contentDiv = document.querySelector('#artifact-container .artifact-content');
        let browserViewContainer = document.getElementById('browser-view-content');

        if (!browserViewContainer) {
            browserViewContainer = document.createElement('div');
            browserViewContainer.id = 'browser-view-content';
            browserViewContainer.innerHTML = `
                <div class="browser-view-header">
                    <i class="fas fa-globe"></i>
                    <span class="browser-view-url" title="Current URL"></span>
                </div>
                <div class="browser-view-screenshot">
                    <img src="" alt="Browser Screenshot" />
                </div>
            `;
            contentDiv.appendChild(browserViewContainer);
        }

        const urlSpan = browserViewContainer.querySelector('.browser-view-url');
        const screenshotImg = browserViewContainer.querySelector('.browser-view-screenshot img');

        urlSpan.textContent = data.url || 'Loading...';
        if (data.screenshot_base64) {
            screenshotImg.src = `data:image/png;base64,${data.screenshot_base64}`;
        } else {
            screenshotImg.src = '';
            screenshotImg.alt = 'Screenshot not available.';
        }
    }

    renderImage(base64Data, container) {
        // Clear any loading state before rendering the image
        container.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'generated-image-artifact';
        img.src = `data:image/png;base64,${base64Data}`;
        img.alt = 'Generated Image';
        container.appendChild(img);
    }

    renderMermaidView(content, container, mode = 'preview') {
        if (mode === 'source') {
            this.renderMermaidSource(content, container);
        } else {
            this.renderMermaidPreview(content, container);
        }
    }

    renderMermaidSource(content, container) {
        this.renderCode(content, 'mermaid', container);
    }

    renderMermaidPreview(content, container) {
        const interactiveWrapper = document.createElement('div');
        interactiveWrapper.className = 'mermaid-interactive';
        interactiveWrapper.tabIndex = 0;
        interactiveWrapper.setAttribute('role', 'region');
        interactiveWrapper.setAttribute('aria-label', 'Interactive Mermaid diagram');

        const panContainer = document.createElement('div');
        panContainer.className = 'mermaid-pan-container';

        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.textContent = content;

        panContainer.appendChild(mermaidDiv);
        interactiveWrapper.appendChild(panContainer);
        container.appendChild(interactiveWrapper);

        mermaid.init(undefined, [mermaidDiv]);

        const hiddenSource = document.createElement('div');
        hiddenSource.className = 'mermaid-source-cache hidden';
        hiddenSource.textContent = content;
        container.appendChild(hiddenSource);

        const padding = 32;

        const hint = document.createElement('div');
        hint.className = 'mermaid-interactive-hint';
        hint.textContent = 'Scroll to zoom · Drag to pan · Press 0 to reset';
        interactiveWrapper.appendChild(hint);

        const transform = { x: 0, y: 0, scale: 1 };
        const bounds = { minScale: 0.3, maxScale: 3 };
        const zoomStep = 0.1;
        let isDragging = false;
        let pointerId = null;
        let lastPointerPosition = { x: 0, y: 0 };
        let hasInteracted = false;

        const applyTransform = () => {
            panContainer.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
        };

        const measureDiagram = () => {
            const svg = panContainer.querySelector('svg');
            if (!svg) {
                return { width: panContainer.offsetWidth, height: panContainer.offsetHeight };
            }
            const bbox = svg.getBBox();
            return { width: bbox.width + padding * 2, height: bbox.height + padding * 2 };
        };

        const centerDiagram = () => {
            const wrapperWidth = interactiveWrapper.clientWidth;
            const wrapperHeight = interactiveWrapper.clientHeight;
            const { width: contentWidth, height: contentHeight } = measureDiagram();

            if (!contentWidth || !contentHeight || !wrapperWidth || !wrapperHeight) {
                transform.x = 0;
                transform.y = 0;
                transform.scale = 1;
                applyTransform();
                return;
            }

            const fitScaleRaw = Math.min(wrapperWidth / contentWidth, wrapperHeight / contentHeight);
            const fitScale = Number.isFinite(fitScaleRaw) && fitScaleRaw > 0 ? Math.min(fitScaleRaw, 1) : 1;

            transform.scale = fitScale;
            const scaledWidth = contentWidth * transform.scale;
            const scaledHeight = contentHeight * transform.scale;

            transform.x = (wrapperWidth - scaledWidth) / 2;
            transform.y = (wrapperHeight - scaledHeight) / 2;
            applyTransform();
        };

        const markInteracted = () => {
            if (hasInteracted) return;
            hasInteracted = true;
            interactiveWrapper.classList.add('mermaid-interacted');
        };

        const setScale = (nextScale, centerX, centerY) => {
            const clamped = Math.min(bounds.maxScale, Math.max(bounds.minScale, nextScale));
            if (clamped === transform.scale) return;

            const rect = interactiveWrapper.getBoundingClientRect();
            const focalX = centerX !== undefined ? centerX : rect.width / 2;
            const focalY = centerY !== undefined ? centerY : rect.height / 2;

            const previousScale = transform.scale;
            const relativeX = (focalX - transform.x) / previousScale;
            const relativeY = (focalY - transform.y) / previousScale;

            transform.scale = clamped;
            transform.x = focalX - relativeX * transform.scale;
            transform.y = focalY - relativeY * transform.scale;

            applyTransform();
        };

        const zoomByStep = (direction, centerX, centerY) => {
            const factor = direction > 0 ? 1 + zoomStep : 1 - zoomStep;
            setScale(transform.scale * factor, centerX, centerY);
            markInteracted();
        };

        const resetTransform = () => {
            transform.scale = 1;
            transform.x = 0;
            transform.y = 0;
            this.normalizeMermaidSvg(panContainer, interactiveWrapper, padding);
            centerDiagram();
            applyTransform();
            markInteracted();
        };

        const prepareDiagram = () => {
            this.normalizeMermaidSvg(panContainer, interactiveWrapper, padding);
            centerDiagram();
        };

        requestAnimationFrame(prepareDiagram);

        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                if (hasInteracted) return;
                this.normalizeMermaidSvg(panContainer, interactiveWrapper, padding);
                centerDiagram();
            });
            resizeObserver.observe(interactiveWrapper);
        }

        interactiveWrapper.addEventListener('wheel', (event) => {
            event.preventDefault();
            const rect = interactiveWrapper.getBoundingClientRect();
            const localX = event.clientX - rect.left;
            const localY = event.clientY - rect.top;
            zoomByStep(event.deltaY < 0 ? 1 : -1, localX, localY);
        }, { passive: false });

        interactiveWrapper.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            isDragging = true;
            pointerId = event.pointerId;
            interactiveWrapper.setPointerCapture(pointerId);
            lastPointerPosition = { x: event.clientX, y: event.clientY };
            interactiveWrapper.classList.add('mermaid-grabbing');
            markInteracted();
        });

        interactiveWrapper.addEventListener('pointermove', (event) => {
            if (!isDragging || event.pointerId !== pointerId) return;
            const deltaX = event.clientX - lastPointerPosition.x;
            const deltaY = event.clientY - lastPointerPosition.y;
            lastPointerPosition = { x: event.clientX, y: event.clientY };
            transform.x += deltaX;
            transform.y += deltaY;
            applyTransform();
        });

        const endPointerInteraction = (event) => {
            if (!isDragging || (event && event.pointerId !== pointerId)) return;
            isDragging = false;
            interactiveWrapper.classList.remove('mermaid-grabbing');
            if (pointerId !== null) {
                interactiveWrapper.releasePointerCapture(pointerId);
            }
            pointerId = null;
        };

        ['pointerup', 'pointercancel'].forEach((evtName) => {
            interactiveWrapper.addEventListener(evtName, endPointerInteraction);
        });

        interactiveWrapper.addEventListener('pointerleave', (event) => {
            if (!isDragging) return;
            endPointerInteraction(event);
        });

        interactiveWrapper.addEventListener('keydown', (event) => {
            if (event.key === '+' || (event.key === '=' && event.shiftKey)) {
                zoomByStep(1);
                event.preventDefault();
            } else if (event.key === '-') {
                zoomByStep(-1);
                event.preventDefault();
            } else if (event.key === '0') {
                resetTransform();
                event.preventDefault();
            } else if (event.key === 'ArrowUp') {
                transform.y += 20;
                applyTransform();
                markInteracted();
                event.preventDefault();
            } else if (event.key === 'ArrowDown') {
                transform.y -= 20;
                applyTransform();
                markInteracted();
                event.preventDefault();
            } else if (event.key === 'ArrowLeft') {
                transform.x += 20;
                applyTransform();
                markInteracted();
                event.preventDefault();
            } else if (event.key === 'ArrowRight') {
                transform.x -= 20;
                applyTransform();
                markInteracted();
                event.preventDefault();
            }
        });

        const zoomControls = document.createElement('div');
        zoomControls.className = 'mermaid-controls';
        zoomControls.innerHTML = `
            <button class="zoom-in-btn" title="Zoom In"><i class="fas fa-plus"></i></button>
            <button class="zoom-out-btn" title="Zoom Out"><i class="fas fa-minus"></i></button>
            <button class="zoom-reset-btn" title="Reset View"><i class="fas fa-search"></i></button>
        `;
        container.appendChild(zoomControls);

        zoomControls.querySelector('.zoom-in-btn').addEventListener('click', () => {
            zoomByStep(1, interactiveWrapper.clientWidth / 2, interactiveWrapper.clientHeight / 2);
        });

        zoomControls.querySelector('.zoom-out-btn').addEventListener('click', () => {
            zoomByStep(-1, interactiveWrapper.clientWidth / 2, interactiveWrapper.clientHeight / 2);
        });

        zoomControls.querySelector('.zoom-reset-btn').addEventListener('click', () => {
            resetTransform();
        });
    }

    normalizeMermaidSvg(panContainer, wrapper, padding = 0) {
        if (!panContainer) return;

        const svg = panContainer.querySelector('svg');
        if (!svg) return;

        let bbox;
        try {
            bbox = svg.getBBox();
        } catch (error) {
            console.warn('ArtifactHandler: Unable to measure Mermaid diagram.', error);
            return;
        }

        const viewBoxWidth = bbox.width + padding * 2;
        const viewBoxHeight = bbox.height + padding * 2;
        if (!Number.isFinite(viewBoxWidth) || !Number.isFinite(viewBoxHeight) || viewBoxWidth <= 0 || viewBoxHeight <= 0) {
            return;
        }

        const viewBoxX = bbox.x - padding;
        const viewBoxY = bbox.y - padding;

        svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.maxWidth = 'none';
        svg.style.maxHeight = 'none';

        const targetWidth = wrapper ? Math.max(wrapper.clientWidth, viewBoxWidth) : viewBoxWidth;
        const targetHeight = wrapper ? Math.max(wrapper.clientHeight, viewBoxHeight) : viewBoxHeight;

        panContainer.style.minWidth = `${targetWidth}px`;
        panContainer.style.minHeight = `${targetHeight}px`;
        panContainer.style.padding = `${padding}px`;
    }

    renderCode(content, language, container) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = `language-${language}`;
        code.textContent = content;
        pre.appendChild(code);
        container.appendChild(pre);
        hljs.highlightElement(code);
    }

    hideArtifact() {
        const container = document.getElementById('artifact-container');
        const chatContainer = document.querySelector('.chat-container');
        const inputContainer = document.querySelector('.floating-input-container');
        
        container.classList.add('hidden');
        chatContainer.classList.remove('with-artifact');
        inputContainer.classList.remove('with-artifact');
    }

    reopenArtifact(artifactId) {
        const artifact = this.artifacts.get(artifactId);
        if (artifact && typeof artifact === 'object') {
            // If the artifact is pending, check if data arrived in pendingImages cache
            if (artifact.isPending && this.pendingImages.has(artifactId)) {
                const imageData = this.pendingImages.get(artifactId);
                artifact.content = imageData;
                artifact.isPending = false;
                this.pendingImages.delete(artifactId);
                this.showArtifact(artifact.type, imageData, artifactId);
                return;
            }
            
            // If the artifact is pending and no data available, show loading state
            // Otherwise, pass the actual content
            this.showArtifact(artifact.type, artifact.isPending ? null : artifact.content, artifactId);
        } else {
            console.error(`ArtifactHandler: Failed to find artifact with ID: ${artifactId}`);
        }
    }

    async copyArtifactContent() {
        const container = document.getElementById('artifact-container');
        const contentDiv = container.querySelector('.artifact-content');
        let content = '';

        const activeId = container.dataset.activeArtifactId;
        if (activeId && this.artifacts.has(activeId)) {
            const artifact = this.artifacts.get(activeId);
            if (artifact.type === 'mermaid') {
                content = artifact.content;
            }
        }

        if (!content) {
            const cachedSource = contentDiv.querySelector('.mermaid-source-cache');
            if (cachedSource) {
                content = cachedSource.textContent;
            }
        }

        if (!content && contentDiv.querySelector('code')) {
            content = contentDiv.querySelector('code').textContent;
        }

        if (content) {
            try {
                await navigator.clipboard.writeText(content);
                this.showNotification('Content copied to clipboard!', 'success');
            } catch (err) {
                this.showNotification('Failed to copy content', 'error');
            }
        }
    }

    async downloadArtifact() {
        const container = document.getElementById('artifact-container');
        const contentDiv = container.querySelector('.artifact-content');
        let content = '';
        let suggestedName = 'artifact';
        let extension = '.txt';
        let encoding = 'utf8';

        const activeId = container.dataset.activeArtifactId;
        if (activeId && this.artifacts.has(activeId)) {
            const artifact = this.artifacts.get(activeId);
            if (artifact.type === 'mermaid') {
                content = artifact.content;
                extension = '.mmd';
                suggestedName = 'diagram';
            }
        }

        if (!content) {
            const cachedSource = contentDiv.querySelector('.mermaid-source-cache');
            if (cachedSource) {
                content = cachedSource.textContent;
                extension = '.mmd';
                suggestedName = 'diagram';
            }
        }

        const imageEl = contentDiv.querySelector('.generated-image-artifact');

        if (imageEl) {
            const dataUri = imageEl.src;
            content = dataUri.split(',')[1];
            suggestedName = 'generated-image';
            extension = '.png';
            encoding = 'base64';
        } else if (!content && contentDiv.querySelector('.mermaid')) {
            content = contentDiv.querySelector('.mermaid').textContent;
            extension = '.mmd';
            suggestedName = 'diagram';
        } else if (contentDiv.querySelector('code')) {
            const code = contentDiv.querySelector('code');
            content = code.textContent;
            const language = code.className.replace('language-', '');
            extension = this.getFileExtension(language);
            suggestedName = `code`;
        }

        if (!content) return;

        try {
            const result = await window.electron.ipcRenderer.invoke('show-save-dialog', {
                title: 'Save File',
                defaultPath: suggestedName + extension,
                filters: [{ name: 'Image', extensions: ['png'] }, { name: 'All Files', extensions: ['*'] }]
            });
            
            if (result.canceled || !result.filePath) return;
            
            const success = await window.electron.ipcRenderer.invoke('save-file', {
                filePath: result.filePath,
                content: content,
                encoding: encoding 
            });
            
            if (success) {
                this.showNotification('File saved successfully', 'success');
            } else {
                this.showNotification('Failed to save file', 'error');
            }
        } catch (error) {
            console.error('Error saving file:', error);
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    getFileExtension(language) {
        const extensions = {
            javascript: '.js', python: '.py', html: '.html', css: '.css', json: '.json',
            typescript: '.ts', java: '.java', cpp: '.cpp', c: '.c', ruby: '.rb',
            php: '.php', go: '.go', rust: '.rs', swift: '.swift', kotlin: '.kt', mermaid: '.mmd',
            plaintext: '.txt'
        };
        return extensions[language] || '.txt';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `artifact-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // --- Sandbox methods are unchanged ---
    showTerminal(artifactId) {
        const container = document.getElementById('artifact-container');
        const contentDiv = container.querySelector('.artifact-content');
        
        container.querySelector('.artifact-title').textContent = 'Sandbox Terminal';
        container.querySelector('.copy-artifact-btn').style.display = 'none';
        container.querySelector('.download-artifact-btn').style.display = 'none';

        contentDiv.innerHTML = `
            <div class="terminal-output">
                <pre><code><span class="log-line log-status">Waiting for command...</span></code></pre>
            </div>
        `;

        container.classList.remove('hidden');
        container.dataset.activeArtifactId = artifactId;

        const chatContainer = document.querySelector('.chat-container');
        const inputContainer = document.querySelector('.floating-input-container');
        chatContainer.classList.add('with-artifact');
        inputContainer.classList.add('with-artifact');
    }

    updateCommand(artifactId, command) {
        const container = document.getElementById('artifact-container');
        if (container.dataset.activeArtifactId !== artifactId) return;
        
        const codeEl = container.querySelector('code');
        if (codeEl) {
            codeEl.innerHTML = `
                <span class="log-line log-command">$ ${command}</span>
                <span class="log-line log-status terminal-spinner">Running...</span>
            `;
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