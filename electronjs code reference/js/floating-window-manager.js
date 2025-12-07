/**
 * FloatingWindowManager - Centralized management of floating window states
 * Tracks window open/close states and their impact on welcome message visibility
 */
class FloatingWindowManager {
    constructor(welcomeDisplay = null) {
        this.welcomeDisplay = welcomeDisplay;
        this.registeredWindows = new Map();
        this.openWindows = new Set();
        this.eventListeners = new Map();
        
        // Bind methods to preserve context
        this.onWindowOpen = this.onWindowOpen.bind(this);
        this.onWindowClose = this.onWindowClose.bind(this);
        
        console.log('FloatingWindowManager initialized');
    }

    /**
     * Set the welcome display instance
     * @param {WelcomeDisplay} welcomeDisplay - Welcome display instance
     */
    setWelcomeDisplay(welcomeDisplay) {
        this.welcomeDisplay = welcomeDisplay;
        console.log('FloatingWindowManager: WelcomeDisplay instance set');
    }

    /**
     * Register a floating window for state tracking
     * @param {string} windowId - Unique identifier for the window
     * @param {HTMLElement} element - DOM element of the window
     * @param {Object} options - Additional options
     */
    registerWindow(windowId, element, options = {}) {
        try {
            if (!windowId || !element) {
                console.error('FloatingWindowManager: Invalid window registration parameters');
                return false;
            }

            const windowData = {
                windowId,
                element,
                isOpen: false,
                openedAt: null,
                closedAt: null,
                options: { ...options }
            };

            this.registeredWindows.set(windowId, windowData);
            console.log(`FloatingWindowManager: Registered window "${windowId}"`);
            
            // Set up automatic detection if element supports it
            this.setupAutomaticDetection(windowId, element);
            
            return true;
        } catch (error) {
            console.error(`FloatingWindowManager: Error registering window "${windowId}":`, error);
            return false;
        }
    }

    /**
     * Set up automatic detection of window visibility changes
     * @param {string} windowId - Window identifier
     * @param {HTMLElement} element - Window element
     */
    setupAutomaticDetection(windowId, element) {
        try {
            // Use MutationObserver to detect class changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const isHidden = element.classList.contains('hidden');
                        const windowData = this.registeredWindows.get(windowId);
                        
                        if (windowData) {
                            if (!isHidden && !windowData.isOpen) {
                                // Window opened
                                this.onWindowOpen(windowId);
                            } else if (isHidden && windowData.isOpen) {
                                // Window closed
                                this.onWindowClose(windowId);
                            }
                        }
                    }
                });
            });

            observer.observe(element, {
                attributes: true,
                attributeFilter: ['class']
            });

            // Store observer for cleanup
            this.eventListeners.set(windowId, observer);
            
            console.log(`FloatingWindowManager: Set up automatic detection for "${windowId}"`);
        } catch (error) {
            console.error(`FloatingWindowManager: Error setting up detection for "${windowId}":`, error);
        }
    }

    /**
     * Manually notify that a window has opened
     * @param {string} windowId - Window identifier
     */
    onWindowOpen(windowId) {
        try {
            const windowData = this.registeredWindows.get(windowId);
            if (!windowData) {
                console.warn(`FloatingWindowManager: Unknown window "${windowId}" opened`);
                return;
            }

            if (windowData.isOpen) {
                // Already marked as open
                return;
            }

            windowData.isOpen = true;
            windowData.openedAt = Date.now();
            this.openWindows.add(windowId);

            console.log(`FloatingWindowManager: Window "${windowId}" opened`);
            
            // Update welcome message visibility
            this.updateWelcomeMessageVisibility();
            
            // Dispatch custom event
            this.dispatchWindowEvent('floating-window-opened', windowId);
        } catch (error) {
            console.error(`FloatingWindowManager: Error handling window open for "${windowId}":`, error);
        }
    }

    /**
     * Manually notify that a window has closed
     * @param {string} windowId - Window identifier
     */
    onWindowClose(windowId) {
        try {
            const windowData = this.registeredWindows.get(windowId);
            if (!windowData) {
                console.warn(`FloatingWindowManager: Unknown window "${windowId}" closed`);
                return;
            }

            if (!windowData.isOpen) {
                // Already marked as closed
                return;
            }

            windowData.isOpen = false;
            windowData.closedAt = Date.now();
            this.openWindows.delete(windowId);

            console.log(`FloatingWindowManager: Window "${windowId}" closed`);
            
            // Update welcome message visibility
            this.updateWelcomeMessageVisibility();
            
            // Dispatch custom event
            this.dispatchWindowEvent('floating-window-closed', windowId);
        } catch (error) {
            console.error(`FloatingWindowManager: Error handling window close for "${windowId}":`, error);
        }
    }

    /**
     * Check if any floating windows are currently open
     * @returns {boolean} True if any windows are open
     */
    hasOpenWindows() {
        return this.openWindows.size > 0;
    }

    /**
     * Get list of currently open windows
     * @returns {Array<string>} Array of open window IDs
     */
    getOpenWindows() {
        return Array.from(this.openWindows);
    }

    /**
     * Get detailed information about all registered windows
     * @returns {Array<Object>} Array of window data objects
     */
    getWindowStates() {
        return Array.from(this.registeredWindows.values());
    }

    /**
     * Update welcome message visibility based on current window states
     */
    updateWelcomeMessageVisibility() {
        if (!this.welcomeDisplay) {
            console.warn('FloatingWindowManager: No WelcomeDisplay instance available');
            return;
        }

        try {
            const hasOpenWindows = this.hasOpenWindows();
            
            if (hasOpenWindows) {
                // Hide welcome message when any floating window is open
                this.welcomeDisplay.hideForFloatingWindow();
                console.log('FloatingWindowManager: Hiding welcome message (floating windows open)');
            } else {
                // Show welcome message when no floating windows are open (if no messages exist)
                this.welcomeDisplay.showAfterFloatingWindow();
                console.log('FloatingWindowManager: Showing welcome message (no floating windows open)');
            }
        } catch (error) {
            console.error('FloatingWindowManager: Error updating welcome message visibility:', error);
        }
    }

    /**
     * Dispatch custom events for window state changes
     * @param {string} eventType - Type of event
     * @param {string} windowId - Window identifier
     */
    dispatchWindowEvent(eventType, windowId) {
        try {
            const event = new CustomEvent(eventType, {
                detail: {
                    windowId,
                    openWindows: this.getOpenWindows(),
                    hasOpenWindows: this.hasOpenWindows()
                }
            });
            
            document.dispatchEvent(event);
        } catch (error) {
            console.error(`FloatingWindowManager: Error dispatching event "${eventType}":`, error);
        }
    }

    /**
     * Unregister a window and clean up its resources
     * @param {string} windowId - Window identifier
     */
    unregisterWindow(windowId) {
        try {
            // Clean up observer
            const observer = this.eventListeners.get(windowId);
            if (observer) {
                observer.disconnect();
                this.eventListeners.delete(windowId);
            }

            // Remove from open windows if present
            this.openWindows.delete(windowId);

            // Remove from registered windows
            this.registeredWindows.delete(windowId);

            console.log(`FloatingWindowManager: Unregistered window "${windowId}"`);
            
            // Update welcome message visibility
            this.updateWelcomeMessageVisibility();
        } catch (error) {
            console.error(`FloatingWindowManager: Error unregistering window "${windowId}":`, error);
        }
    }

    /**
     * Force refresh of all window states (useful for debugging)
     */
    refreshWindowStates() {
        try {
            console.log('FloatingWindowManager: Refreshing all window states');
            
            this.registeredWindows.forEach((windowData, windowId) => {
                const element = windowData.element;
                if (element) {
                    const isHidden = element.classList.contains('hidden');
                    const shouldBeOpen = !isHidden;
                    
                    if (shouldBeOpen !== windowData.isOpen) {
                        if (shouldBeOpen) {
                            this.onWindowOpen(windowId);
                        } else {
                            this.onWindowClose(windowId);
                        }
                    }
                }
            });
        } catch (error) {
            console.error('FloatingWindowManager: Error refreshing window states:', error);
        }
    }

    /**
     * Get debug information about the manager state
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        return {
            registeredWindows: Array.from(this.registeredWindows.keys()),
            openWindows: this.getOpenWindows(),
            hasOpenWindows: this.hasOpenWindows(),
            welcomeDisplayAvailable: !!this.welcomeDisplay,
            windowStates: this.getWindowStates().map(w => ({
                windowId: w.windowId,
                isOpen: w.isOpen,
                openedAt: w.openedAt,
                closedAt: w.closedAt
            }))
        };
    }

    /**
     * Clean up all resources
     */
    destroy() {
        try {
            // Disconnect all observers
            this.eventListeners.forEach((observer) => {
                observer.disconnect();
            });

            // Clear all data
            this.eventListeners.clear();
            this.registeredWindows.clear();
            this.openWindows.clear();
            this.welcomeDisplay = null;

            console.log('FloatingWindowManager: Destroyed and cleaned up');
        } catch (error) {
            console.error('FloatingWindowManager: Error during cleanup:', error);
        }
    }
}

// Export for use in other modules
export default FloatingWindowManager;