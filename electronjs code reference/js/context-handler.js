// context-handler.js (Updated to include session_id)

class ContextHandler {
    constructor() {
        this.loadedSessions = []; 
        this.selectedContextSessions = [];
        
        // Background loading state management
        this.loadingState = 'idle'; // 'idle' | 'loading' | 'loaded' | 'error'
        this.loadError = null;
        this.backgroundLoadTimer = null;
        this.isWindowOpen = false;
        
        // Infinite scroll state
        this.currentOffset = 0;
        this.initialLoadCount = 15;
        this.loadMoreCount = 7;
        this.hasMoreSessions = true;
        this.isLoadingMore = false;
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        const contextWindow = document.getElementById('context-window');
        this.elements = {
            contextBtn: document.querySelector('[data-tool="context"]'),
            contextWindow: contextWindow,
            closeContextBtn: contextWindow?.querySelector('.close-context-btn'),
            syncBtn: contextWindow?.querySelector('.sync-context-btn'),
            sessionsContainer: contextWindow?.querySelector('.context-content'),
            indicator: document.querySelector('.context-active-indicator'),
            contextViewer: document.getElementById('selected-context-viewer')
        };
        if (this.elements.indicator) {
            this.elements.indicator.style.cursor = 'pointer';
            this.elements.indicator.addEventListener('click', () => {
                if (window.unifiedPreviewHandler) window.unifiedPreviewHandler.showViewer();
            });
        }
        const closeViewerBtn = document.querySelector('.close-viewer-btn');
        if (closeViewerBtn) {
            closeViewerBtn.addEventListener('click', () => this.hideContextViewer());
        }
    }

    bindEvents() {
        this.elements.contextBtn?.addEventListener('click', () => {
            this.isWindowOpen = true;
            this.elements.contextWindow?.classList.remove('hidden');
            this.openContextWindow();
            
            if (window.floatingWindowManager) {
                window.floatingWindowManager.onWindowOpen('context');
            }
        });

        // Title click to close (back button behavior)
        const headerTitle = document.getElementById('context-header-title');
        if (headerTitle) {
            headerTitle.addEventListener('click', () => {
                this.isWindowOpen = false;
                this.elements.contextWindow?.classList.add('hidden');
                
                if (window.floatingWindowManager) {
                    window.floatingWindowManager.onWindowClose('context');
                }
            });
        }

        // Title click to close history viewer
        const historyTitle = document.querySelector('.session-history-title');
        if (historyTitle) {
            historyTitle.addEventListener('click', () => {
                this.closeSessionHistoryViewer();
            });
        }

        // Search functionality
        const searchInput = document.getElementById('session-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterSessions(e.target.value);
            });
        }
        
        // Infinite scroll
        if (this.elements.sessionsContainer) {
            this.elements.sessionsContainer.addEventListener('scroll', () => {
                this.handleScroll();
            });
        }
    }
    
    handleScroll() {
        if (!this.elements.sessionsContainer || this.isLoadingMore || !this.hasMoreSessions) {
            return;
        }
        
        const container = this.elements.sessionsContainer;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // Load more when user is 200px from bottom
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            this.loadMoreSessions();
        }
    }
    
    async loadMoreSessions() {
        if (this.isLoadingMore || !this.hasMoreSessions) return;
        
        this.isLoadingMore = true;
        console.log('[ContextHandler] Loading more sessions...');
        
        try {
            // Show loading indicator at bottom
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-more-indicator';
            loadingIndicator.innerHTML = '<div class="session-item-loading">Loading more...</div>';
            this.elements.sessionsContainer.appendChild(loadingIndicator);
            
            const session = await window.electron.auth.getSession();
            if (!session || !session.access_token) {
                this.isLoadingMore = false;
                loadingIndicator.remove();
                return;
            }
            
            // Fetch next batch
            const newSessions = await window.electron.auth.fetchSessionTitles(this.loadMoreCount, this.currentOffset + this.loadedSessions.length);
            
            // Remove loading indicator
            loadingIndicator.remove();
            
            if (newSessions.length === 0) {
                this.hasMoreSessions = false;
                console.log('[ContextHandler] No more sessions to load');
            } else {
                // Append new sessions to existing list
                this.loadedSessions = [...this.loadedSessions, ...newSessions];
                
                // Render only the new sessions
                newSessions.forEach(sessionData => {
                    this.elements.sessionsContainer.appendChild(this.createSessionItem(sessionData));
                });
                
                console.log(`[ContextHandler] Loaded ${newSessions.length} more sessions`);
            }
            
        } catch (error) {
            console.error('[ContextHandler] Error loading more sessions:', error);
        } finally {
            this.isLoadingMore = false;
        }
    }
    
    closeSessionHistoryViewer() {
        const historyViewer = document.getElementById('session-history-viewer');
        const welcomeContainer = document.querySelector('.welcome-container');
        const floatingInput = document.getElementById('floating-input-container');
        const chatMessages = document.getElementById('chat-messages');
        
        // Hide history viewer
        if (historyViewer) historyViewer.classList.add('hidden');
        
        // Show chat interface elements
        if (welcomeContainer) welcomeContainer.style.display = '';
        if (floatingInput) floatingInput.style.display = '';
        if (chatMessages) chatMessages.style.display = '';
    }

    /**
     * Start background loading of sessions (called after app initialization)
     * This runs 2-3 seconds after app starts to avoid blocking initial load
     */
    preloadSessions() {
        // Don't start if already loading or loaded
        if (this.loadingState !== 'idle') {
            return;
        }

        // Clear any existing timer
        if (this.backgroundLoadTimer) {
            clearTimeout(this.backgroundLoadTimer);
        }

        // Start loading after a short delay (2.5 seconds)
        this.backgroundLoadTimer = setTimeout(() => {
            this.loadSessionsInBackground();
        }, 2500);
    }

    /**
     * Load sessions in the background without showing UI
     * Now optimized to fetch only titles first (lightweight)
     */
    async loadSessionsInBackground() {
        // Prevent duplicate loads
        if (this.loadingState === 'loading' || this.loadingState === 'loaded') {
            return;
        }

        this.loadingState = 'loading';
        this.loadError = null;

        console.log('[ContextHandler] Starting background session load...');

        try {
            const session = await window.electron.auth.getSession();
            if (!session || !session.access_token) {
                console.log('[ContextHandler] No auth session, skipping background load');
                this.loadingState = 'idle';
                return;
            }

            if (!window.electron.auth.fetchSessionTitles) {
                throw new Error('fetchSessionTitles helper is unavailable');
            }

            // Fetch only titles (lightweight) - no runs data
            const sessionTitles = await window.electron.auth.fetchSessionTitles(15);
            this.loadedSessions = sessionTitles;
            this.loadingState = 'loaded';
            
            console.log(`[ContextHandler] Background load complete: ${sessionTitles.length} session titles cached`);
            console.log(`[ContextHandler] Session IDs:`, sessionTitles.map(s => s.session_id.substring(0, 8)));

            // If the window is currently open, update the display
            if (this.isWindowOpen && this.elements.sessionsContainer) {
                this.showSessionList(sessionTitles);
            }

        } catch (err) {
            console.error('[ContextHandler] Error in background load:', err);
            this.loadError = err.message;
            this.loadingState = 'error';
        }
    }

    /**
     * Handle opening the context window - show cached data or loading state
     */
    openContextWindow() {
        if (!this.elements.sessionsContainer) return;

        switch (this.loadingState) {
            case 'loaded':
                // Data is already loaded - show it immediately!
                console.log('[ContextHandler] Showing cached sessions');
                this.showSessionList(this.loadedSessions);
                break;

            case 'loading':
                // Currently loading in background - show skeleton
                console.log('[ContextHandler] Background load in progress...');
                this.showSkeletonLoading();
                // Data will appear automatically when background load completes
                break;

            case 'error':
                // Previous load failed - show error and retry button
                this.elements.sessionsContainer.innerHTML = `
                    <div class="empty-state">
                        <p>Error loading sessions: ${this.loadError}</p>
                        <button class="retry-load-btn" style="margin-top: 10px; padding: 8px 16px; cursor: pointer;">
                            <i class="fas fa-sync-alt"></i> Retry
                        </button>
                    </div>
                `;
                const retryBtn = this.elements.sessionsContainer.querySelector('.retry-load-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => this.forceRefreshSessions());
                }
                break;

            case 'idle':
            default:
                // Not loaded yet - start loading now with skeleton
                console.log('[ContextHandler] Starting immediate load...');
                this.showSkeletonLoading();
                this.loadSessionsInBackground();
                break;
        }
    }
    
    showSkeletonLoading() {
        if (!this.elements.sessionsContainer) return;
        
        this.elements.sessionsContainer.innerHTML = '';
        this.elements.sessionsContainer.style.display = 'block';
        
        // Create 5 skeleton items
        for (let i = 0; i < 5; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-session-item';
            skeleton.innerHTML = `
                <div class="skeleton-session-title"></div>
                <div class="skeleton-session-meta"></div>
            `;
            this.elements.sessionsContainer.appendChild(skeleton);
        }
    }

    /**
     * Force refresh sessions (called by sync button or retry)
     */
    async forceRefreshSessions() {
        if (!this.elements.sessionsContainer) return;

        // Reset state to force reload
        this.loadingState = 'idle';
        this.loadError = null;
        this.currentOffset = 0;
        this.hasMoreSessions = true;

        // Show skeleton loading
        this.showSkeletonLoading();

        // Start loading
        await this.loadSessionsInBackground();
    }

    showSessionList(sessions) {
        this.elements.sessionsContainer.innerHTML = '';
        this.elements.sessionsContainer.style.display = 'block';
        if (sessions.length === 0) {
            this.elements.sessionsContainer.innerHTML = '<div class="empty-state">No sessions found.</div>';
            return;
        }
        this.addSelectionHeader();
        this.renderSessionItems(sessions);
        this.initializeSelectionControls();
    }

    addSelectionHeader() {
        const selectionHeader = document.createElement('div');
        selectionHeader.className = 'selection-controls';
        selectionHeader.style.display = 'none'; // Hidden by default
        selectionHeader.innerHTML = `
            <div class="selection-actions">
                <span class="selected-count">0 selected</span>
                <button class="use-selected-btn">Use Selected</button>
                <button class="clear-selection-btn">Clear</button>
            </div>`;
        this.elements.sessionsContainer.appendChild(selectionHeader);
    }

    renderSessionItems(sessions) {
        sessions.forEach(sessionData => {
            this.elements.sessionsContainer.appendChild(this.createSessionItem(sessionData));
        });
    }

    createSessionItem(session) {
        const sessionItem = document.createElement('div');
        sessionItem.className = 'session-item';
        sessionItem.dataset.sessionId = session.session_id;
        sessionItem.dataset.sessionTitle = session.session_title || '';
        
        // Use title from session_titles table if available
        let sessionName = session.session_title?.trim();
        if (sessionName) {
            sessionName = sessionName.length > 60 ? sessionName.substring(0, 60) + '...' : sessionName;
        }

        // Fallback to session ID if no title
        if (!sessionName) {
            sessionName = `Session ${session.session_id.substring(0, 8)}...`;
        }
        
        const creationDate = new Date(session.created_at * 1000);
        const now = new Date();
        const diffMs = now - creationDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        let formattedDate;
        if (diffDays === 0) {
            formattedDate = 'Today';
        } else if (diffDays === 1) {
            formattedDate = 'Yesterday';
        } else if (diffDays < 7) {
            formattedDate = `${diffDays} days ago`;
        } else {
            formattedDate = creationDate.toLocaleDateString();
        }

        sessionItem.innerHTML = this.getSessionItemHTML(session, sessionName, formattedDate);
        
        // Single click opens details, double click selects
        let clickCount = 0;
        let clickTimer = null;
        
        sessionItem.addEventListener('click', (e) => {
            clickCount++;
            
            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    // Single click - open details
                    this.showSessionDetails(session.session_id);
                    clickCount = 0;
                }, 250);
            } else if (clickCount === 2) {
                // Double click - toggle selection
                clearTimeout(clickTimer);
                this.toggleSessionSelection(sessionItem);
                clickCount = 0;
            }
        });
        
        return sessionItem;
    }
    
    getSessionItemHTML(session, sessionName, formattedDate) {
        // PHASE 3: Add attachment indicator if session has attachments
        const attachmentIcon = session.has_attachments 
            ? '<i class="fas fa-paperclip session-attachment-icon" title="Has attachments"></i>' 
            : '';
        
        return `
            <div class="session-content">
                <h3>${sessionName} ${attachmentIcon}</h3>
                <div class="session-meta">
                    <span class="session-date">${formattedDate}</span>
                </div>
            </div>
        `;
    }
    
    toggleSessionSelection(sessionItem) {
        const isSelected = sessionItem.classList.contains('selected');
        
        if (isSelected) {
            sessionItem.classList.remove('selected');
        } else {
            sessionItem.classList.add('selected');
        }
        
        this.updateSelectionUI();
    }
    
    filterSessions(searchTerm) {
        const sessionItems = this.elements.sessionsContainer?.querySelectorAll('.session-item');
        const term = searchTerm.toLowerCase().trim();
        
        sessionItems?.forEach(item => {
            const title = item.dataset.sessionTitle?.toLowerCase() || '';
            const sessionId = item.dataset.sessionId?.toLowerCase() || '';
            
            if (title.includes(term) || sessionId.includes(term) || term === '') {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    initializeSelectionControls() {
        const useSelectedBtn = this.elements.sessionsContainer.querySelector('.use-selected-btn');
        const clearBtn = this.elements.sessionsContainer.querySelector('.clear-selection-btn');
        if (useSelectedBtn) {
            useSelectedBtn.addEventListener('click', async () => {
                // Show loading state
                useSelectedBtn.disabled = true;
                useSelectedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                
                try {
                    const selectedData = await this.getSelectedSessionsData();
                    if (selectedData.length > 0) {
                        this.selectedContextSessions = selectedData;
                        
                        // PHASE 4: Re-attach files from selected sessions
                        await this.reattachSessionFiles(selectedData);
                        
                        this.elements.contextWindow.classList.add('hidden');
                        this.updateContextIndicator();
                        this.showNotification(`${selectedData.length} sessions selected as context`, 'info');
                        
                        if (window.floatingWindowManager) {
                            window.floatingWindowManager.onWindowClose('context');
                        }
                    }
                } catch (error) {
                    console.error('Error loading selected sessions:', error);
                    this.showNotification('Failed to load selected sessions', 'error');
                } finally {
                    useSelectedBtn.disabled = false;
                    useSelectedBtn.innerHTML = 'Use Selected';
                }
            });
        }
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearSelectedContext());
    }

    updateSelectionUI() {
        const selectionControls = this.elements.sessionsContainer?.querySelector('.selection-controls');
        if (!selectionControls) return;
        
        const selectedCount = this.elements.sessionsContainer.querySelectorAll('.session-item.selected').length;
        
        if (selectedCount > 0) {
            selectionControls.style.display = 'block';
            selectionControls.querySelector('.selected-count').textContent = `${selectedCount} selected`;
        } else {
            selectionControls.style.display = 'none';
        }
    }

    /**
     * Get selected sessions data - now fetches full data on-demand
     */
    async getSelectedSessionsData() {
        const selectedIds = new Set();
        this.elements.sessionsContainer.querySelectorAll('.session-item.selected').forEach(item => {
            selectedIds.add(item.dataset.sessionId);
        });
        
        // Fetch full session data for selected sessions
        const selectedSessions = [];
        for (const sessionId of selectedIds) {
            try {
                const fullSession = await window.electron.auth.fetchSessionData(sessionId);
                if (fullSession) {
                    selectedSessions.push(fullSession);
                }
            } catch (error) {
                console.error(`Failed to fetch session ${sessionId}:`, error);
            }
        }
        
        return selectedSessions;
    }

    async showSessionDetails(sessionId) {
        try {
            // Get the center viewer
            const historyViewer = document.getElementById('session-history-viewer');
            const historyTitle = historyViewer.querySelector('.session-history-title');
            const historyContent = historyViewer.querySelector('.session-history-content');
            
            if (!historyViewer || !historyTitle || !historyContent) {
                console.error("Session history viewer elements not found!");
                return;
            }
            
            // Show skeleton loading immediately
            historyTitle.textContent = 'Loading...';
            historyContent.innerHTML = '';
            
            const skeletonContainer = document.createElement('div');
            skeletonContainer.className = 'skeleton-history-loading';
            
            // Create 3 skeleton messages
            for (let i = 0; i < 3; i++) {
                const skeletonMsg = document.createElement('div');
                skeletonMsg.className = 'skeleton-message';
                skeletonMsg.innerHTML = `
                    <div class="skeleton-message-line"></div>
                    <div class="skeleton-message-line"></div>
                    <div class="skeleton-message-line"></div>
                `;
                skeletonContainer.appendChild(skeletonMsg);
            }
            
            historyContent.appendChild(skeletonContainer);
            
            // Hide chat interface and show viewer
            const welcomeContainer = document.querySelector('.welcome-container');
            const floatingInput = document.getElementById('floating-input-container');
            const chatMessages = document.getElementById('chat-messages');
            
            if (welcomeContainer) welcomeContainer.style.display = 'none';
            if (floatingInput) floatingInput.style.display = 'none';
            if (chatMessages) chatMessages.style.display = 'none';
            
            historyViewer.classList.remove('hidden');
            
            // Fetch full session data including runs
            const session = await window.electron.auth.fetchSessionData(sessionId);
            
            if (!session) {
                this.showNotification('Could not find session details.', 'error');
                this.closeSessionHistoryViewer();
                return;
            }

            const runs = session.runs || [];
            const topLevelRuns = runs.filter(run => !run.parent_run_id);

            // Use title from session_titles table, or fallback to first user input
            let displayTitle = session.session_title;
            if (!displayTitle && topLevelRuns.length > 0 && topLevelRuns[0]?.input?.input_content) {
                displayTitle = topLevelRuns[0].input.input_content.split('\n')[0].trim();
            }
            
            if (displayTitle) {
                const trimmed = displayTitle.trim();
                historyTitle.textContent = trimmed.length > 60 ? `${trimmed.substring(0, 60)}...` : trimmed;
            } else {
                historyTitle.textContent = `Session ${sessionId.substring(0, 8)}`;
            }

            // Clear and populate content
            historyContent.innerHTML = '';

            // PHASE 3: Fetch and display attachments
            try {
                const attachments = await window.electron.auth.fetchSessionAttachments(sessionId);
                if (attachments && attachments.length > 0) {
                    const attachmentsSection = document.createElement('div');
                    attachmentsSection.className = 'session-attachments-section';
                    attachmentsSection.innerHTML = `
                        <h4 class="attachments-header">
                            <i class="fas fa-paperclip"></i> 
                            Attachments (${attachments.length})
                        </h4>
                        <div class="attachments-list"></div>
                    `;
                    
                    const attachmentsList = attachmentsSection.querySelector('.attachments-list');
                    
                    for (const attachment of attachments) {
                        const attachmentItem = document.createElement('div');
                        attachmentItem.className = 'attachment-item';
                        
                        // Check if file exists locally
                        const fileExists = await window.electron.fileArchive.fileExists(attachment.relativePath);
                        const statusIcon = fileExists 
                            ? '<i class="fas fa-check-circle attachment-status-ok" title="Available locally"></i>'
                            : '<i class="fas fa-exclamation-triangle attachment-status-missing" title="File not found locally"></i>';
                        
                        attachmentItem.innerHTML = `
                            <i class="fas fa-file attachment-icon"></i>
                            <div class="attachment-info">
                                <span class="attachment-name">${attachment.name}</span>
                                <span class="attachment-meta">${this.formatFileSize(attachment.size)}</span>
                            </div>
                            ${statusIcon}
                            ${fileExists ? '<button class="open-attachment-btn" title="Open file"><i class="fas fa-external-link-alt"></i></button>' : ''}
                        `;
                        
                        if (fileExists) {
                            const openBtn = attachmentItem.querySelector('.open-attachment-btn');
                            openBtn.addEventListener('click', async () => {
                                try {
                                    await window.electron.fileArchive.openFile(attachment.relativePath);
                                } catch (error) {
                                    console.error('Error opening file:', error);
                                    this.showNotification('Could not open file', 'error');
                                }
                            });
                        }
                        
                        attachmentsList.appendChild(attachmentItem);
                    }
                    
                    historyContent.appendChild(attachmentsSection);
                }
            } catch (error) {
                console.error('[ContextHandler] Error fetching attachments:', error);
                // Non-critical, continue showing session
            }

            if (topLevelRuns.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.textContent = 'No messages in this session.';
                historyContent.appendChild(emptyState);
            } else {
                for (const run of topLevelRuns) {
                    const turnContainer = document.createElement('div');
                    turnContainer.className = 'conversation-turn';

                    if (run.input?.input_content) {
                        const userMessageDiv = document.createElement('div');
                        userMessageDiv.className = 'turn-user-message';
                        const messageText = document.createElement('div');
                        messageText.className = 'message-text';
                        messageText.textContent = run.input.input_content;
                        userMessageDiv.appendChild(messageText);
                        turnContainer.appendChild(userMessageDiv);
                    }

                    const assistantResponseDiv = document.createElement('div');
                    assistantResponseDiv.className = 'turn-assistant-response';
                    
                    if (window.renderTurnFromEvents) {
                        window.renderTurnFromEvents(assistantResponseDiv, run, { inlineArtifacts: true, replaying: true });
                    } else {
                        const fallbackText = document.createElement('div');
                        fallbackText.className = 'message-text';
                        fallbackText.textContent = run.content || '(Could not render detailed response)';
                        assistantResponseDiv.appendChild(fallbackText);
                    }

                    turnContainer.appendChild(assistantResponseDiv);
                    historyContent.appendChild(turnContainer);
                }
            }

        } catch (error) {
            console.error('[ContextHandler] Error loading session details:', error);
            this.showNotification('Failed to load session details: ' + error.message, 'error');
            this.closeSessionHistoryViewer();
        }
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * PHASE 4: Re-attach files from selected sessions to current conversation
     * @param {Array} sessions - Selected session data
     */
    async reattachSessionFiles(sessions) {
        try {
            console.log('[ContextHandler] Checking for attachments in selected sessions...');
            
            let totalFilesReattached = 0;
            
            for (const session of sessions) {
                // Fetch attachments for this session
                const attachments = await window.electron.auth.fetchSessionAttachments(session.session_id);
                
                if (!attachments || attachments.length === 0) {
                    continue;
                }
                
                console.log(`[ContextHandler] Found ${attachments.length} attachments in session ${session.session_id.substring(0, 8)}`);
                
                // Re-attach each file
                for (const attachment of attachments) {
                    try {
                        // Check if file exists locally
                        const fileExists = await window.electron.fileArchive.fileExists(attachment.relativePath);
                        
                        if (!fileExists) {
                            console.warn(`[ContextHandler] File not found locally: ${attachment.name}`);
                            continue;
                        }
                        
                        // Read file from local storage
                        const fileBuffer = await window.electron.fileArchive.readFile(attachment.relativePath);
                        
                        // Create a File object from the buffer
                        const blob = new Blob([fileBuffer], { type: attachment.type });
                        const file = new File([blob], attachment.name, { 
                            type: attachment.type,
                            lastModified: Date.now()
                        });
                        
                        // Programmatically trigger file attachment handler
                        if (window.fileAttachmentHandler) {
                            console.log(`[ContextHandler] Re-attaching file: ${attachment.name}`);
                            await this.programmaticallyAttachFile(file);
                            totalFilesReattached++;
                        }
                        
                    } catch (fileError) {
                        console.error(`[ContextHandler] Error re-attaching file ${attachment.name}:`, fileError);
                    }
                }
            }
            
            if (totalFilesReattached > 0) {
                console.log(`[ContextHandler] Successfully re-attached ${totalFilesReattached} files from context sessions`);
                this.showNotification(`Re-attached ${totalFilesReattached} file${totalFilesReattached > 1 ? 's' : ''} from selected sessions`, 'success');
            }
            
        } catch (error) {
            console.error('[ContextHandler] Error re-attaching session files:', error);
            // Non-critical error, don't block context selection
        }
    }

    /**
     * Programmatically attach a file (simulates user file selection)
     * @param {File} file - File object to attach
     */
    async programmaticallyAttachFile(file) {
        if (!window.fileAttachmentHandler) {
            throw new Error('FileAttachmentHandler not available');
        }
        
        // Create a fake event object that mimics file input change event
        const fakeEvent = {
            target: {
                files: [file]
            }
        };
        
        // Call the handler's file selection method
        await window.fileAttachmentHandler.handleFileSelection(fakeEvent);
    }

    clearSelectedContext() {
        this.elements.sessionsContainer?.querySelectorAll('.session-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        this.selectedContextSessions = [];
        this.updateSelectionUI();
        this.updateContextIndicator();
    }

    removeSelectedSession(index) {
        if (index > -1 && index < this.selectedContextSessions.length) {
            this.selectedContextSessions.splice(index, 1);
            this.updateContextIndicator();
        }
    }

    updateContextIndicator() {
        this.renderSessionChips();
    }

    renderSessionChips() {
        const contextFilesBar = document.getElementById('context-files-bar');
        const contextFilesContent = document.querySelector('.context-files-content');
        
        if (!contextFilesBar || !contextFilesContent) return;

        contextFilesContent.querySelectorAll('.session-chip').forEach(chip => chip.remove());

        this.selectedContextSessions.forEach((session, index) => {
            this.createSessionChip(session, index);
        });

        this.updateContextFilesBarVisibility();
    }

    createSessionChip(session, index) {
        const contextFilesContent = document.querySelector('.context-files-content');
        if (!contextFilesContent) return;

        const chip = document.createElement('div');
        chip.className = 'session-chip';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-comments session-chip-icon';
        
        const title = document.createElement('span');
        title.className = 'session-chip-title';
        
        // Use title from session_titles table, or fallback to first user input
        let displayTitle = session.session_title;
        if (!displayTitle) {
            const topLevelRuns = (session.runs || []).filter(run => !run.parent_run_id);
            displayTitle = topLevelRuns[0]?.input?.input_content || `Session ${index + 1}`;
        }
        
        title.textContent = displayTitle.substring(0, 25) + (displayTitle.length > 25 ? '...' : '');
        
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

    updateContextFilesBarVisibility() {
        const contextFilesBar = document.getElementById('context-files-bar');
        const inputContainer = document.getElementById('floating-input-container');
        
        if (!contextFilesBar || !inputContainer) return;

        const hasFiles = window.fileAttachmentHandler && window.fileAttachmentHandler.attachedFiles.length > 0;
        const hasSessions = this.selectedContextSessions.length > 0;
        const hasContent = hasFiles || hasSessions;

        if (hasContent) {
            contextFilesBar.classList.remove('hidden');
            inputContainer.classList.add('has-files');
        } else {
            contextFilesBar.classList.add('hidden');
            inputContainer.classList.remove('has-files');
        }

        if (window.fileAttachmentHandler && window.fileAttachmentHandler.onContextChange) {
            window.fileAttachmentHandler.onContextChange();
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
        if (window.NotificationService) {
            window.NotificationService.show(message, type, duration);
        } else {
            // Fallback to console if NotificationService not available
            console.log(`[Notification ${type}]: ${message}`);
        }
    }

    getSelectedSessions() {
        return this.selectedContextSessions;
    }
    
    hideContextViewer() {
        if (this.elements.contextViewer) this.elements.contextViewer.classList.remove('visible');
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
        this.currentOffset = 0;
        this.hasMoreSessions = true;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.backgroundLoadTimer) {
            clearTimeout(this.backgroundLoadTimer);
            this.backgroundLoadTimer = null;
        }
    }
}
export default ContextHandler;