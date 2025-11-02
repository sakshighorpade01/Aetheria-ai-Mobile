// js/context-handler.js (Corrected)

import { supabase } from './supabase-client.js';
import { messageFormatter } from './message-formatter.js';
import NotificationService from './notification-service.js';

// Backend API URL for session management - using deployed Render backend https://aios-web.onrender.com
const API_PROXY_URL = 'https://aios-web.onrender.com';

class ContextHandler {
    constructor({ preloadDelay = 2500 } = {}) {
        this.loadedSessions = [];
        this.selectedContextSessions = [];
        this.elements = {};
        this.triggerButton = null;
        this.notificationService = new NotificationService();

        this.preloadDelay = preloadDelay;
        this.loadingState = 'idle'; // idle | loading | loaded | error
        this.loadError = null;
        this.backgroundLoadTimer = null;
        this.isWindowOpen = false;
        this.pendingLoadPromise = null;
    }

    initializeElements() {
        this.elements.contextWindow = document.getElementById('context-window');
        if (!this.elements.contextWindow) return;

        this.elements.panel = this.elements.contextWindow.querySelector('.context-window-panel');
        this.elements.closeContextBtn = this.elements.contextWindow.querySelector('.close-context-btn');
        this.elements.syncBtn = this.elements.contextWindow.querySelector('.sync-context-btn');
        this.elements.sessionsContainer = this.elements.contextWindow.querySelector('.context-content');
        this.elements.listView = document.getElementById('context-list-view');
        this.elements.detailView = document.getElementById('context-detail-view');
        this.elements.contextBtn = document.querySelector('[data-tool="context"]');
    }

    bindEvents() {
        if (!this.elements.contextWindow) return;

        this.elements.contextWindow.addEventListener('click', (event) => {
            if (event.target === this.elements.contextWindow) {
                this.toggleWindow(false);
            }
        });
        this.elements.panel?.addEventListener('click', (e) => e.stopPropagation());
        this.elements.closeContextBtn?.addEventListener('click', () => this.toggleWindow(false));
        this.elements.syncBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.forceRefreshSessions();
        });

        this.elements.sessionsContainer?.addEventListener('change', (e) => {
            if (e.target.matches('.session-checkbox')) {
                const sessionItem = e.target.closest('.session-item');
                if (sessionItem) {
                    sessionItem.classList.toggle('selected', e.target.checked);
                    this.updateSelectionUI();
                }
            }
        });
    }

    toggleWindow(show, buttonElement = null) {
        if (!this.elements.contextWindow) return;

        if (show) {
            this.isWindowOpen = true;
            if (buttonElement) {
                this.triggerButton = buttonElement;
                this.triggerButton.classList.add('active');
            }

            this.elements.contextWindow.classList.remove('hidden');
            this.renderCurrentState();

            if (this.loadingState === 'idle') {
                this.loadSessionsInBackground().catch((err) => {
                    console.error('Context preload failed:', err);
                });
            }
        } else {
            this.isWindowOpen = false;
            this.elements.contextWindow.classList.add('hidden');
            if (this.triggerButton) {
                this.triggerButton.classList.remove('active');
                this.triggerButton = null;
            }
        }
    }

    preloadSessions() {
        if (this.loadingState !== 'idle') return;

        if (this.backgroundLoadTimer) {
            clearTimeout(this.backgroundLoadTimer);
        }

        this.backgroundLoadTimer = setTimeout(() => {
            this.backgroundLoadTimer = null;
            this.loadSessionsInBackground().catch((err) => {
                console.warn('Background session preload failed (this is normal if backend is unavailable):', err.message);
                // Don't show error notification for background preload failures
                // User will see error only when they actually open the sessions window
            });
        }, this.preloadDelay);
    }

    async loadSessionsInBackground({ force = false } = {}) {
        if (!force) {
            if (this.loadingState === 'loading' && this.pendingLoadPromise) {
                return this.pendingLoadPromise;
            }
            if (this.loadingState === 'loaded' && this.loadedSessions.length > 0) {
                return Promise.resolve(this.loadedSessions);
            }
        } else if (this.pendingLoadPromise) {
            return this.pendingLoadPromise;
        }

        if (this.backgroundLoadTimer) {
            clearTimeout(this.backgroundLoadTimer);
            this.backgroundLoadTimer = null;
        }

        this.loadingState = 'loading';
        this.loadError = null;

        if (this.isWindowOpen) {
            this.renderLoadingState();
        }

        const loadPromise = (async () => {
            try {
                try {
                    await supabase.auth.refreshSession();
                } catch (refreshError) {
                    console.warn('Supabase session refresh failed:', refreshError);
                }

                const { data, error } = await supabase.auth.getSession();
                const session = data?.session;
                if (error || !session?.access_token) {
                    throw new Error('Please log in to view chat history.');
                }

                const response = await fetch(`${API_PROXY_URL}/api/sessions`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                    signal: AbortSignal.timeout(15000) // 15 second timeout
                });

                if (!response.ok) {
                    let errorMessage = '';
                    
                    if (response.status === 503) {
                        errorMessage = 'Backend service is temporarily unavailable. Please try again in a few moments.';
                    } else if (response.status === 500) {
                        errorMessage = 'Server error occurred. Please try again later.';
                    } else if (response.status === 401 || response.status === 403) {
                        errorMessage = 'Authentication failed. Please log in again.';
                    } else {
                        try {
                            const errorText = await response.text();
                            const errorData = JSON.parse(errorText);
                            errorMessage = errorData.error || errorData.message || errorText;
                        } catch {
                            errorMessage = `Failed to load sessions (status ${response.status}).`;
                        }
                    }
                    
                    throw new Error(errorMessage);
                }

                const sessions = await response.json();
                this.loadedSessions = Array.isArray(sessions) ? sessions : [];
                this.loadingState = 'loaded';
                this.loadError = null;

                if (this.isWindowOpen) {
                    this.showSessionList(this.loadedSessions);
                }

                return this.loadedSessions;
            } catch (err) {
                console.error('Failed to load sessions:', err);
                
                // Handle different error types
                if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                    this.loadError = 'Request timed out. The backend may be slow or unavailable. Please try again.';
                } else if (err.message.includes('Failed to fetch') || err.message.includes('Network')) {
                    this.loadError = 'Network error. Please check your internet connection and try again.';
                } else if (err.message.includes('offline')) {
                    this.loadError = 'You appear to be offline. Please check your internet connection.';
                } else {
                    this.loadError = err?.message || 'An unexpected error occurred while loading sessions.';
                }
                
                this.loadingState = 'error';
                if (this.isWindowOpen) {
                    this.renderErrorState();
                }
                throw err;
            } finally {
                this.pendingLoadPromise = null;
            }
        })();

        this.pendingLoadPromise = loadPromise;
        return loadPromise;
    }

    async forceRefreshSessions() {
        this.loadingState = 'idle';
        this.loadError = null;
        return this.loadSessionsInBackground({ force: true });
    }

    renderCurrentState() {
        switch (this.loadingState) {
            case 'loaded':
                this.showSessionList(this.loadedSessions);
                break;
            case 'loading':
                this.renderLoadingState();
                break;
            case 'error':
                this.renderErrorState();
                break;
            case 'idle':
            default:
                this.renderIdleState();
                break;
        }
    }

    renderIdleState() {
        if (!this.elements.listView) return;
        this.elements.listView.classList.remove('hidden');
        this.elements.detailView?.classList.add('hidden');
        this.elements.listView.innerHTML = '<div class="session-item-loading">Preparing context history…</div>';
    }

    renderLoadingState() {
        if (!this.elements.listView) return;
        this.elements.listView.classList.remove('hidden');
        this.elements.detailView?.classList.add('hidden');
        this.elements.listView.innerHTML = '<div class="session-item-loading">Loading sessions…</div>';
    }

    renderErrorState() {
        if (!this.elements.listView) return;
        this.elements.listView.classList.remove('hidden');
        this.elements.detailView?.classList.add('hidden');

        const message = this.loadError || 'Unable to load previous sessions.';
        
        // Determine icon based on error type
        let icon = 'fa-exclamation-circle';
        if (message.includes('unavailable') || message.includes('503')) {
            icon = 'fa-server';
        } else if (message.includes('offline') || message.includes('Network')) {
            icon = 'fa-wifi-slash';
        } else if (message.includes('timeout')) {
            icon = 'fa-clock';
        } else if (message.includes('Authentication')) {
            icon = 'fa-lock';
        }
        
        this.elements.listView.innerHTML = `
            <div class="empty-state error-state">
                <i class="fas ${icon}"></i>
                <p>${message}</p>
                <button class="retry-load-btn" type="button">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
                ${message.includes('unavailable') ? `
                    <p class="error-hint">
                        <small>The backend service may be starting up or under maintenance. This usually resolves in a few minutes.</small>
                    </p>
                ` : ''}
            </div>
        `;

        this.elements.listView.querySelector('.retry-load-btn')?.addEventListener('click', () => this.forceRefreshSessions());
    }

    showSessionList(sessions) {
        if (!this.elements.listView || !this.elements.detailView) return;

        this.elements.listView.classList.remove('hidden');
        this.elements.detailView.classList.add('hidden');
        this.elements.detailView.innerHTML = ''; // ★★★ FIX: Clear detail view content
        this.elements.listView.innerHTML = '';

        if (!sessions || sessions.length === 0) {
            this.elements.listView.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>No chat sessions yet.<br>Start a conversation to see your history here.</p>
                </div>
            `;
            return;
        }

        this.addSelectionHeader();
        this.renderSessionItems(sessions);
        this.initializeSelectionControls();
        this.updateSelectionUI();
    }

    addSelectionHeader() {
        const selectionHeader = document.createElement('div');
        selectionHeader.className = 'selection-controls';
        selectionHeader.innerHTML = `
            <div class="selection-actions hidden">
                <span class="selected-count">0 selected</span>
                <button class="use-selected-btn">Use Selected</button>
                <button class="clear-selection-btn">Clear</button>
            </div>`;
        this.elements.listView.appendChild(selectionHeader);
    }

    renderSessionItems(sessions) {
        sessions.forEach(session => {
            this.elements.listView.appendChild(this.createSessionItem(session));
        });
    }

    createSessionItem(session) {
        const sessionItem = document.createElement('div');
        sessionItem.className = 'session-item';
        sessionItem.dataset.sessionId = session.session_id;

        // Support both session.runs and session.memory.runs structures
        const runs = session.runs || session.memory?.runs || [];

        let sessionName = `Session ${session.session_id.substring(0, 8)}...`;
        if (runs.length > 0) {
            // Try to find first user message from runs
            let firstUserMessage = null;
            for (const run of runs) {
                // Check if run has input content (new format)
                if (run.input && run.input.input_content) {
                    firstUserMessage = run.input.input_content;
                    break;
                }
                // Check if run is a user role message (legacy format)
                if (run.role === 'user' && run.content && run.content.trim() !== '') {
                    firstUserMessage = run.content;
                    break;
                }
            }

            if (firstUserMessage) {
                let rawTitle = firstUserMessage;
                const marker = 'Current message:';
                const index = rawTitle.lastIndexOf(marker);
                if (index !== -1) {
                    rawTitle = rawTitle.substring(index + marker.length).trim();
                }
                sessionName = rawTitle.split('\n')[0].trim();
                if (sessionName.length > 45) {
                    sessionName = sessionName.substring(0, 45) + '...';
                }
            }
        }

        const creationDate = new Date(session.created_at * 1000);
        const formattedDate = creationDate.toLocaleDateString() + ' ' + creationDate.toLocaleTimeString();
        const messageCount = runs.length;

        sessionItem.innerHTML = this.getSessionItemHTML(session, sessionName, formattedDate, messageCount);

        const contentArea = sessionItem.querySelector('.session-content');
        contentArea.onclick = (e) => {
            if (!['input', 'label'].includes(e.target.tagName.toLowerCase())) {
                this.showSessionDetails(session.session_id);
            }
        };

        return sessionItem;
    }

    getSessionItemHTML(session, sessionName, formattedDate, messageCount) {
        const checkboxId = `session-check-${session.session_id}`;
        return `
            <div class="session-select">
                <input type="checkbox" class="session-checkbox" id="${checkboxId}" />
                <label for="${checkboxId}" class="custom-checkbox"></label>
            </div>
            <div class="session-content">
                <h3>${sessionName}</h3>
                <div class="session-meta">
                    <div class="meta-item">
                        <i class="far fa-clock"></i>
                        <span>${formattedDate}</span>
                    </div>
                    <div class="meta-item">
                        <i class="far fa-comments"></i>
                        <span>${messageCount} messages</span>
                    </div>
                </div>
            </div>
        `;
    }

    initializeSelectionControls() {
        const useSelectedBtn = this.elements.listView.querySelector('.use-selected-btn');
        const clearBtn = this.elements.listView.querySelector('.clear-selection-btn');

        useSelectedBtn?.addEventListener('click', () => {
            const selectedData = this.getSelectedSessionsData();
            if (selectedData.length > 0) {
                this.selectedContextSessions = selectedData;
                this.renderSessionChips(); // Add chips to context bar
                this.toggleWindow(false);
                this.showNotification(`${selectedData.length} session(s) selected as context`, 'info');
            }
        });

        clearBtn?.addEventListener('click', () => this.clearSelectedContext());
    }

    updateSelectionUI() {
        const selectionActions = this.elements.listView.querySelector('.selection-actions');
        if (!selectionActions) return;

        const selectedCount = this.elements.listView.querySelectorAll('.session-checkbox:checked').length;
        selectionActions.classList.toggle('hidden', selectedCount === 0);

        if (selectedCount > 0) {
            selectionActions.querySelector('.selected-count').textContent = `${selectedCount} selected`;
        }
    }

    getSelectedSessionsData() {
        const selectedIds = new Set();
        this.elements.listView.querySelectorAll('.session-checkbox:checked').forEach(cb => {
            const sessionItem = cb.closest('.session-item');
            if (sessionItem) {
                selectedIds.add(sessionItem.dataset.sessionId);
            }
        });

        // Return full session objects (Electron format) - backend needs session_id to query data
        return this.loadedSessions.filter(session => selectedIds.has(session.session_id));
    }

    showSessionDetails(sessionId) {
        const session = this.loadedSessions.find(s => s.session_id === sessionId);
        if (!session || !this.elements.detailView) {
            this.showNotification('Could not find session details.', 'error');
            return;
        }

        const template = document.getElementById('session-detail-template');
        if (!template) return;

        const view = template.content.cloneNode(true);

        // Support both session.runs and session.memory.runs structures
        const runs = session.runs || session.memory?.runs || [];

        const titleElement = view.querySelector('.session-header h3');
        if (titleElement) {
            let firstUserMessage = null;
            for (const run of runs) {
                if (run.input && run.input.input_content) {
                    firstUserMessage = run.input.input_content;
                    break;
                }
                if (run.role === 'user' && run.content && run.content.trim() !== '') {
                    firstUserMessage = run.content;
                    break;
                }
            }

            let sessionName = `Session ${session.session_id.substring(0, 8)}...`;
            if (firstUserMessage) {
                let rawTitle = firstUserMessage;
                const marker = 'Current message:';
                const index = rawTitle.lastIndexOf(marker);
                if (index !== -1) {
                    rawTitle = rawTitle.substring(index + marker.length).trim();
                }
                sessionName = rawTitle.split('\n')[0].trim();
                if (sessionName.length > 45) {
                    sessionName = sessionName.substring(0, 45) + '...';
                }
            }
            titleElement.textContent = sessionName;
        }

        const conversationContainer = view.querySelector('.conversation-messages');
        if (!conversationContainer) return;

        // Check if session has runs data
        if (!Array.isArray(runs) || runs.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state';
            emptyMessage.innerHTML = `
                <i class="fas fa-inbox"></i>
                <p>This session has no conversation history.</p>
            `;
            conversationContainer.appendChild(emptyMessage);
        } else {
            // Filter only top-level runs (no parent_run_id)
            const topLevelRuns = runs.filter(run => !run.parent_run_id);

            topLevelRuns.forEach(run => {
                // Handle new format: run.input.input_content and run.content
                const userInput = run.input?.input_content || '';
                const assistantOutput = run.content || '';

                // Add user message if exists
                if (userInput && userInput.trim()) {
                    let messageContent = userInput;
                    const marker = 'Current message:';
                    const index = messageContent.lastIndexOf(marker);
                    if (index !== -1) {
                        messageContent = messageContent.substring(index + marker.length).trim();
                    }

                    const userMsgDiv = document.createElement('div');
                    userMsgDiv.className = 'message user-message';
                    userMsgDiv.innerHTML = messageFormatter.format(messageContent, { inlineArtifacts: true });
                    conversationContainer.appendChild(userMsgDiv);
                }

                // Add assistant message if exists
                if (assistantOutput && assistantOutput.trim()) {
                    const botMsgDiv = document.createElement('div');
                    botMsgDiv.className = 'message bot-message';
                    botMsgDiv.innerHTML = messageFormatter.format(assistantOutput, { inlineArtifacts: true });
                    conversationContainer.appendChild(botMsgDiv);
                }

                // Legacy format support: run.role and run.content
                if (!userInput && !assistantOutput && run.role && run.content) {
                    const isUser = run.role === 'user';
                    let messageContent = run.content;

                    if (isUser) {
                        const marker = 'Current message:';
                        const index = messageContent.lastIndexOf(marker);
                        if (index !== -1) {
                            messageContent = messageContent.substring(index + marker.length).trim();
                        }
                    }

                    const msgDiv = document.createElement('div');
                    msgDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
                    msgDiv.innerHTML = messageFormatter.format(messageContent, { inlineArtifacts: true });
                    conversationContainer.appendChild(msgDiv);
                }
            });
        }

        messageFormatter.applyInlineEnhancements?.(conversationContainer);

        this.elements.detailView.innerHTML = '';
        this.elements.detailView.appendChild(view);
        this.elements.listView.classList.add('hidden');
        this.elements.detailView.classList.remove('hidden');

        const backButton = this.elements.detailView.querySelector('.back-button');
        backButton?.addEventListener('click', () => this.showSessionList(this.loadedSessions));
    }

    clearSelectedContext() {
        this.elements.listView?.querySelectorAll('.session-checkbox:checked').forEach(cb => cb.checked = false);
        this.elements.listView?.querySelectorAll('.session-item.selected').forEach(item => item.classList.remove('selected'));
        this.selectedContextSessions = [];
        this.updateSelectionUI();
        this.renderSessionChips(); // Clear session chips from context bar
    }

    showNotification(message, type = 'info', duration = 3000) {
        if (this.notificationService) {
            this.notificationService.show(message, type, duration);
            return;
        }

        const container = document.querySelector('.notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        container.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    getSelectedSessions() {
        return this.selectedContextSessions;
    }

    /**
     * Invalidate cache when a new conversation is created
     * This ensures fresh data on next open
     */
    invalidateCache() {
        console.log('[ContextHandler] Cache invalidated');
        this.loadingState = 'idle';
        this.loadedSessions = [];
        this.loadError = null;
    }

    /**
     * Render session chips in the context files bar
     */
    renderSessionChips() {
        const contextFilesBar = document.getElementById('context-files-bar');
        const contextFilesContent = document.querySelector('.context-files-content');
        
        if (!contextFilesBar || !contextFilesContent) return;

        // Remove existing session chips
        contextFilesContent.querySelectorAll('.session-chip').forEach(chip => chip.remove());

        // Add new session chips
        this.selectedContextSessions.forEach((session, index) => {
            this.createSessionChip(session, index);
        });

        this.updateContextFilesBarVisibility();
    }

    /**
     * Create a single session chip
     */
    createSessionChip(session, index) {
        const contextFilesContent = document.querySelector('.context-files-content');
        if (!contextFilesContent) return;

        const chip = document.createElement('div');
        chip.className = 'session-chip';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-comments session-chip-icon';
        
        const title = document.createElement('span');
        title.className = 'session-chip-title';
        
        const runs = session.runs || session.memory?.runs || [];
        const topLevelRuns = runs.filter(run => !run.parent_run_id);
        const firstMessage = topLevelRuns[0]?.input?.input_content || `Session ${index + 1}`;
        title.textContent = firstMessage.substring(0, 25) + (firstMessage.length > 25 ? '...' : '');
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'session-chip-remove';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.title = 'Remove session';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeSelectedSession(index);
        });
        
        chip.appendChild(icon);
        chip.appendChild(title);
        chip.appendChild(removeBtn);
        
        contextFilesContent.appendChild(chip);
    }

    /**
     * Remove a selected session by index
     */
    removeSelectedSession(index) {
        if (index > -1 && index < this.selectedContextSessions.length) {
            this.selectedContextSessions.splice(index, 1);
            this.renderSessionChips();
        }
    }

    /**
     * Update context files bar visibility
     */
    updateContextFilesBarVisibility() {
        const contextFilesBar = document.getElementById('context-files-bar');
        const inputContainer = document.getElementById('floating-input-container');
        
        if (!contextFilesBar || !inputContainer) return;

        const hasFiles = window.fileAttachmentHandler && window.fileAttachmentHandler.attachedFiles && window.fileAttachmentHandler.attachedFiles.length > 0;
        const hasSessions = this.selectedContextSessions.length > 0;
        const hasContent = hasFiles || hasSessions;

        if (hasContent) {
            contextFilesBar.classList.remove('hidden');
            inputContainer.classList.add('has-files');
        } else {
            contextFilesBar.classList.add('hidden');
            inputContainer.classList.remove('has-files');
        }
    }
}

export default ContextHandler;