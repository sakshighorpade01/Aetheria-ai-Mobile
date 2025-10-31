// js/chat.js (PWA/Mobile Version - Adapted from Desktop Logic)

import { messageFormatter } from './message-formatter.js';
import { socketService } from './socket-service.js';

let sessionActive = false;
let contextHandler = null;
let fileAttachmentHandler = null;
let contextViewer = null;

// This map now stores the DOM element for each message stream
const ongoingStreams = new Map();
const sentContexts = new Map();

function addUserMessage(message, files = [], sessions = []) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageId = `user_msg_${Date.now()}`;
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'message-wrapper user-message-wrapper';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = messageFormatter.format(message);
    
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
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createBotMessagePlaceholder(messageId) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    
    messageDiv.innerHTML = `
        <div class="thinking-indicator">
            <div class="thinking-steps-container"></div>
        </div>
        <div class="detailed-logs" id="logs-${messageId}"></div>
        <div class="message-content" id="main-content-${messageId}"></div>
    `;

    messagesContainer.appendChild(messageDiv);
    ongoingStreams.set(messageId, messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Helper to extract code from object and strip markdown code block formatting
function extractCodeFromObject(obj) {
    const potentialKeys = ['raw', 'code', 'content', 'text', 'output'];
    for (const key of potentialKeys) {
        if (obj[key]) {
            let val = obj[key];
            // If it's a markdown code block, strip the backticks and language
            const codeBlockMatch = val.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)```$/);
            if (codeBlockMatch) {
                return codeBlockMatch[1].trim();
            }
            return val;
        }
    }
    return JSON.stringify(obj, null, 2);
}

function populateBotMessage(data) {
    // Use 'let' for content so it can be modified.
    let { content, id: messageId, streaming = false, agent_name, team_name, is_log } = data;
    const messageDiv = ongoingStreams.get(messageId);
    if (!messageDiv) return;

    // If the content from the backend is an object, extract the code
    if (typeof content === 'object' && content !== null) {
        content = extractCodeFromObject(content);
    }

    const ownerName = agent_name || team_name;
    if (!ownerName || !content) return;

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
        
        const header = document.createElement('div');
        header.className = 'content-block-header';
        header.textContent = ownerName.replace(/_/g, ' ');
        contentBlock.appendChild(header);

        const innerContent = document.createElement('div');
        innerContent.className = 'inner-content';
        contentBlock.appendChild(innerContent);

        targetContainer.appendChild(contentBlock);
    }
    
    const innerContentDiv = contentBlock.querySelector('.inner-content');
    if (innerContentDiv) {
        const streamId = `${messageId}-${ownerName}`;
        const formattedContent = streaming 
            ? messageFormatter.formatStreaming(content, streamId) 
            : messageFormatter.format(content);
        innerContentDiv.innerHTML = formattedContent;
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
                <i class="fas fa-wrench tool-log-icon"></i>
                <div class="tool-log-details">
                    <span class="tool-log-owner">${ownerName}</span>
                    <span class="tool-log-action">Used tool: <strong>${toolName}</strong></span>
                </div>
                <span class="tool-log-status in-progress">In progress...</span>
            `;
            logsContainer.appendChild(logEntry);
        }
    } else if (type === 'tool_end') {
        if (logEntry) {
            const statusEl = logEntry.querySelector('.tool-log-status');
            if (statusEl) {
                statusEl.textContent = 'Completed';
                statusEl.classList.remove('in-progress');
                statusEl.classList.add('completed');
            }
        }
    }

    const liveStepsContainer = messageDiv.querySelector('.thinking-steps-container');
    if (!liveStepsContainer) return;
    let liveStepDiv = liveStepsContainer.querySelector(`#${stepId}`);

    if (type === 'tool_start') {
        if (!liveStepDiv) {
            liveStepDiv = document.createElement('div');
            liveStepDiv.id = stepId;
            liveStepDiv.className = 'thinking-step';
            liveStepDiv.innerHTML = `<i class="fas fa-cog fa-spin step-icon"></i><span class="step-text"><strong>${ownerName}:</strong> Using ${toolName}...</span>`;
            liveStepsContainer.appendChild(liveStepDiv);
        }
    } else if (type === 'tool_end') {
        if (liveStepDiv) {
            liveStepDiv.remove();
        }
    }
}

function handleDone(data) {
    const { id: messageId } = data;
    if (!messageId || !ongoingStreams.has(messageId)) return;

    const messageDiv = ongoingStreams.get(messageId);
    const thinkingIndicator = messageDiv.querySelector('.thinking-indicator');
    
    const hasLogs = messageDiv.querySelector('.log-block, .tool-log-entry');
    if (thinkingIndicator && hasLogs) {
        thinkingIndicator.classList.add('steps-done');
        
        const logCount = messageDiv.querySelectorAll('.log-block').length;
        const toolLogCount = messageDiv.querySelectorAll('.tool-log-entry').length;
        
        let summaryText = "Aetheria AI's Reasoning";
        if (logCount > 0 || toolLogCount > 0) {
            const parts = [];
            if (logCount > 0) parts.push(`${logCount} agent step${logCount > 1 ? 's' : ''}`);
            if (toolLogCount > 0) parts.push(`${toolLogCount} tool call${toolLogCount > 1 ? 's' : ''}`);
            summaryText = `Reasoning involved ${parts.join(' and ')}`;
        }

        thinkingIndicator.innerHTML = `<span class="summary-text">${summaryText}</span><i class="fas fa-chevron-down summary-chevron"></i>`;

        thinkingIndicator.addEventListener('click', () => {
            messageDiv.classList.toggle('expanded');
        });
    } else if (thinkingIndicator) {
        thinkingIndicator.remove();
    }

    messageFormatter.finishStreaming(messageId);
    ongoingStreams.delete(messageId);
    sessionActive = false;
}

function setupSocketListeners() {
    socketService.on('connect', () => console.log('Socket connected successfully.'));
    socketService.on('disconnect', () => console.error('Socket disconnected.'));
    
    socketService.on('response', (data) => {
        if (data.done) {
            handleDone(data);
        }
        if (data.content) {
            populateBotMessage(data);
        }
    });

    socketService.on('agent_step', handleAgentStep);
    
    socketService.on('error', (err) => {
        console.error('Socket error:', err);
        chatModule.showNotification(err.message || 'A server error occurred.', 'error');
        sessionActive = false;
    });
}

export const chatModule = {
    init(contextHandlerInstance, fileAttachmentHandlerInstance, contextViewerInstance) {
        contextHandler = contextHandlerInstance;
        fileAttachmentHandler = fileAttachmentHandlerInstance;
        contextViewer = contextViewerInstance;
        socketService.init();
        setupSocketListeners();
        console.log('Chat module initialized for PWA.');
    },

    async handleSendMessage(isMemoryEnabled = false, agentType = 'aios') {
        const input = document.getElementById('floating-input');
        const message = input.value.trim();
        const attachedFiles = fileAttachmentHandler.getAttachedFiles().map(f => ({ ...f }));
        const selectedSessions = contextHandler.getSelectedSessions();

        if ((!message && attachedFiles.length === 0) || sessionActive) {
            if (sessionActive) this.showNotification("Please wait for the current response to finish.", "warning");
            return;
        }
        
        sessionActive = true;

        if (message || attachedFiles.length > 0) {
            addUserMessage(message || "Attached files", attachedFiles, selectedSessions);
        }

        input.value = '';
        input.style.height = 'auto';
        input.focus();

        const messageId = `msg_${Date.now()}`;
        createBotMessagePlaceholder(messageId);

        const payload = {
            id: messageId,
            message: message,
            config: {
                calculator: true, internet_search: true, web_crawler: true,
                coding_assistant: true, investment_assistant: true, enable_github: true,
                enable_google_email: true, enable_google_drive: true, use_memory: isMemoryEnabled,
            },
            is_deepsearch: agentType === 'deepsearch'
        };

        if (selectedSessions.length > 0) payload.context = JSON.stringify(selectedSessions);
        if (attachedFiles.length > 0) payload.files = attachedFiles.map(f => ({ name: f.name, type: f.type, path: f.path, content: f.content, isText: f.isText }));

        try {
            await socketService.sendMessage(payload);
            fileAttachmentHandler.clearAttachedFiles();
            contextHandler.clearSelectedContext();
        } catch (err) {
            console.error("Failed to send message:", err);
            const errorMsgDiv = document.querySelector(`.bot-message[data-message-id="${messageId}"]`);
            if (errorMsgDiv) errorMsgDiv.innerHTML = `<div class="error-message"><strong>Error:</strong> ${err.message}</div>`;
            sessionActive = false;
        }
    },

    clearChat() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) messagesContainer.innerHTML = '';
        if (sessionActive) {
            try {
                socketService.sendMessage({ type: 'terminate_session', message: 'User started a new chat' });
            } catch (e) {
                console.warn("Could not send terminate message, socket may be disconnected.", e.message);
            }
        }
        sessionActive = false;
        ongoingStreams.clear();
        messageFormatter.pendingContent.clear();
    },

    showNotification(message, type = 'info', duration = 3000) {
        const container = document.querySelector('.notification-container');
        if (!container) return;
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        container.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            notification.addEventListener('transitionend', () => notification.remove());
        }, duration);
    }
};