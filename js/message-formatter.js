import { artifactHandler } from './artifact-handler.js';

const SANITIZE_TAGS = ['button', 'i', 'div', 'span', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
const SANITIZE_ATTRS = [
    'class', 'id', 'role', 'title', 'tabindex', 'aria-label', 'aria-pressed', 'aria-hidden',
    'data-artifact-id', 'data-mermaid-source', 'data-code-id', 'data-toggle-target', 
    'data-content-id', 'data-code-content', 'data-view'
];

class MessageFormatter {
    constructor() {
        this.pendingContent = new Map();
        this.mermaidInteractionMap = new WeakMap();
        this.inlineRenderer = null;

        this.hasMarked = typeof marked !== 'undefined';
        this.hasDOMPurify = typeof DOMPurify !== 'undefined';
        this.hasMermaid = typeof window !== 'undefined' && typeof window.mermaid !== 'undefined';

        if (this.hasMermaid) {
            this.initializeMermaid();
        }

        if (this.hasMarked && this.hasDOMPurify) {
            this.configureMarked();
            this.inlineRenderer = this.buildInlineRenderer();
            this.setupArtifactListeners();
        } else {
            console.warn('MessageFormatter: marked or DOMPurify unavailable; output will be minimally formatted.');
        }
    }

    initializeMermaid() {
        window.mermaid.initialize({
            startOnLoad: true,
            theme: document.body.classList.contains('dark-mode') ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: 'inherit',
        });
        this.setupMermaidThemeObserver();
    }

    configureMarked() {
        marked.setOptions({
            breaks: true,
            gfm: true,
            pedantic: false,
            silent: true,
            highlight: (code, lang) => {
                if (typeof hljs === 'undefined') {
                    return code;
                }
                if (!lang) {
                    return hljs.highlightAuto(code).value;
                }
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (err) {
                    return hljs.highlightAuto(code).value;
                }
            },
        });

        const renderer = {
            code: (code, language) => {
                console.log('[MessageFormatter] Default renderer code() called:', {
                    codeType: typeof code,
                    codeLength: code?.length,
                    language: language,
                    codePreview: typeof code === 'string' ? code.substring(0, 100) : code
                });

                try {
                    const { codeContent, normalizedLang } = this.extractCodeFromPayload(code, language);

                    console.log('[MessageFormatter] After extraction:', {
                        codeContentType: typeof codeContent,
                        codeContentLength: codeContent?.length,
                        normalizedLang: normalizedLang
                    });

                    // Ensure codeContent is a string
                    if (typeof codeContent !== 'string') {
                        console.error('[MessageFormatter] codeContent is not a string after extraction!', {
                            type: typeof codeContent,
                            value: codeContent
                        });
                        return `<pre><code>Error: Invalid code content type</code></pre>`;
                    }

                    // For Mermaid diagrams, ALWAYS render inline with diagram
                    if (normalizedLang === 'mermaid') {
                        console.log('[MessageFormatter] Rendering Mermaid diagram inline');
                        return this.renderMermaidInline(codeContent);
                    }

                    // For all other code, render as collapsible block
                    console.log('[MessageFormatter] Rendering collapsible code block');
                    return this.renderCollapsibleCode(codeContent, normalizedLang);
                } catch (error) {
                    console.error('[MessageFormatter] Error in code renderer:', error);
                    return `<pre><code>Error rendering code: ${error.message}</code></pre>`;
                }
            },
            table: (header, body) => `<div class="table-container"><table class="formatted-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`,
        };

        marked.use({ renderer });
    }

    setupArtifactListeners() {
        // Use event delegation with proper priority
        document.addEventListener('click', (event) => {
            // PRIORITY 1: Copy button (check first to prevent header toggle)
            const copyBtn = event.target.closest('.inline-code-copy-btn, .code-copy-btn');
            if (copyBtn) {
                console.log('[MessageFormatter] Copy button clicked');
                event.preventDefault();
                event.stopPropagation();
                
                const codeId = copyBtn.dataset.codeId;
                const wrapper = document.querySelector(`[data-code-id="${codeId}"]`);
                if (wrapper) {
                    const pre = wrapper.querySelector('pre');
                    const codeContent = pre?.dataset.codeContent || pre?.textContent || '';
                    
                    console.log('[MessageFormatter] Copying code, length:', codeContent.length);
                    
                    // Try modern clipboard API first, fallback to legacy method
                    const copyToClipboard = (text) => {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            return navigator.clipboard.writeText(text);
                        } else {
                            // Fallback for older browsers or insecure contexts
                            return new Promise((resolve, reject) => {
                                const textArea = document.createElement('textarea');
                                textArea.value = text;
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-999999px';
                                textArea.style.top = '-999999px';
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                
                                try {
                                    const successful = document.execCommand('copy');
                                    document.body.removeChild(textArea);
                                    if (successful) {
                                        resolve();
                                    } else {
                                        reject(new Error('execCommand failed'));
                                    }
                                } catch (err) {
                                    document.body.removeChild(textArea);
                                    reject(err);
                                }
                            });
                        }
                    };
                    
                    copyToClipboard(codeContent).then(() => {
                        console.log('[MessageFormatter] Code copied successfully');
                        const icon = copyBtn.querySelector('i');
                        const originalClass = icon.className;
                        icon.className = 'fas fa-check';
                        copyBtn.style.color = 'var(--success-500)';
                        
                        setTimeout(() => {
                            icon.className = originalClass;
                            copyBtn.style.color = '';
                        }, 2000);
                    }).catch(err => {
                        console.error('[MessageFormatter] Failed to copy code:', err);
                        alert('Failed to copy code: ' + err.message);
                    });
                }
                return; // Stop here, don't check other handlers
            }
            
            // PRIORITY 2: Artifact button
            const artifactBtn = event.target.closest('.artifact-reference');
            if (artifactBtn) {
                const artifactId = artifactBtn.dataset.artifactId;
                if (artifactId) {
                    event.preventDefault();
                    artifactHandler.reopenArtifact(artifactId);
                }
                return;
            }
            
            // PRIORITY 3: Code block header toggle (only if not clicking copy button)
            const codeHeader = event.target.closest('.code-block-header');
            if (codeHeader) {
                // Don't toggle if clicking on the copy button
                if (event.target.closest('.code-copy-btn')) {
                    return;
                }
                
                console.log('[MessageFormatter] Code header clicked');
                const codeId = codeHeader.dataset.toggleTarget;
                const contentDiv = document.querySelector(`[data-content-id="${codeId}"]`);
                const chevron = codeHeader.querySelector('.code-block-chevron');
                
                if (contentDiv) {
                    const isCollapsed = contentDiv.classList.contains('collapsed');
                    contentDiv.classList.toggle('collapsed');
                    contentDiv.classList.toggle('expanded');
                    
                    console.log('[MessageFormatter] Code block toggled, now:', isCollapsed ? 'expanded' : 'collapsed');
                    
                    if (chevron) {
                        chevron.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                    
                    // Apply syntax highlighting if expanding for first time
                    if (isCollapsed && typeof hljs !== 'undefined') {
                        const codeEl = contentDiv.querySelector('code');
                        if (codeEl && !codeEl.dataset.highlighted) {
                            hljs.highlightElement(codeEl);
                            codeEl.dataset.highlighted = 'true';
                        }
                    }
                }
                return;
            }
        });
    }

    buildInlineRenderer() {
        const renderer = new marked.Renderer();

        renderer.code = (code, language = 'plaintext') => {
            console.log('[MessageFormatter] Inline renderer code() called:', {
                codeType: typeof code,
                codeLength: code?.length,
                language: language
            });

            try {
                const { codeContent, normalizedLang } = this.extractCodeFromPayload(code, language);

                console.log('[MessageFormatter] Inline renderer after extraction:', {
                    codeContentType: typeof codeContent,
                    normalizedLang: normalizedLang
                });

                // Ensure codeContent is a string
                if (typeof codeContent !== 'string') {
                    console.error('[MessageFormatter] Inline: codeContent is not a string!', {
                        type: typeof codeContent,
                        value: codeContent
                    });
                    return `<pre><code>Error: Invalid code content</code></pre>`;
                }

                if (normalizedLang === 'image') {
                    return '<div class="inline-artifact-placeholder">Image preview unavailable in inline mode.</div>';
                }

                // For Mermaid, ALWAYS render the diagram inline with toggle
                if (normalizedLang === 'mermaid') {
                    console.log('[MessageFormatter] Rendering inline Mermaid with diagram');
                    return this.renderMermaidInline(codeContent);
                }

                // For all other code, render with collapsible dropdown and copy button
                console.log('[MessageFormatter] Rendering collapsible code block');
                return this.renderCollapsibleCode(codeContent, normalizedLang);
            } catch (error) {
                console.error('[MessageFormatter] Error in inline renderer:', error);
                return `<pre><code>Error: ${error.message}</code></pre>`;
            }
        };

        renderer.table = (header, body) => `<div class="table-container"><table class="formatted-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;

        return renderer;
    }

    extractCodeFromPayload(rawCode, language) {
        console.log('[MessageFormatter] extractCodeFromPayload called:', {
            rawCodeType: typeof rawCode,
            rawCode: rawCode,
            language: language
        });

        let codeContent = rawCode;
        let lang = language;

        // Handle marked's token object format
        if (typeof rawCode === 'object' && rawCode !== null) {
            console.log('[MessageFormatter] rawCode is object, checking for marked token format');
            
            // Marked passes tokens like: { type: 'code', raw: '```lang\ncode\n```', text: 'code', lang: 'lang' }
            if (rawCode.text && typeof rawCode.text === 'string') {
                console.log('[MessageFormatter] Found text property in token');
                codeContent = rawCode.text;
                lang = rawCode.lang || language || 'plaintext';
            } else if (rawCode.raw && typeof rawCode.raw === 'string') {
                console.log('[MessageFormatter] Found raw property in token');
                // Extract code from raw markdown
                const rawStr = rawCode.raw;
                const match = rawStr.match(/^```([a-zA-Z0-9]*)\n([\s\S]*?)\n```$/);
                if (match) {
                    lang = match[1] || rawCode.lang || language || 'plaintext';
                    codeContent = match[2];
                } else {
                    codeContent = rawStr;
                }
            } else {
                console.warn('[MessageFormatter] Unknown object format, stringifying');
                try {
                    codeContent = JSON.stringify(rawCode, null, 2);
                    lang = lang || 'json';
                } catch (e) {
                    console.error('[MessageFormatter] Failed to stringify object:', e);
                    codeContent = String(rawCode);
                }
            }
        } else if (typeof rawCode === 'string') {
            // If it's a string, check if it's wrapped in code fences
            const trimmed = rawCode.trim();
            const match = trimmed.match(/^```([a-zA-Z0-9]*)\n([\s\S]*?)\n```$/);
            if (match) {
                lang = match[1] || language || 'plaintext';
                codeContent = match[2];
            } else {
                codeContent = trimmed;
            }
        } else if (rawCode == null) {
            codeContent = '';
        } else {
            codeContent = String(rawCode);
        }

        const result = {
            codeContent: String(codeContent), // Ensure it's always a string
            normalizedLang: (lang || 'plaintext').toLowerCase(),
        };

        console.log('[MessageFormatter] extractCodeFromPayload result:', result);
        return result;
    }

    renderCollapsibleCode(code, language) {
        console.log('[MessageFormatter] renderCollapsibleCode called:', {
            codeType: typeof code,
            codeLength: code?.length,
            language: language
        });

        // Ensure code is a string
        const codeString = typeof code === 'string' ? code : String(code || '');
        const lineCount = codeString.split('\n').length;

        const sanitized = this.hasDOMPurify
            ? DOMPurify.sanitize(codeString, { USE_PROFILES: { html: false } })
            : codeString;
        const langClass = language || 'plaintext';
        
        // Store code for copy functionality
        const codeId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return `
            <div class="collapsible-code-block" data-code-id="${codeId}">
                <div class="code-block-header" role="button" tabindex="0" data-toggle-target="${codeId}">
                    <div class="code-block-info">
                        <i class="fas fa-code code-block-icon"></i>
                        <span class="code-block-language">${language || 'code'}</span>
                        <span class="code-block-lines">${lineCount} line${lineCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="code-block-actions">
                        <button class="code-copy-btn" data-code-id="${codeId}" title="Copy code">
                            <i class="fi fi-tr-copy"></i>
                        </button>
                        <i class="fas fa-chevron-down code-block-chevron"></i>
                    </div>
                </div>
                <div class="code-block-content collapsed" data-content-id="${codeId}">
                    <pre class="code-block-pre" data-code-content="${this.escapeHtmlAttribute(codeString)}"><code class="language-${langClass}">${sanitized}</code></pre>
                </div>
            </div>
        `;
    }

    renderCodeInline(code, language) {
        // Legacy function - now redirects to collapsible version
        return this.renderCollapsibleCode(code, language);
    }

    renderMermaidInline(code) {
        console.log('[MessageFormatter] renderMermaidInline called:', {
            codeType: typeof code,
            codeLength: code?.length
        });

        // Ensure code is a string
        const codeString = typeof code === 'string' ? code : String(code || '');

        const sanitized = this.hasDOMPurify
            ? DOMPurify.sanitize(codeString, { USE_PROFILES: { html: false } })
            : codeString;
        const escaped = this.escapeHtml(codeString);
        
        // Create artifact for full-size view
        const artifactId = artifactHandler.createArtifact(codeString, 'mermaid');
        console.log('[MessageFormatter] Created Mermaid artifact for inline:', artifactId);

        return `
            <div class="inline-mermaid-block" data-view-mode="preview">
                <div class="inline-mermaid-header" role="group" aria-label="Diagram view toggle">
                    <button type="button" class="inline-mermaid-toggle active" data-view="preview" aria-pressed="true" title="Preview diagram">
                        <i class="fas fa-eye" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="inline-mermaid-toggle" data-view="source" aria-pressed="false" title="View source code">
                        <i class="fas fa-code" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="inline-mermaid-toggle" data-view="fullsize" aria-pressed="false" title="View full size" data-artifact-id="${artifactId}">
                        <i class="fas fa-expand" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="inline-mermaid-content">
                    <div class="inline-mermaid-preview">
                        <div class="mermaid-pan-container">
                            <div class="inline-artifact-mermaid mermaid" data-mermaid-source="${this.escapeHtmlAttribute(escaped)}">${sanitized}</div>
                        </div>
                        <div class="mermaid-interactive-hint">Drag to pan • Scroll to zoom • Double-click to reset</div>
                    </div>
                    <pre class="inline-mermaid-source hidden"><code class="language-mermaid">${escaped}</code></pre>
                </div>
            </div>
        `;
    }

    escapeHtml(text = '') {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeHtmlAttribute(text = '') {
        return this.escapeHtml(text).replace(/`/g, '&#96;');
    }

    setupMermaidThemeObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return;
                const isDarkMode = document.body.classList.contains('dark-mode');
                window.mermaid.initialize({
                    theme: isDarkMode ? 'dark' : 'default',
                    securityLevel: 'loose',
                    fontFamily: 'inherit',
                });
                const pending = document.querySelectorAll('.mermaid:not([data-processed="true"])');
                if (pending.length) {
                    window.mermaid.init(undefined, pending);
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
        });
    }

    formatStreaming(content, streamId) {
        if (!this.pendingContent.has(streamId)) {
            this.pendingContent.set(streamId, '');
        }

        const aggregated = this.pendingContent.get(streamId) + content;
        this.pendingContent.set(streamId, aggregated);

        if (!this.hasMarked || !this.hasDOMPurify) {
            return aggregated;
        }

        try {
            const rawHtml = marked.parse(aggregated);
            return DOMPurify.sanitize(rawHtml, {
                ADD_TAGS: SANITIZE_TAGS,
                ADD_ATTR: SANITIZE_ATTRS,
            });
        } catch (err) {
            console.warn('MessageFormatter: streaming parse failed, rendering plaintext.', err);
            const sanitized = DOMPurify.sanitize(aggregated, { USE_PROFILES: { html: false } });
            return sanitized.replace(/\n/g, '<br>');
        }
    }

    format(content, options = {}) {
        console.log('[MessageFormatter] format() called:', {
            contentType: typeof content,
            contentLength: content?.length,
            options: options,
            hasMarked: this.hasMarked,
            hasDOMPurify: this.hasDOMPurify
        });

        if (!content) {
            console.log('[MessageFormatter] No content, returning empty string');
            return '';
        }

        if (!this.hasMarked || !this.hasDOMPurify) {
            console.warn('[MessageFormatter] Missing marked or DOMPurify');
            return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        }

        const normalized = this.normalizeContent(content);
        console.log('[MessageFormatter] Content normalized:', {
            normalizedType: typeof normalized,
            normalizedLength: normalized?.length,
            normalizedPreview: normalized?.substring(0, 100)
        });

        const inlineMode = options.inlineArtifacts === true && this.inlineRenderer;
        console.log('[MessageFormatter] Rendering mode:', inlineMode ? 'inline' : 'button');

        try {
            const rawHtml = inlineMode
                ? marked.parse(normalized, { renderer: this.inlineRenderer })
                : marked.parse(normalized);

            console.log('[MessageFormatter] Marked parse successful, sanitizing...');

            const sanitized = DOMPurify.sanitize(rawHtml, {
                ADD_TAGS: SANITIZE_TAGS,
                ADD_ATTR: SANITIZE_ATTRS,
            });

            console.log('[MessageFormatter] Sanitization complete');
            return sanitized;
        } catch (error) {
            console.error('[MessageFormatter] Error in format():', error);
            return `<pre>Error formatting content: ${error.message}</pre>`;
        }
    }

    normalizeContent(content) {
        if (typeof content === 'string') {
            return content;
        }

        if (content && typeof content === 'object') {
            try {
                const jsonString = JSON.stringify(content, null, 2);
                return `\`\`\`json\n${jsonString}\n\`\`\``;
            } catch (err) {
                return String(content);
            }
        }

        return String(content ?? '');
    }

    applyInlineEnhancements(root) {
        if (!root) return;

        if (typeof hljs !== 'undefined') {
            root.querySelectorAll('pre code').forEach((codeEl) => {
                if (codeEl.dataset.highlighted === 'true') return;
                try {
                    hljs.highlightElement(codeEl);
                    codeEl.dataset.highlighted = 'true';
                } catch (err) {
                    console.warn('MessageFormatter: code highlighting failed.', err);
                }
            });
        }

        if (!this.hasMermaid) return;

        const mermaidContainers = root.querySelectorAll('.inline-mermaid-block');
        const figuresToInit = [];

        mermaidContainers.forEach((container) => {
            const source = container.querySelector('.inline-artifact-mermaid');
            if (!source || source.dataset.inlinePrepared === 'true') return;

            source.dataset.inlinePrepared = 'true';
            const prepared = this.prepareInlineMermaidBlock(source);
            if (!prepared) return;

            const { previewWrapper, mermaidFigure } = prepared;
            figuresToInit.push(mermaidFigure);
            this.configureInlineMermaidToggle(container, previewWrapper, mermaidFigure);
        });

        if (figuresToInit.length) {
            window.mermaid.init(undefined, figuresToInit);
            figuresToInit.forEach((figure) => this.resetMermaidView(figure));
        }
    }

    prepareInlineMermaidBlock(sourceBlock) {
        const container = sourceBlock.parentElement;
        if (!container) return null;

        const previewWrapper = document.createElement('div');
        previewWrapper.className = 'inline-mermaid-preview';

        const panContainer = document.createElement('div');
        panContainer.className = 'mermaid-pan-container';

        const mermaidFigure = document.createElement('div');
        mermaidFigure.className = 'inline-mermaid-figure mermaid';
        mermaidFigure.textContent = sourceBlock.textContent;
        panContainer.appendChild(mermaidFigure);

        const hint = document.createElement('div');
        hint.className = 'mermaid-interactive-hint';
        hint.textContent = 'Drag to pan • Scroll to zoom • Double-click to reset';

        previewWrapper.appendChild(panContainer);
        previewWrapper.appendChild(hint);

        container.replaceChild(previewWrapper, sourceBlock);

        this.setupMermaidInteraction(mermaidFigure, previewWrapper, panContainer, hint);

        return { previewWrapper, mermaidFigure };
    }

    configureInlineMermaidToggle(container, previewWrapper, mermaidFigure) {
        if (!container || container.dataset.inlineToggleInitialized === 'true') return;

        const toggles = container.querySelectorAll('.inline-mermaid-toggle');
        if (!toggles.length) return;

        const sourceWrapper = container.querySelector('.inline-mermaid-source');

        const setMode = (mode) => {
            container.dataset.viewMode = mode;

            toggles.forEach((button) => {
                const isActive = button.dataset.view === mode;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });

            if (previewWrapper) {
                previewWrapper.classList.toggle('hidden', mode === 'source');
            }

            if (sourceWrapper) {
                sourceWrapper.classList.toggle('hidden', mode !== 'source');
                if (mode === 'source') {
                    const codeEl = sourceWrapper.querySelector('code');
                    if (codeEl && typeof hljs !== 'undefined' && !codeEl.dataset.highlighted) {
                        hljs.highlightElement(codeEl);
                        codeEl.dataset.highlighted = 'true';
                    }
                }
            }

            if (mode === 'preview') {
                this.resetMermaidView(mermaidFigure);
            }
        };

        toggles.forEach((button) => {
            button.addEventListener('click', (e) => {
                const mode = button.dataset.view || 'preview';
                
                // Handle full-size button
                if (mode === 'fullsize') {
                    const artifactId = button.dataset.artifactId;
                    if (artifactId) {
                        e.stopPropagation();
                        artifactHandler.reopenArtifact(artifactId);
                    }
                    return;
                }
                
                if (container.dataset.viewMode === mode) return;
                setMode(mode);
            });
        });

        setMode(container.dataset.viewMode || 'preview');
        container.dataset.inlineToggleInitialized = 'true';
    }

    setupMermaidInteraction(mermaidFigure, wrapper, panContainer, hint) {
        if (this.mermaidInteractionMap.has(mermaidFigure)) return;

        const state = {
            scale: 1,
            panX: 0,
            panY: 0,
            pointerDown: false,
            isPanning: false,
            pointerId: null,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
        };

        const entry = { figure: mermaidFigure, wrapper, panContainer, hint, state, resizeObserver: null };
        this.mermaidInteractionMap.set(mermaidFigure, entry);

        panContainer.style.transformOrigin = 'center center';
        this.applyMermaidTransform(entry);
        this.observeInlineResize(entry);

        const markInteracted = () => {
            if (hint) {
                wrapper.classList.add('mermaid-interacted');
            }
        };

        wrapper.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            state.pointerDown = true;
            state.pointerId = event.pointerId;
            state.startX = event.clientX;
            state.startY = event.clientY;
            state.lastX = event.clientX;
            state.lastY = event.clientY;
            wrapper.setPointerCapture?.(state.pointerId);
            event.preventDefault();
        });

        wrapper.addEventListener('pointermove', (event) => {
            if (!state.pointerDown) return;

            const dx = event.clientX - state.lastX;
            const dy = event.clientY - state.lastY;
            state.lastX = event.clientX;
            state.lastY = event.clientY;

            if (!state.isPanning) {
                const travelledX = event.clientX - state.startX;
                const travelledY = event.clientY - state.startY;
                if (Math.abs(travelledX) > 3 || Math.abs(travelledY) > 3) {
                    state.isPanning = true;
                    wrapper.classList.add('mermaid-grabbing');
                    markInteracted();
                } else {
                    return;
                }
            }

            state.panX += dx;
            state.panY += dy;
            this.applyMermaidTransform(entry);
        });

        const stopInteraction = () => {
            if (state.pointerId !== null) {
                wrapper.releasePointerCapture?.(state.pointerId);
            }
            state.pointerDown = false;
            state.isPanning = false;
            state.pointerId = null;
            wrapper.classList.remove('mermaid-grabbing');
        };

        wrapper.addEventListener('pointerup', stopInteraction);
        wrapper.addEventListener('pointerleave', stopInteraction);
        wrapper.addEventListener('pointercancel', stopInteraction);

        wrapper.addEventListener('wheel', (event) => {
            if (event.ctrlKey) return;
            event.preventDefault();

            const delta = event.deltaY < 0 ? 1 : -1;
            const factor = delta > 0 ? 1.1 : 0.9;
            const nextScale = Math.min(2.5, Math.max(0.5, state.scale * factor));
            if (nextScale === state.scale) return;

            state.scale = nextScale;
            markInteracted();
            this.applyMermaidTransform(entry);
        }, { passive: false });

        wrapper.addEventListener('dblclick', () => {
            state.scale = 1;
            state.panX = 0;
            state.panY = 0;
            state.pointerDown = false;
            state.isPanning = false;
            wrapper.classList.remove('mermaid-grabbing');
            markInteracted();
            this.applyMermaidTransform(entry);
        });
    }

    applyMermaidTransform(entry) {
        entry.panContainer.style.transform = `translate(${entry.state.panX}px, ${entry.state.panY}px) scale(${entry.state.scale})`;
    }

    observeInlineResize(entry) {
        if (typeof ResizeObserver === 'undefined' || entry.resizeObserver) return;

        entry.resizeObserver = new ResizeObserver(() => {
            if (entry.state.pointerDown || entry.state.isPanning) return;
            if (entry.state.scale !== 1 || entry.state.panX !== 0 || entry.state.panY !== 0) return;
            this.normalizeInlineMermaidSvg(entry);
        });

        entry.resizeObserver.observe(entry.wrapper);
    }

    normalizeInlineMermaidSvg(entry, padding = 16) {
        const svg = entry.panContainer.querySelector('svg');
        if (!svg) return;

        let bbox;
        try {
            bbox = svg.getBBox();
        } catch (err) {
            console.warn('MessageFormatter: unable to compute Mermaid bounds.', err);
            return;
        }

        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return;
        }

        const viewBoxX = bbox.x - padding;
        const viewBoxY = bbox.y - padding;

        svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${width} ${height}`);
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = '100%';

        entry.panContainer.style.minWidth = `${Math.max(entry.wrapper.clientWidth, width)}px`;
        entry.panContainer.style.minHeight = `${Math.max(entry.wrapper.clientHeight, height)}px`;
        entry.panContainer.style.padding = `${padding}px`;
    }

    resetMermaidView(mermaidFigure) {
        const entry = this.mermaidInteractionMap.get(mermaidFigure);
        if (!entry) return;

        entry.state.scale = 1;
        entry.state.panX = 0;
        entry.state.panY = 0;
        entry.state.pointerDown = false;
        entry.state.isPanning = false;
        entry.wrapper.classList.remove('mermaid-grabbing');

        this.applyMermaidTransform(entry);
        this.normalizeInlineMermaidSvg(entry);
    }

    finishStreaming(messageId) {
        this.pendingContent.delete(messageId);
    }
}

export const messageFormatter = new MessageFormatter();