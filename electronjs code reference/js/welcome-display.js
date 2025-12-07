// js/welcome-display.js (Complete, Updated with Refresh Logic)

import UserProfileService from './user-profile-service.js';

/**
 * WelcomeDisplay - Manages the welcome message display and user personalization
 * Handles the transition between welcome state and chat state
 */
class WelcomeDisplay {
    constructor() {
        this.isVisible = false;
        this.username = null;
        this.welcomeElement = null;
        this.initialized = false;
        this.userProfileService = new UserProfileService();
        this.hiddenByFloatingWindow = false;
    }

    /**
     * Initialize the welcome display component
     */
    initialize() {
        if (this.initialized) return;

        this.createWelcomeElement();
        this.fetchUsername(); // Initial fetch on startup
        this.bindEvents();
        this.initialized = true;

        setTimeout(() => {
            this.updateDisplay();
        }, 100);

        console.log('WelcomeDisplay initialized successfully');
    }

    /**
     * Create the welcome message HTML structure
     */
    createWelcomeElement() {
        this.welcomeElement = document.createElement('div');
        this.welcomeElement.className = 'welcome-container hidden';
        this.welcomeElement.setAttribute('role', 'banner');
        this.welcomeElement.setAttribute('aria-live', 'polite');

        const welcomeContent = document.createElement('div');
        welcomeContent.className = 'welcome-content';

        const heading = document.createElement('h1');
        heading.className = 'welcome-heading';
        heading.id = 'welcome-heading';
        heading.textContent = 'Hello there';

        const secondaryHeading = document.createElement('h2');
        secondaryHeading.className = 'welcome-secondary-heading';
        secondaryHeading.id = 'welcome-secondary-heading';
        secondaryHeading.textContent = 'What can I do for you?';

        welcomeContent.appendChild(heading);
        welcomeContent.appendChild(secondaryHeading);
        this.welcomeElement.appendChild(welcomeContent);

        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.appendChild(this.welcomeElement);
        }
    }

    /**
     * Fetch username for personalization using UserProfileService
     */
    async fetchUsername() {
        try {
            const username = await this.userProfileService.getUserName();
            this.updateUsername(username);
        } catch (error) {
            console.warn('Could not fetch username:', error);
            this.updateUsername('there');
        }
    }

    /**
     * Update the username in the welcome message
     * @param {string} username - The username to display.
     */
    updateUsername(username) {
        this.username = username;
        const heading = this.welcomeElement?.querySelector('.welcome-heading');
        if (heading) {
            heading.textContent = `Hello ${username}`;
        }
    }

    /**
     * Show the welcome message with animation
     */
    show() {
        if (!this.welcomeElement || this.isVisible) return;
        this.welcomeElement.classList.remove('hidden');
        this.welcomeElement.classList.add('visible');
        this.isVisible = true;
    }

    /**
     * Hide the welcome message with animation
     */
    hide() {
        if (!this.welcomeElement || !this.isVisible) return;
        this.welcomeElement.classList.remove('visible');
        this.welcomeElement.classList.add('hidden');
        this.isVisible = false;
    }

    /**
     * Check if welcome message should be shown based on chat state
     */
    shouldShow() {
        const chatMessages = document.getElementById('chat-messages');
        return !chatMessages || chatMessages.children.length === 0;
    }

    /**
     * Update display based on current chat state
     */
    updateDisplay() {
        if (this.shouldShow() && !this.hiddenByFloatingWindow) {
            this.show();
        } else {
            this.hide();
        }
    }

    /**
     * Bind event listeners to react to application state changes
     */
    bindEvents() {
        document.addEventListener('messageAdded', () => this.updateDisplay());
        document.addEventListener('conversationCleared', () => this.updateDisplay());
    }

    /**
     * Hide welcome message when floating windows open
     */
    hideForFloatingWindow() {
        this.hiddenByFloatingWindow = true;
        this.hide();
    }

    /**
     * Show welcome message when floating windows close (if appropriate)
     */
    showAfterFloatingWindow() {
        this.hiddenByFloatingWindow = false;
        this.updateDisplay();
    }

    /**
     * NEW: Public method to refresh the username from the auth service.
     * This is the key to solving the race condition.
     */
    async refreshUsername() {
        console.log('WelcomeDisplay: Refreshing username due to auth state change.');
        this.userProfileService.clearCache();
        await this.fetchUsername();
    }
}

// Export for use in other modules
export default WelcomeDisplay;