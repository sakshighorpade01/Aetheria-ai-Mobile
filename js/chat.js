// js/chat.js (PWA/Mobile Version - Adapted from Desktop Logic)

import { messageFormatter } from './message-formatter.js';
import { socketService } from './socket-service.js';
import ConversationStateManager from './conversation-state-manager.js';
import FloatingWindowManager from './floating-window-manager.js';
import NotificationService from './notification-service.js';
import WelcomeDisplay from './welcome-display.js';
import UnifiedPreviewHandler from './unified-preview-handler.js';
import ContextHandler from './context-handler.js';
import FileAttachmentHandler from './add-files.js';
import { artifactHandler } from './artifact-handler.js';
import messageActions from './message-actions.js';

let sessionActive = false;
let currentConversationId = null;
let isSocketConnected = false;

let contextHandler = null;
let fileAttachmentHandler = null;
let contextViewer = null;
let conversationStateManager = null;
let floatingWindowManager = null;
let welcomeDisplay = null;
let notificationService = null;
// ShuffleMenuController removed - not needed for PWA (Electron-only feature)
let unifiedPreviewHandler = null;

const defaultToolsConfig = {
    internet_search: true,
    coding_assistant: true,
    enable_browser: true,
    enable_github: true,
    enable_google_email: true,
    enable_google_drive: true,
    enable_supabase: true,
    enable_vercel: true,
    Planner_Agent: true,
};

if (typeof window !== 'undefined') {
    window.renderTurnFromEvents = renderTurnFromEvents;
}

const chatConfig = {
    memory: true,
    tasks: false,
    tools: { ...defaultToolsConfig },
    debug_mode: true,
    deepsearch: false,
};

let selectedAgentType = 'aios';
let shouldResendWithHistory = false;
let offlineNotificationId = null;
let statusNotificationId = null;
let connectionHasBeenLost = false;
let socketListenersBound = false;

// This map now stores the DOM element for each message stream
const ongoingStreams = new Map();
const sentContexts = new Map();

function dispatchChatEvent(eventName, detail = {}) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function closeAllDropdowns() {
    document.querySelectorAll('[aria-expanded="true"]').forEach((trigger) => {
        trigger.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.top-bar-dropdown, .input-action-menu').forEach((menu) => {
        menu.classList.add('hidden');
    });
}

function renderTurnFromEvents(events = [], { messageId = `replay_${Date.now()}`, autoScroll = false } = {}) {
    if (!Array.isArray(events) || events.length === 0) return null;

    let botMessage = ongoingStreams.get(messageId);
    if (!botMessage) {
        createBotMessagePlaceholder(messageId);
        botMessage = ongoingStreams.get(messageId);
    }
    if (!botMessage) return null;

    events.forEach((event) => {
        if (!event || typeof event !== 'object') return;
        if (event.type === 'response') {
            populateBotMessage({
                id: messageId,
                content: event.content,
                streaming: false,
                agent_name: event.agent_name,
                team_name: event.team_name,
                is_log: event.is_log,
            });
        } else if (event.type === 'agent_step') {
            handleAgentStep({
                id: messageId,
                type: event.step_type || event.step,
                name: event.name,
                agent_name: event.agent_name,
                team_name: event.team_name,
            });
        } else if (event.type === 'sandbox') {
            appendSandboxMessage({
                messageId,
                payload: event.payload,
                level: event.level,
            });
        }
    });

    handleDone({ id: messageId });

    if (autoScroll) {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer?.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    }

    return botMessage;
}

function appendSandboxMessage({ messageId, payload, level = 'info' }) {
    if (!messageId || !payload) return;
    let messageDiv = ongoingStreams.get(messageId);
    if (!messageDiv) {
        createBotMessagePlaceholder(messageId);
        messageDiv = ongoingStreams.get(messageId);
    }
    if (!messageDiv) return;

    const sandboxLogId = `sandbox-log-${messageId}`;
    let sandboxSection = messageDiv.querySelector(`#${sandboxLogId}`);
    if (!sandboxSection) {
        sandboxSection = document.createElement('div');
        sandboxSection.id = sandboxLogId;
        sandboxSection.className = 'sandbox-log';
        sandboxSection.innerHTML = `
            <div class="content-block log-block">
                <div class="content-block-header">Sandbox</div>
                <div class="inner-content"></div>
            </div>
        `;
        const detailedLogs = messageDiv.querySelector('.detailed-logs');
        detailedLogs?.appendChild(sandboxSection);
    }

    const inner = sandboxSection.querySelector('.inner-content');
    if (!inner) return;
    const entry = document.createElement('div');
    entry.className = `sandbox-log-entry sandbox-log-${level}`;
    entry.textContent = payload;
    inner.appendChild(entry);
    messageDiv.classList.add('expanded');
}

function resetUserInputState() {
    const input = document.getElementById('floating-input');
    const sendBtn = document.getElementById('send-message');
    if (input) {
        input.disabled = false;
        input.value = '';
        input.style.height = 'auto';
    }
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.classList.remove('sending');
    }
}

function mapStatusLevelToType(level) {
    const normalized = (level || '').toLowerCase();
    if (['error', 'danger', 'fail', 'failed'].includes(normalized)) return 'error';
    if (['warn', 'warning'].includes(normalized)) return 'warning';
    if (['success', 'ok', 'ready'].includes(normalized)) return 'success';
    return 'info';
}

function dismissOfflineNotification() {
    if (offlineNotificationId && notificationService?.remove) {
        notificationService.remove(offlineNotificationId);
        offlineNotificationId = null;
    }
}

function dismissStatusNotification() {
    if (statusNotificationId && notificationService?.remove) {
        notificationService.remove(statusNotificationId);
        statusNotificationId = null;
    }
}

function handleSocketConnect() {
    isSocketConnected = true;
    console.log('Socket connected successfully.');
    dismissOfflineNotification();
    dispatchChatEvent('chatConnectionChanged', { connected: true });
    dispatchChatEvent('chatStateChanged', { status: 'connected', conversationId: currentConversationId });

    if (connectionHasBeenLost && notificationService) {
        notificationService.show('Connection restored.', 'success', 3000);
    }

    connectionHasBeenLost = false;
}

function handleSocketDisconnect() {
    console.warn('Socket disconnected.');

    if (sessionActive) {
        sessionActive = false;
        shouldResendWithHistory = true;
        resetUserInputState();
    }

    isSocketConnected = false;
    connectionHasBeenLost = true;
    dispatchChatEvent('chatConnectionChanged', { connected: false });
    dispatchChatEvent('chatStateChanged', { status: 'disconnected', conversationId: currentConversationId });

    if (!offlineNotificationId && notificationService) {
        offlineNotificationId = notificationService.show('Connection lost. Attempting to reconnect…', 'warning', 0);
    }
}

function handleStatusEvent(data = {}) {
    if (!notificationService) return;

    const message = data.message || data.status || '';
    if (!message.trim()) return;

    const type = mapStatusLevelToType(data.level || data.type);
    const persistent = data.persistent === true;
    const duration = typeof data.duration === 'number'
        ? data.duration
        : (persistent ? 0 : 4000);

    if (persistent) {
        dismissStatusNotification();
        statusNotificationId = notificationService.show(message, type, duration);
        return;
    }

    const notificationId = notificationService.show(message, type, duration);
    if (statusNotificationId === notificationId) {
        statusNotificationId = null;
    }
}

function updateReasoningSummary(messageId) {
    const messageDiv = ongoingStreams.get(messageId);
    if (!messageDiv) return;

    const summary = messageDiv.querySelector('.reasoning-summary');
    if (!summary) return;

    const summaryText = summary.querySelector('.summary-text');
    if (!summaryText) return;

    const agentBlocks = messageDiv.querySelectorAll('.log-block').length;
    const toolLogs = messageDiv.querySelectorAll('.tool-log-entry').length;

    if (agentBlocks === 0 && toolLogs === 0) {
        summaryText.textContent = 'Reasoning: 0 tools, 0 agents';
        summary.classList.add('hidden');
        return;
    }

    const parts = [];
    if (toolLogs > 0) parts.push(`${toolLogs} tool${toolLogs > 1 ? 's' : ''}`);
    if (agentBlocks > 0) parts.push(`${agentBlocks} agent${agentBlocks > 1 ? 's' : ''}`);
    summaryText.textContent = `Reasoning: ${parts.join(', ')}`;
    summary.classList.remove('hidden');
}

function addUserMessage(message, files = [], sessions = []) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageId = `user_msg_${Date.now()}`;
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper user-message-wrapper';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    const hasContext = files.length > 0 || sessions.length > 0;
    const displayText = message || (hasContext ? '[Context Attached]' : '');
    messageDiv.dataset.rawMessage = displayText;
    messageDiv.innerHTML = messageFormatter.format(displayText);

    wrapperDiv.appendChild(messageDiv);

    if (files.length > 0 || sessions.length > 0) {
        sentContexts.set(messageId, { files, sessions });
        const contextButton = document.createElement('button');
        contextButton.className = 'user-message-context-button';
        const fileCount = files.length;
        const sessionCount = sessions.length;
        let buttonText = 'Context';
        if (sessionCount > 0 && fileCount > 0) buttonText = `Context: ${sessionCount} session(s) & ${fileCount} file(s)`;
        else if (sessionCount > 0) buttonText = `Context: ${sessionCount} session(s)`;
        else if (fileCount > 0) buttonText = `Context: ${fileCount} file(s)`;
        contextButton.innerHTML = `<i class="fas fa-paperclip"></i> ${buttonText}`;
        contextButton.dataset.contextId = messageId;
        contextButton.addEventListener('click', () => {
            const contextData = sentContexts.get(messageId);
            if (contextViewer && contextData) contextViewer.show(contextData);
        });
        wrapperDiv.appendChild(contextButton);
    }

    messagesContainer.appendChild(wrapperDiv);
    wrapperDiv.dataset.messageId = messageId;
    messageDiv.dataset.messageId = messageId;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // No actions for user messages - they don't need to copy their own input
    
    dispatchChatEvent('messageAdded', { role: 'user', messageId });
}

function createBotMessagePlaceholder(messageId) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    messageDiv.dataset.messageId = messageId;

    const thinkingIndicator = document.createElement('div');
    thinkingIndicator.className = 'thinking-indicator';
    thinkingIndicator.innerHTML = `
        <div class="reasoning-summary hidden" role="button" tabindex="0">
            <span class="summary-text">Reasoning: 0 tools, 0 agents</span>
            <i class="fas fa-chevron-down summary-chevron"></i>
        </div>
    `;

    const detailedLogs = document.createElement('div');
    detailedLogs.className = 'detailed-logs';
    detailedLogs.id = `logs-${messageId}`;

    const mainContent = document.createElement('div');
    mainContent.className = 'message-content';
    mainContent.id = `main-content-${messageId}`;

    messageDiv.appendChild(thinkingIndicator);
    messageDiv.appendChild(detailedLogs);
    messageDiv.appendChild(mainContent);

    messagesContainer.appendChild(messageDiv);
    ongoingStreams.set(messageId, messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const summary = thinkingIndicator.querySelector('.reasoning-summary');
    summary?.addEventListener('click', () => {
        messageDiv.classList.toggle('expanded');
    });
    summary?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            messageDiv.classList.toggle('expanded');
        }
    });
}

// Helper to normalize content from backend (handles objects, strings, etc.)
function normalizeBackendContent(content) {
    console.log('[Chat] normalizeBackendContent called:', {
        contentType: typeof content,
        isNull: content === null,
        isUndefined: content === undefined,
        contentPreview: typeof content === 'string' ? content.substring(0, 100) : content
    });

    // If it's already a string, return as-is
    if (typeof content === 'string') {
        console.log('[Chat] Content is already a string, returning as-is');
        return content;
    }

    // If it's null or undefined, return empty string
    if (content == null) {
        console.log('[Chat] Content is null/undefined, returning empty string');
        return '';
    }

    // If it's an object, extract the actual content
    if (typeof content === 'object') {
        console.log('[Chat] Content is an object, extracting...');
        
        // Check for common content keys
        const potentialKeys = ['raw', 'code', 'content', 'text', 'output', 'data'];
        
        for (const key of potentialKeys) {
            if (Object.prototype.hasOwnProperty.call(content, key)) {
                const value = content[key];
                console.log(`[Chat] Found key "${key}" with value type:`, typeof value);
                
                // If the value is a string, check if it's already markdown
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    // If it's already a code block, return as-is
                    if (trimmed.startsWith('```')) {
                        console.log('[Chat] Value is already markdown code block');
                        return trimmed;
                    }
                    // If it has language info, wrap it
                    const lang = content.lang || content.language || content.format || '';
                    if (lang && trimmed) {
                        console.log('[Chat] Wrapping in code block with language:', lang);
                        return `\`\`\`${lang}\n${trimmed}\n\`\`\``;
                    }
                    // Otherwise return the raw string
                    console.log('[Chat] Returning raw string value');
                    return trimmed;
                }
                
                // If the value is an object, stringify it as JSON
                if (typeof value === 'object' && value !== null) {
                    console.log('[Chat] Value is object, stringifying as JSON');
                    const jsonString = JSON.stringify(value, null, 2);
                    return `\`\`\`json\n${jsonString}\n\`\`\``;
                }
                
                // For other types, convert to string
                console.log('[Chat] Converting value to string');
                return String(value);
            }
        }
        
        // If no content key found, stringify the entire object
        console.log('[Chat] No content key found, stringifying entire object');
        try {
            const jsonString = JSON.stringify(content, null, 2);
            return `\`\`\`json\n${jsonString}\n\`\`\``;
        } catch (e) {
            console.error('[Chat] Failed to stringify object:', e);
            return '[Complex object - unable to display]';
        }
    }

    // For any other type, convert to string
    console.log('[Chat] Converting to string (fallback)');
    return String(content);
}

function populateBotMessage(data) {
    console.log('[Chat] populateBotMessage called:', {
        messageId: data.id,
        contentType: typeof data.content,
        streaming: data.streaming,
        agent_name: data.agent_name,
        team_name: data.team_name,
        is_log: data.is_log
    });

    let { content, id: messageId, streaming = false, agent_name, team_name, is_log } = data;
    const messageDiv = ongoingStreams.get(messageId);
    if (!messageDiv) {
        console.warn('[Chat] Message div not found for:', messageId);
        return;
    }

    // Normalize content from backend (handles objects, strings, etc.)
    const originalContent = content;
    content = normalizeBackendContent(content);
    
    console.log('[Chat] Content after normalization:', {
        originalType: typeof originalContent,
        normalizedType: typeof content,
        normalizedLength: content?.length,
        normalizedPreview: typeof content === 'string' ? content.substring(0, 100) : content
    });

    const ownerName = agent_name || team_name;
    if (!ownerName || !content) {
        console.warn('[Chat] Missing ownerName or content:', { ownerName, hasContent: !!content });
        return;
    }

    const targetContainer = is_log
        ? messageDiv.querySelector(`#logs-${messageId}`)
        : messageDiv.querySelector(`#main-content-${messageId}`);

    if (!targetContainer) return;

    const contentBlockId = `content-block-${messageId}-${ownerName}`;
    let contentBlock = document.getElementById(contentBlockId);

    if (!contentBlock) {
        contentBlock = document.createElement('div');
        contentBlock.id = contentBlockId;
        contentBlock.className = is_log ? 'content-block log-block' : 'content-block';

        // Only add header for log blocks, not for main content
        if (is_log) {
            const header = document.createElement('div');
            header.className = 'content-block-header';
            header.textContent = ownerName.replace(/_/g, ' ');
            contentBlock.appendChild(header);
        }

        const innerContent = document.createElement('div');
        innerContent.className = 'inner-content';
        contentBlock.appendChild(innerContent);

        targetContainer.appendChild(contentBlock);
    }

    const innerContentDiv = contentBlock.querySelector('.inner-content');
    if (innerContentDiv) {
        const streamId = `${messageId}-${ownerName}`;
        
        // Use inline mode for main content, button mode for logs
        const useInlineMode = !is_log;
        
        const formattedContent = streaming
            ? messageFormatter.formatStreaming(content, streamId)
            : messageFormatter.format(content, { inlineArtifacts: useInlineMode });

        innerContentDiv.innerHTML = formattedContent;

        if (!streaming) {
            messageFormatter.applyInlineEnhancements?.(innerContentDiv);
        }

        if (typeof hljs !== 'undefined') {
            innerContentDiv.querySelectorAll('pre code').forEach((block) => {
                if (!block.dataset.highlighted) {
                    hljs.highlightElement(block);
                    block.dataset.highlighted = 'true';
                }
            });
        }
    }

    if (is_log) {
        updateReasoningSummary(messageId);
    }
}

function handleAgentStep(data) {
    const { id: messageId, type, name, agent_name, team_name } = data;
    const messageDiv = ongoingStreams.get(messageId);
    if (!messageDiv) return;

    const toolName = name.replace(/_/g, ' ');
    const ownerName = agent_name || team_name || 'Assistant';
    const stepId = `step-${messageId}-${ownerName}-${name}`;

    const logsContainer = messageDiv.querySelector('.detailed-logs');
    const logEntryId = `log-entry-${stepId}`;
    let logEntry = logsContainer.querySelector(`#${logEntryId}`);

    if (type === 'tool_start') {
        if (!logEntry) {
            logEntry = document.createElement('div');
            logEntry.id = logEntryId;
            logEntry.className = 'tool-log-entry';
            logEntry.innerHTML = `
                <i class="fi fi-tr-wisdom tool-log-icon"></i>
                <div class="tool-log-details">
                    <span class="tool-log-action">Used tool: <strong>${toolName}</strong></span>
                </div>
                <span class="tool-log-status in-progress" title="In progress"></span>
            `;
            logsContainer.appendChild(logEntry);
        }
    } else if (type === 'tool_end') {
        if (logEntry) {
            const statusEl = logEntry.querySelector('.tool-log-status');
            if (statusEl) {
                statusEl.classList.remove('in-progress');
                statusEl.classList.add('completed');
                statusEl.setAttribute('title', 'Completed');
            }
        }
    }

    // Remove the live steps display during running state - no spinning icon or text above reasoning title
    updateReasoningSummary(messageId);
}

function handleDone(data) {
    const { id: messageId } = data;
    if (!messageId || !ongoingStreams.has(messageId)) return;

    const messageDiv = ongoingStreams.get(messageId);
    const thinkingIndicator = messageDiv.querySelector('.thinking-indicator');
    const summary = thinkingIndicator?.querySelector('.reasoning-summary');
    const summaryTextEl = summary?.querySelector('.summary-text');

    const hasLogs = messageDiv.querySelector('.log-block, .tool-log-entry');
    if (thinkingIndicator && hasLogs) {
        thinkingIndicator.classList.add('steps-done');
        const logCount = messageDiv.querySelectorAll('.log-block').length;
        const toolLogCount = messageDiv.querySelectorAll('.tool-log-entry').length;

        let summaryText = "Reasoning: 0 tools, 0 agents";
        const parts = [];
        if (toolLogCount > 0) parts.push(`${toolLogCount} tool${toolLogCount > 1 ? 's' : ''}`);
        if (logCount > 0) parts.push(`${logCount} agent${logCount > 1 ? 's' : ''}`);
        if (parts.length > 0) {
            summaryText = `Reasoning: ${parts.join(', ')}`;
        }

        if (summary && summaryTextEl) {
            summaryTextEl.textContent = summaryText;
            summary.classList.remove('hidden');
        }
    } else if (thinkingIndicator) {
        thinkingIndicator.remove();
    }

    messageFormatter.finishStreaming(messageId);
    
    // Apply inline enhancements (Mermaid, syntax highlighting, etc.) after streaming completes
    const mainContent = messageDiv.querySelector('.message-content');
    if (mainContent && messageFormatter.applyInlineEnhancements) {
        console.log('[Chat] Applying inline enhancements after streaming complete');
        messageFormatter.applyInlineEnhancements(mainContent);
    }
    
    ongoingStreams.delete(messageId);
    sessionActive = false;

    // Restore send button to ready state (triangle → plane)
    const sendBtn = document.getElementById('send-message');
    const sendIcon = sendBtn?.querySelector('i');
    if (sendIcon) {
        sendIcon.classList.remove('fa-play');
        sendIcon.classList.add('fa-paper-plane');
    }
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.classList.remove('sending');
    }

    // Add message actions to bot message (Copy and Share only)
    if (window.messageActions && messageDiv) {
        window.messageActions.addActionsToMessage(messageDiv, messageId);
    }

    dispatchChatEvent('messageAdded', { role: 'assistant', messageId });
}

function extractConversationHistory() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return '';

    const messageNodes = chatMessages.querySelectorAll('.message');
    let history = '';

    messageNodes.forEach(node => {
        if (node.classList.contains('message-error')) return;

        if (node.classList.contains('user-message')) {
            const raw = node.dataset.rawMessage || node.textContent || '';
            const trimmed = raw.trim();
            if (trimmed) {
                history += `User: ${trimmed}\n\n`;
            }
        } else if (node.classList.contains('bot-message')) {
            const mainContent = node.querySelector('.message-content');
            if (mainContent) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = mainContent.innerHTML;
                const text = tempDiv.textContent.trim();
                if (text) {
                    history += `Assistant: ${text}\n\n`;
                }
            }
        }
    });

    return history.trim();
}

// ShuffleMenuController class removed - Electron-only feature, not needed for PWA

function setupSocketListeners() {
    if (socketListenersBound) return;
    socketListenersBound = true;

    socketService.on('connect', handleSocketConnect);
    socketService.on('disconnect', handleSocketDisconnect);

    socketService.on('response', (data) => {
        if (data.done) {
            handleDone(data);
        }
        if (data.content) {
            populateBotMessage(data);
        }
    });

    socketService.on('agent_step', handleAgentStep);
    socketService.on('status', handleStatusEvent);
    socketService.on('sandbox-command-started', (data = {}) => {
        appendSandboxMessage({
            messageId: data.id || data.messageId,
            payload: data.command ? `Executing: ${data.command}` : 'Sandbox command started.',
            level: 'info',
        });
    });
    socketService.on('sandbox-command-finished', (data = {}) => {
        const outputParts = [];
        if (data.stdout) outputParts.push(`STDOUT:\n${data.stdout}`);
        if (data.stderr) outputParts.push(`STDERR:\n${data.stderr}`);
        if (typeof data.exit_code !== 'undefined') outputParts.push(`Exit Code: ${data.exit_code}`);
        const payload = outputParts.length > 0 ? outputParts.join('\n\n') : 'Sandbox command completed.';
        appendSandboxMessage({
            messageId: data.id || data.messageId,
            payload,
            level: data.exit_code && data.exit_code !== 0 ? 'error' : 'success',
        });
    });

    socketService.on('image_generated', handleImageGenerated);

    socketService.on('error', (err) => {
        console.error('Socket error:', err);
        chatModule.showNotification(err.message || 'A server error occurred.', 'error');
        sessionActive = false;
        shouldResendWithHistory = true;
        resetUserInputState();
        dispatchChatEvent('chatStateChanged', { status: 'error', conversationId: currentConversationId });
    });
}

function handleImageGenerated(data = {}) {
    const messageId = data.id || data.messageId;
    const imageBase64 = data.image_base64 || data.base64;
    if (!imageBase64) {
        return;
    }

    const mimeType = data.mime_type || 'image/png';
    const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
    const artifactId = artifactHandler.createArtifact(dataUrl, 'image', data.artifactId);

    const messageDiv = messageId ? ongoingStreams.get(messageId) : null;
    if (messageDiv) {
        const mainContent = messageDiv.querySelector('.message-content');
        if (mainContent && !mainContent.querySelector(`[data-artifact-ref="${artifactId}"]`)) {
            const artifactBlock = document.createElement('div');
            artifactBlock.className = 'content-block artifact-block';
            artifactBlock.dataset.artifactRef = artifactId;
            artifactBlock.innerHTML = `
                <div class="content-block-header">
                    <i class="fas fa-image"></i>
                    <span>Generated Image</span>
                </div>
                <div class="inner-content">
                    <img src="${dataUrl}" alt="Generated artifact" class="generated-image-preview" loading="lazy" />
                    <div class="artifact-actions">
                        <button class="artifact-reference" data-artifact-id="${artifactId}">
                            <i class="fas fa-up-right-from-square"></i>
                            View full size
                        </button>
                    </div>
                </div>
            `;
            mainContent.appendChild(artifactBlock);
        }

        const logsContainer = messageDiv.querySelector('.detailed-logs');
        if (logsContainer && !logsContainer.querySelector(`[data-artifact-ref="${artifactId}"]`)) {
            const logEntry = document.createElement('div');
            logEntry.className = 'tool-log-entry image-artifact-log';
            logEntry.dataset.artifactRef = artifactId;
            logEntry.innerHTML = `
                <i class="fas fa-palette tool-log-icon"></i>
                <div class="tool-log-details">
                    <span class="tool-log-action"><strong>Generated an image artifact</strong></span>
                </div>
                <button class="artifact-reference compact" data-artifact-id="${artifactId}" title="Open image artifact">
                    <i class="fas fa-up-right-from-square"></i>
                    Open
                </button>
            `;
            logsContainer.appendChild(logEntry);
            updateReasoningSummary(messageId);
        }

        messageDiv.classList.add('expanded');
    } else {
        notificationService?.show('Generated image is ready in the artifact viewer.', 'info', 6000);
    }
}

export const chatModule = {
    init(contextHandlerInstance, fileAttachmentHandlerInstance, contextViewerInstance) {
        contextHandler = contextHandlerInstance || contextHandler;
        if (!contextHandler) {
            throw new Error('chatModule.init requires a contextHandler instance');
        }
        contextViewer = contextViewerInstance || contextViewer || null;

        if (fileAttachmentHandlerInstance) {
            fileAttachmentHandler = fileAttachmentHandlerInstance;
        } else if (!fileAttachmentHandler) {
            fileAttachmentHandler = new FileAttachmentHandler();
        }

        const inputContainer = document.getElementById('floating-input-container') || document.querySelector('.floating-input-container');
        const chatContainer = document.getElementById('chat-messages') || document.querySelector('.chat-messages');
        const welcomeContainer = document.querySelector('.welcome-container');

        notificationService = new NotificationService();

        welcomeDisplay = new WelcomeDisplay({
            element: welcomeContainer,
            messageContainer: chatContainer,
        });
        welcomeDisplay.initialize();

        if (!conversationStateManager) {
            conversationStateManager = new ConversationStateManager({ inputContainer });
        } else {
            conversationStateManager.updateInputContainer?.(inputContainer);
        }
        conversationStateManager.init?.();

        if (!floatingWindowManager) {
            floatingWindowManager = new FloatingWindowManager(welcomeDisplay);
        } else {
            floatingWindowManager.setWelcomeDisplay?.(welcomeDisplay);
        }
        window.floatingWindowManager = floatingWindowManager;

        if (contextHandler?.elements?.contextWindow) {
            floatingWindowManager.registerWindow('context', contextHandler.elements.contextWindow);
        }

        const toDoListContainer = document.getElementById('to-do-list-container');
        if (toDoListContainer) {
            floatingWindowManager.registerWindow('tasks', toDoListContainer);
        }
        const aiosSettings = document.getElementById('aios-settings-window') || document.getElementById('floating-window');
        if (aiosSettings) {
            floatingWindowManager.registerWindow('aios-settings', aiosSettings);
        }

        window.conversationStateManager = conversationStateManager;

        // ShuffleMenuController initialization removed - Electron-only feature

        socketService.init();
        setupSocketListeners();
        console.log('Chat module initialized for PWA.');

        unifiedPreviewHandler = new UnifiedPreviewHandler(contextHandler, fileAttachmentHandler);
        window.unifiedPreviewHandler = unifiedPreviewHandler;

        this.startNewConversation();

        // Preload sessions in background for instant context window display
        if (contextHandler && typeof contextHandler.preloadSessions === 'function') {
            contextHandler.preloadSessions();
        }
    },

    startNewConversation({ preserveAgentType = true } = {}) {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer?.replaceChildren();

        currentConversationId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `conv_${Date.now()}`;

        sentContexts.clear();
        ongoingStreams.clear();
        sessionActive = false;
        shouldResendWithHistory = false;
        messageFormatter.pendingContent.clear();

        contextHandler?.clearSelectedContext?.();
        contextHandler?.invalidateCache?.(); // Invalidate session cache for fresh data
        fileAttachmentHandler?.clearAttachedFiles?.();
        window.todo?.toggleWindow(false);

        resetUserInputState();

        if (!preserveAgentType) {
            this.setAgentType('aios');
        }

        this.setMemoryEnabled(true);
        this.setTasksVisibility(false);

        conversationStateManager?.onConversationCleared();
        welcomeDisplay?.show();

        const bottomNavBtns = document.querySelectorAll('.bottom-nav-btn');
        bottomNavBtns.forEach(btn => btn.classList.remove('active'));

        dispatchChatEvent('conversationCleared', { conversationId: currentConversationId });
        dispatchChatEvent('chatStateChanged', { status: 'idle', conversationId: currentConversationId });
    },

    async handleSendMessage(isMemoryEnabled = undefined, agentType = undefined) {
        const input = document.getElementById('floating-input');
        const message = input.value.trim();
        const attachedFiles = fileAttachmentHandler.getAttachedFiles().map(f => ({ ...f }));
        const selectedSessions = contextHandler.getSelectedSessions();

        if (typeof isMemoryEnabled === 'boolean') {
            this.setMemoryEnabled(isMemoryEnabled);
        }
        if (typeof agentType === 'string') {
            this.setAgentType(agentType);
        }

        const hasMessagePayload = message.length > 0 || attachedFiles.length > 0 || selectedSessions.length > 0;

        if (!hasMessagePayload || sessionActive) {
            if (sessionActive && notificationService) {
                notificationService.show('Please wait for the current response to finish.', 'warning');
            }
            return;
        }

        if (!isSocketConnected) {
            notificationService?.show('Cannot send message while disconnected. Please wait…', 'error');
            return;
        }

        sessionActive = true;

        // Update send button to loading state (plane → triangle)
        const sendBtn = document.getElementById('send-message');
        const sendIcon = sendBtn?.querySelector('i');
        if (sendIcon) {
            sendIcon.classList.remove('fa-paper-plane');
            sendIcon.classList.add('fa-play');
        }
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.classList.add('sending');
        }

        if (message || attachedFiles.length > 0) {
            addUserMessage(message || 'Attached context', attachedFiles, selectedSessions);
        }

        // Clear input and reset height without triggering layout shift
        input.value = '';
        requestAnimationFrame(() => {
            input.style.height = 'auto';
        });
        input.focus();

        const messageId = `msg_${Date.now()}`;
        createBotMessagePlaceholder(messageId);

        const payload = {
            id: messageId,
            conversationId: currentConversationId,
            message,
            config: {
                ...chatConfig.tools,
                use_memory: chatConfig.memory,
            },
            is_deepsearch: selectedAgentType === 'deepsearch',
        };

        if (shouldResendWithHistory) {
            const history = extractConversationHistory();
            if (history) {
                payload.message = `PREVIOUS CONVERSATION (Recovered after error):\n---\n${history}\n---\n\nCURRENT MESSAGE:\n${message}`;
            }
            shouldResendWithHistory = false;
        }

        // Send context_session_ids (array of session IDs) - backend queries Supabase for full data
        if (selectedSessions.length > 0) {
            payload.context_session_ids = selectedSessions.map(session => session.session_id);
        }

        // Handle file attachments
        if (attachedFiles.length > 0) {
            const backendSupportedFiles = [];
            const unsupportedTextFiles = [];
            const binaryDocumentFiles = [];

            attachedFiles.forEach(f => {
                // Check if it's a binary document file (docx, xlsx, pptx, etc.)
                const isBinaryDoc = f.type.includes('word') || f.type.includes('excel') ||
                    f.type.includes('powerpoint') || f.type.includes('document') ||
                    f.type.includes('spreadsheet') || f.type.includes('presentation') ||
                    f.type.includes('msword') || f.type.includes('ms-excel') ||
                    f.type.includes('ms-powerpoint') || f.type.includes('officedocument');

                // Check if it's a media file (image, audio, video)
                const isMediaFile = f.type.startsWith('image/') || f.type.startsWith('audio/') || f.type.startsWith('video/');

                if (isBinaryDoc && f.path) {
                    // Binary documents: send with path (uploaded to Supabase)
                    binaryDocumentFiles.push({
                        name: f.name,
                        type: f.type,
                        path: f.path,
                        isText: false
                    });
                } else if (isMediaFile && f.path) {
                    // Media files (images, audio, video): send with path
                    backendSupportedFiles.push({
                        name: f.name,
                        type: f.type,
                        path: f.path,
                        isText: false
                    });
                } else if (f.isBackendSupported && (f.path || f.content)) {
                    // Backend-supported files: send with correct MIME type
                    backendSupportedFiles.push({
                        name: f.name,
                        type: f.backendMimeType || f.type,
                        path: f.path,
                        content: f.content,
                        isText: f.isText
                    });
                } else if (f.isText && f.content) {
                    // Unsupported text files: include content in message
                    unsupportedTextFiles.push({
                        name: f.name,
                        content: f.content
                    });
                }
            });

            // Combine all files for backend
            const allBackendFiles = [...backendSupportedFiles, ...binaryDocumentFiles];
            if (allBackendFiles.length > 0) {
                payload.files = allBackendFiles;
            }

            // Include unsupported text files in the message
            if (unsupportedTextFiles.length > 0) {
                let fileContentsText = '\n\n--- Attached Files ---\n';
                unsupportedTextFiles.forEach(file => {
                    fileContentsText += `\n### File: ${file.name}\n\`\`\`\n${file.content}\n\`\`\`\n`;
                });
                payload.message = (payload.message || '') + fileContentsText;
            }
        }

        try {
            await socketService.sendMessage(payload);
            fileAttachmentHandler.clearAttachedFiles();
            contextHandler.clearSelectedContext();
        } catch (err) {
            console.error("Failed to send message:", err);
            const errorMsgDiv = document.querySelector(`.bot-message[data-message-id="${messageId}"]`);
            if (errorMsgDiv) errorMsgDiv.innerHTML = `<div class="error-message"><strong>Error:</strong> ${err.message}</div>`;
            sessionActive = false;
            shouldResendWithHistory = true;
            
            // Restore send button on error (triangle → plane)
            const sendBtn = document.getElementById('send-message');
            const sendIcon = sendBtn?.querySelector('i');
            if (sendIcon) {
                sendIcon.classList.remove('fa-play');
                sendIcon.classList.add('fa-paper-plane');
            }
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.classList.remove('sending');
            }
            
            resetUserInputState();
        }
    },

    clearChat() {
        if (sessionActive) {
            try {
                socketService.sendMessage({
                    type: 'terminate_session',
                    message: 'User started a new chat',
                    conversationId: currentConversationId,
                });
            } catch (e) {
                console.warn("Could not send terminate message, socket may be disconnected.", e.message);
            }
        }

        this.startNewConversation();
    },

    showNotification(message, type = 'info', duration = 3000) {
        if (notificationService) {
            notificationService.show(message, type, duration);
            return;
        }
        const container = document.querySelector('.notification-container');
        if (!container) return;
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        container.appendChild(notification);
        notificationService.removeNotification(notification);
    },

    getFloatingWindowManager() {
        return floatingWindowManager;
    },

    registerFloatingWindow(windowId, element, options = {}) {
        if (!floatingWindowManager || !windowId || !element) return false;
        return floatingWindowManager.registerWindow(windowId, element, options);
    },

    setMemoryEnabled(enabled) {
        const next = !!enabled;
        if (chatConfig.memory === next) {
            return;
        }

        chatConfig.memory = next;
        dispatchChatEvent('memoryToggle', { enabled: next });
        if (notificationService) {
            notificationService.show(`Memory is now ${next ? 'ON' : 'OFF'}.`, 'info');
        }
    },

    setAgentType(type) {
        const previousType = selectedAgentType;
        selectedAgentType = type === 'deepsearch' ? 'deepsearch' : 'aios';
        if (previousType === selectedAgentType) {
            return;
        }

        chatConfig.deepsearch = selectedAgentType === 'deepsearch';
        if (selectedAgentType === 'deepsearch') {
            Object.keys(chatConfig.tools).forEach(key => {
                chatConfig.tools[key] = false;
            });
        } else {
            Object.assign(chatConfig.tools, defaultToolsConfig);
        }
        dispatchChatEvent('agentTypeChanged', { agentType: selectedAgentType });
        if (notificationService) {
            notificationService.show(`Agent switched to ${selectedAgentType.toUpperCase()}.`, 'info');
        }
        chatModule.startNewConversation({ preserveAgentType: true });
    },

    setTasksVisibility(isOpen, options = {}) {
        const next = !!isOpen;
        chatConfig.tasks = next;
        dispatchChatEvent('tasksToggle', { open: next });

        if (options.source === 'shuffle') {
            window.todo?.toggleWindow(next);
        }
    },

    getConfig() {
        return {
            ...chatConfig,
            selectedAgentType,
        };
    }
};