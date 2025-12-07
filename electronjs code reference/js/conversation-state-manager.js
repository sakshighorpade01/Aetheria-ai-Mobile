/**
 * ConversationStateManager - Manages the positioning and state of the input container
 * Handles transitions between welcome mode (centered) and chat mode (bottom)
 */
class ConversationStateManager {
    constructor() {
        this.inputContainer = null;
        this.isWelcomeMode = true;
        this.initialized = false;
    }

    /**
     * Initialize the conversation state manager
     */
    init() {
        if (this.initialized) return;
        
        this.inputContainer = document.getElementById('floating-input-container');
        if (!this.inputContainer) {
            console.warn('Floating input container not found');
            return;
        }
        
        this.bindEvents();
        
        // Check initial state and update position
        setTimeout(() => {
            this.updateInputPosition();
        }, 100);
        
        this.initialized = true;
        
        console.log('ConversationStateManager initialized');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Listen for conversation state changes
        document.addEventListener('conversationCleared', () => {
            this.onConversationCleared();
        });

        document.addEventListener('messageAdded', () => {
            this.onMessageAdded();
        });

        // Listen for chat state changes
        document.addEventListener('chatStateChanged', () => {
            this.updateInputPosition();
        });
    }

    /**
     * Handle conversation cleared event
     */
    onConversationCleared() {
        this.isWelcomeMode = true;
        this.updateInputPosition();
        console.log('Conversation cleared - switching to welcome mode');
    }

    /**
     * Handle message added event
     */
    onMessageAdded() {
        this.isWelcomeMode = false;
        this.updateInputPosition();
        console.log('Message added - switching to chat mode');
    }

    /**
     * Update input container position based on current state
     */
    updateInputPosition() {
        if (!this.inputContainer) return;

        if (this.isWelcomeMode) {
            this.inputContainer.classList.add('welcome-mode');
            this.inputContainer.classList.remove('chat-mode');
        } else {
            this.inputContainer.classList.add('chat-mode');
            this.inputContainer.classList.remove('welcome-mode');
        }
    }

    /**
     * Check if currently in welcome mode
     */
    isInWelcomeMode() {
        return this.isWelcomeMode;
    }

    /**
     * Force set welcome mode
     */
    setWelcomeMode(isWelcome) {
        this.isWelcomeMode = isWelcome;
        this.updateInputPosition();
    }
}

// Create global instance
window.conversationStateManager = new ConversationStateManager();

export default ConversationStateManager;