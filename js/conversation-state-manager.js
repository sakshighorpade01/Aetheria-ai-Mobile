// js/conversation-state-manager.js

/**
 * ConversationStateManager
 * ------------------------
 * Controls the positioning of the floating input container so we can render it
 * in a centered "welcome" state before any messages have been sent, and dock it
 * to the bottom once the conversation begins.
 *
 * The Electron version implicitly queried DOM nodes and stored a singleton on
 * window. For the PWA we allow callers to inject the target container and keep
 * the module side-effect free, while still performing the same class toggles.
 */

class ConversationStateManager {
  constructor({ inputContainer } = {}) {
    this.inputContainer = inputContainer || null;
    this.isWelcomeMode = true;
    this.initialized = false;

    this.onConversationCleared = this.onConversationCleared.bind(this);
    this.onMessageAdded = this.onMessageAdded.bind(this);
    this.onChatStateChanged = this.updateInputPosition.bind(this);
  }

  /**
   * Initialise event listeners and synchronise the initial container state.
   */
  init() {
    if (this.initialized) return;

    if (!this.inputContainer) {
      this.inputContainer = document.getElementById('floating-input-container')
        || document.querySelector('.floating-input-container');
    }

    if (!this.inputContainer) {
      console.warn('ConversationStateManager: floating input container not found.');
      return;
    }

    document.addEventListener('conversationCleared', this.onConversationCleared);
    document.addEventListener('messageAdded', this.onMessageAdded);
    document.addEventListener('chatStateChanged', this.onChatStateChanged);

    // Apply the starting state after the current frame to avoid layout thrash.
    requestAnimationFrame(() => this.updateInputPosition());

    this.initialized = true;
    console.log('ConversationStateManager initialised');
  }

  /**
   * Update the managed DOM node when the floating input is mounted dynamically.
   */
  setInputContainer(element) {
    this.inputContainer = element;
    if (this.initialized) {
      this.updateInputPosition();
    }
  }

  onConversationCleared() {
    this.isWelcomeMode = true;
    this.updateInputPosition();
  }

  onMessageAdded() {
    this.isWelcomeMode = false;
    this.updateInputPosition();
  }

  /**
   * Toggle the CSS utility classes that drive the transitions between welcome
   * and chat modes.
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
   * Clean up listeners when the manager is no longer needed.
   */
  destroy() {
    if (!this.initialized) return;

    document.removeEventListener('conversationCleared', this.onConversationCleared);
    document.removeEventListener('messageAdded', this.onMessageAdded);
    document.removeEventListener('chatStateChanged', this.onChatStateChanged);

    this.initialized = false;
  }
}

export default ConversationStateManager;
