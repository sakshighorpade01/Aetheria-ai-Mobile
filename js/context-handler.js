// js/context-handler.js (Corrected)

import { supabase } from './supabase-client.js';
import { messageFormatter } from './message-formatter.js';
import NotificationService from './notification-service.js';

const API_PROXY_URL = 'http://localhost:8765';

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
                console.error('Background session preload failed:', err);
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
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `Failed to load sessions (status ${response.status}).`);
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
                this.loadError = err?.message || 'An unexpected error occurred.';
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
        this.elements.listView.innerHTML = `
            <div class="empty-state">
                <p>${message}</p>
                <button class="retry-load-btn" type="button">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
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
            this.elements.listView.innerHTML = '<div class="empty-state">No sessions found.</div>';
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

        let sessionName = `Session ${session.session_id.substring(0, 8)}...`;
        if (session.memory?.runs?.length > 0) {
            const firstUserRun = session.memory.runs.find(run => run.role === 'user' && run.content && run.content.trim() !== '');
            if (firstUserRun) {
                let rawTitle = firstUserRun.content;
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
        const messageCount = session.memory?.runs?.length || 0;

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

        return this.loadedSessions
            .filter(session => selectedIds.has(session.session_id))
            .map(session => ({
                interactions: session.memory.runs.map(run => ({
                    user_input: run.role === 'user' ? run.content : '',
                    llm_output: run.role === 'assistant' ? run.content : ''
                }))
            }));
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

        const titleElement = view.querySelector('.session-header h3');
        if (titleElement) {
            const firstUserRun = session.memory.runs.find(run => run.role === 'user' && run.content && run.content.trim() !== '');
            let sessionName = `Session ${session.session_id.substring(0, 8)}...`;
            if (firstUserRun) {
                let rawTitle = firstUserRun.content;
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

        session.memory.runs.forEach(run => {
            const isUser = run.role === 'user';
            const content = isUser ? run.content : run.content;
            
            if (!content || !content.trim()) return;

            let messageContent = content;
            if (isUser) {
                const marker = 'Current message:';
                const index = content.lastIndexOf(marker);
                if (index !== -1) {
                    messageContent = content.substring(index + marker.length).trim();
                }
            }

            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
            msgDiv.innerHTML = messageFormatter.format(messageContent);
            conversationContainer.appendChild(msgDiv);
        });

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
}

export default ContextHandler;