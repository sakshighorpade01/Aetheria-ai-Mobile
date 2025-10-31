// js/floating-window-manager.js
// DOM-based floating window tracker adapted from Electron version.

class FloatingWindowManager {
  constructor({ welcomeDisplay = null } = {}) {
    this.welcomeDisplay = welcomeDisplay;
    this.registeredWindows = new Map();
    this.openWindows = new Set();
    this.observers = new Map();

    this.onWindowOpen = this.onWindowOpen.bind(this);
    this.onWindowClose = this.onWindowClose.bind(this);
  }

  setWelcomeDisplay(welcomeDisplay) {
    this.welcomeDisplay = welcomeDisplay;
  }

  registerWindow(windowId, element, options = {}) {
    if (!windowId || !element) {
      console.warn('FloatingWindowManager: invalid registration', { windowId, element });
      return false;
    }

    const windowData = {
      windowId,
      element,
      isOpen: !element.classList.contains('hidden'),
      options: { ...options },
      openedAt: null,
      closedAt: null,
    };

    this.registeredWindows.set(windowId, windowData);
    this.monitorElement(windowId, element);

    if (windowData.isOpen) {
      this.openWindows.add(windowId);
      this.updateWelcomeMessageVisibility();
    }

    return true;
  }

  monitorElement(windowId, element) {
    if (!('MutationObserver' in window)) return;

    const observer = new MutationObserver(() => {
      const isHidden = element.classList.contains('hidden');
      const data = this.registeredWindows.get(windowId);
      if (!data) return;

      if (!isHidden && !data.isOpen) {
        this.onWindowOpen(windowId);
      } else if (isHidden && data.isOpen) {
        this.onWindowClose(windowId);
      }
    });

    observer.observe(element, { attributes: true, attributeFilter: ['class'] });
    this.observers.set(windowId, observer);
  }

  onWindowOpen(windowId) {
    const data = this.registeredWindows.get(windowId);
    if (!data || data.isOpen) return;

    data.isOpen = true;
    data.openedAt = Date.now();
    this.openWindows.add(windowId);
    this.dispatchEvent('floating-window-opened', windowId);
    this.updateWelcomeMessageVisibility();
  }

  onWindowClose(windowId) {
    const data = this.registeredWindows.get(windowId);
    if (!data || !data.isOpen) return;

    data.isOpen = false;
    data.closedAt = Date.now();
    this.openWindows.delete(windowId);
    this.dispatchEvent('floating-window-closed', windowId);
    this.updateWelcomeMessageVisibility();
  }

  updateWelcomeMessageVisibility() {
    if (!this.welcomeDisplay) return;
    if (this.openWindows.size > 0) {
      this.welcomeDisplay.hideForFloatingWindow();
    } else {
      this.welcomeDisplay.showAfterFloatingWindow();
    }
  }

  dispatchEvent(type, windowId) {
    const event = new CustomEvent(type, {
      detail: {
        windowId,
        openWindows: Array.from(this.openWindows),
        hasOpenWindows: this.openWindows.size > 0,
      },
    });

    document.dispatchEvent(event);
  }

  unregisterWindow(windowId) {
    const observer = this.observers.get(windowId);
    if (observer) {
      observer.disconnect();
      this.observers.delete(windowId);
    }

    this.openWindows.delete(windowId);
    this.registeredWindows.delete(windowId);
    this.updateWelcomeMessageVisibility();
  }

  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.registeredWindows.clear();
    this.openWindows.clear();
    this.welcomeDisplay = null;
  }
}

export default FloatingWindowManager;
