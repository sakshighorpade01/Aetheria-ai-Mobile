import { artifactHandler } from './artifact-handler.js';

const SANITIZE_TAGS = ['button', 'i', 'div', 'span', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
const SANITIZE_ATTRS = ['class', 'id', 'data-artifact-id', 'data-mermaid-source', 'aria-label', 'aria-pressed', 'role', 'title'];

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
                const { codeContent, normalizedLang } = this.extractCodeFromPayload(code, language);

                if (normalizedLang === 'mermaid') {
                    const artifactId = artifactHandler.createArtifact(codeContent, 'mermaid');
                    return `<button class="artifact-reference" data-artifact-id="${artifactId}">
                        <i class="fas fa-diagram-project"></i>
                        View Mermaid diagram
                    </button>`;
                }

                const validLanguage = typeof hljs !== 'undefined' && hljs.getLanguage(normalizedLang)
                    ? normalizedLang
                    : 'plaintext';
                const artifactId = artifactHandler.createArtifact(codeContent, validLanguage);
                return `<button class="artifact-reference" data-artifact-id="${artifactId}">
                    <i class="fas fa-code"></i>
                    View ${validLanguage} code block
                </button>`;
            },
            table: (header, body) => `<div class="table-container"><table class="formatted-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`,
        };

        marked.use({ renderer });
    }

    setupArtifactListeners() {
        document.addEventListener('click', (event) => {
            const button = event.target.closest('.artifact-reference');
            if (!button) return;
            const artifactId = button.dataset.artifactId;
            if (!artifactId) return;
            event.preventDefault();
            artifactHandler.reopenArtifact(artifactId);
        });
    }

    buildInlineRenderer() {
        const renderer = new marked.Renderer();

        renderer.code = (code, language = 'plaintext') => {
            const { codeContent, normalizedLang } = this.extractCodeFromPayload(code, language);

            if (normalizedLang === 'image') {
                return '<div class="inline-artifact-placeholder">Image preview unavailable in inline mode.</div>';
            }

            if (normalizedLang === 'mermaid') {
                return this.renderMermaidInline(codeContent);
            }

            return this.renderCodeInline(codeContent, normalizedLang);
        };

        renderer.table = (header, body) => `<div class="table-container"><table class="formatted-table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;

        return renderer;
    }

    extractCodeFromPayload(rawCode, language) {
        let codeContent = rawCode;
        let lang = language;

        if (typeof rawCode === 'string') {
            try {
                const parsed = JSON.parse(rawCode);
                if (parsed && typeof parsed === 'object') {
                    const keys = ['raw', 'code', 'content', 'text', 'output'];
                    for (const key of keys) {
                        if (parsed[key]) {
                            const value = parsed[key];
                            if (typeof value === 'string') {
                                const match = value.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)```$/);
                                codeContent = match ? match[1].trim() : value;
                            } else {
                                codeContent = JSON.stringify(value, null, 2);
                            }
                            lang = parsed.language || parsed.lang || lang || 'plaintext';
                            break;
                        }
                    }
                }
            } catch (err) {
                // Not JSON – use as-is
            }
        }

        return {
            codeContent,
            normalizedLang: (lang || 'plaintext').toLowerCase(),
        };
    }

    renderCodeInline(code, language) {
        const sanitized = this.hasDOMPurify
            ? DOMPurify.sanitize(code, { USE_PROFILES: { html: false } })
            : code;
        const langClass = language || 'plaintext';
        return `<pre class="inline-artifact-code"><code class="language-${langClass}">${sanitized}</code></pre>`;
    }

    renderMermaidInline(code) {
        const sanitized = this.hasDOMPurify
            ? DOMPurify.sanitize(code, { USE_PROFILES: { html: false } })
            : code;
        const escaped = this.escapeHtml(code);

        return `
            <div class="inline-mermaid-block" data-view-mode="preview">
                <div class="inline-mermaid-header" role="group" aria-label="Diagram view toggle">
                    <button type="button" class="inline-mermaid-toggle active" data-view="preview" aria-pressed="true" title="Preview diagram">
                        <i class="fas fa-eye" aria-hidden="true"></i>
                        <span class="sr-only">Diagram</span>
                    </button>
                    <button type="button" class="inline-mermaid-toggle" data-view="source" aria-pressed="false" title="View source code">
                        <i class="fas fa-code" aria-hidden="true"></i>
                        <span class="sr-only">Code</span>
                    </button>
                </div>
                <div class="inline-mermaid-content">
                    <div class="inline-artifact-mermaid" data-mermaid-source="${this.escapeHtmlAttribute(escaped)}">${sanitized}</div>
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
        if (!content) return '';
        if (!this.hasMarked || !this.hasDOMPurify) {
            return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        }

        const normalized = this.normalizeContent(content);
        const inlineMode = options.inlineArtifacts === true && this.inlineRenderer;

        const rawHtml = inlineMode
            ? marked.parse(normalized, { renderer: this.inlineRenderer })
            : marked.parse(normalized);

        return DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: SANITIZE_TAGS,
            ADD_ATTR: SANITIZE_ATTRS,
        });
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
            button.addEventListener('click', () => {
                const mode = button.dataset.view || 'preview';
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