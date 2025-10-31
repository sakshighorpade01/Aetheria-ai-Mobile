// js/welcome-display.js
// Lightweight welcome message controller for the PWA

import UserProfileService from './user-profile-service.js';

class WelcomeDisplay {
  constructor({
    element = null,
    containerSelector = '.welcome-container',
    messageContainer = null,
    messageContainerSelector = '#chat-messages',
  } = {}) {
    this.initialized = false;
    this.isVisible = false;
    this.hiddenByFloatingWindow = false;
    this.username = 'there';

    this.element = element;
    this.containerSelector = containerSelector;
    this.messageContainer = messageContainer;
    this.messageContainerSelector = messageContainerSelector;

    this.userProfileService = new UserProfileService();

    this.onMessageAdded = this.updateDisplay.bind(this);
    this.onConversationCleared = this.handleConversationCleared.bind(this);
  }

  initialize() {
    if (this.initialized) return;

    this.ensureElement();
    this.ensureMessageContainer();
    this.bindEvents();

    this.initialized = true;

    void this.refreshUsername();
    requestAnimationFrame(() => this.updateDisplay());
    console.log('WelcomeDisplay initialized.');
  }

  ensureElement() {
    if (this.element && this.element instanceof HTMLElement) {
      this.element.classList.add('welcome-container');
      return;
    }

    const existing = document.querySelector(this.containerSelector);
    if (existing) {
      this.element = existing;
      return;
    }

    // Create fallback element if markup missing
    const appContainer = document.querySelector('.app-container') || document.body;
    const wrapper = document.createElement('div');
    wrapper.className = 'welcome-container hidden';
    wrapper.setAttribute('role', 'banner');
    wrapper.setAttribute('aria-live', 'polite');

    wrapper.innerHTML = `
      <div class="welcome-content">
        <h1 class="welcome-heading">Hello there</h1>
        <h2 class="welcome-secondary-heading">What can I do for you?</h2>
      </div>
    `;

    appContainer.appendChild(wrapper);
    this.element = wrapper;
  }

  ensureMessageContainer() {
    if (this.messageContainer && this.messageContainer instanceof HTMLElement) {
      return;
    }
    this.messageContainer = document.querySelector(this.messageContainerSelector);
  }

  bindEvents() {
    document.addEventListener('messageAdded', this.onMessageAdded);
    document.addEventListener('conversationCleared', this.onConversationCleared);
  }

  async refreshUsername() {
    try {
      const name = await this.userProfileService.getUserName();
      this.updateUsername(name);
    } catch (error) {
      console.warn('WelcomeDisplay: failed to fetch username', error);
      this.updateUsername('there');
    }
  }

  updateUsername(name) {
    this.username = name || 'there';
    const heading = this.element?.querySelector('.welcome-heading');
    if (heading) {
      heading.textContent = `Hello ${this.username}`;
    }
  }

  handleConversationCleared() {
    this.hiddenByFloatingWindow = false;
    requestAnimationFrame(() => this.updateDisplay());
  }

  shouldShow() {
    if (!this.messageContainer) return true;
    return this.messageContainer.children.length === 0;
  }

  updateDisplay() {
    if (!this.element) return;
    if (this.hiddenByFloatingWindow) {
      this.hide();
      return;
    }

    if (this.shouldShow()) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    if (!this.element || this.isVisible) return;
    this.element.classList.remove('hidden');
    this.element.classList.add('visible');
    this.isVisible = true;
  }

  hide() {
    if (!this.element || !this.isVisible) return;
    this.element.classList.remove('visible');
    this.element.classList.add('hidden');
    this.isVisible = false;
  }

  hideForFloatingWindow() {
    this.hiddenByFloatingWindow = true;
    this.hide();
  }

  showAfterFloatingWindow() {
    this.hiddenByFloatingWindow = false;
    this.updateDisplay();
  }

  destroy() {
    document.removeEventListener('messageAdded', this.onMessageAdded);
    document.removeEventListener('conversationCleared', this.onConversationCleared);
    this.initialized = false;
  }
}

export default WelcomeDisplay;
