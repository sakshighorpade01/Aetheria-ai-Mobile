// notification-service.js - Unified Notification System with Glassmorphism

class NotificationService {
    constructor() {
        this.notifications = [];
        this.maxVisible = 5;
        this.defaultDuration = 5000;
        this.container = null;
        this.init();
    }

    init() {
        this.createContainer();
    }

    createContainer() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.className = 'unified-notification-container';
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', 'Notifications');
        this.container.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        const notification = this.createNotification(message, type, duration);
        this.addNotification(notification);
        return notification.id;
    }

    showConnection(message, showRetry = false) {
        // Remove any existing connection notifications
        this.notifications
            .filter(n => n.element.classList.contains('notification-connection'))
            .forEach(n => this.remove(n.id));

        const notification = this.createNotification(message, 'connection', null, showRetry);
        this.addNotification(notification);
        return notification.id;
    }

    createNotification(message, type, duration, showRetry = false) {
        const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const element = document.createElement('div');
        element.className = `unified-notification notification-${type}`;
        element.setAttribute('role', 'alert');
        element.setAttribute('data-notification-id', id);

        const icon = this.getIcon(type);
        const iconElement = document.createElement('div');
        iconElement.className = 'notification-icon';
        iconElement.innerHTML = icon;

        const content = document.createElement('div');
        content.className = 'notification-content';
        
        const messageElement = document.createElement('div');
        messageElement.className = 'notification-message';
        messageElement.textContent = message;
        content.appendChild(messageElement);

        if (showRetry) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'notification-retry-btn';
            retryBtn.innerHTML = '<i class="fas fa-redo"></i> Retry';
            retryBtn.onclick = () => {
                if (window.ipcRenderer) {
                    window.ipcRenderer.send('restart-python-bridge');
                }
            };
            content.appendChild(retryBtn);
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.setAttribute('aria-label', 'Close notification');
        closeBtn.onclick = () => this.remove(id);

        element.appendChild(iconElement);
        element.appendChild(content);
        element.appendChild(closeBtn);

        if (duration) {
            const progressBar = document.createElement('div');
            progressBar.className = 'notification-progress';
            element.appendChild(progressBar);
        }

        return { id, element, type, duration, message, isPaused: false, timeoutId: null, startTime: null };
    }

    getIcon(type) {
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-exclamation-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>',
            connection: '<i class="fas fa-circle-notch fa-spin"></i>'
        };
        return icons[type] || icons.info;
    }

    addNotification(notification) {
        this.notifications.push(notification);
        this.container.appendChild(notification.element);

        requestAnimationFrame(() => {
            notification.element.classList.add('show');
        });

        this.setupHoverPause(notification);

        if (notification.duration) {
            this.startAutoDismiss(notification);
        }

        this.manageQueue();
    }

    setupHoverPause(notification) {
        if (!notification.duration) return;

        notification.element.addEventListener('mouseenter', () => {
            notification.isPaused = true;
            if (notification.timeoutId) {
                clearTimeout(notification.timeoutId);
            }
            const progressBar = notification.element.querySelector('.notification-progress');
            if (progressBar) {
                progressBar.style.animationPlayState = 'paused';
            }
        });

        notification.element.addEventListener('mouseleave', () => {
            notification.isPaused = false;
            const elapsed = Date.now() - notification.startTime;
            const remaining = notification.duration - elapsed;
            
            if (remaining > 0) {
                this.startAutoDismiss(notification, remaining);
            } else {
                this.remove(notification.id);
            }
        });
    }

    startAutoDismiss(notification, duration = null) {
        const dismissDuration = duration || notification.duration;
        notification.startTime = Date.now();

        const progressBar = notification.element.querySelector('.notification-progress');
        if (progressBar) {
            progressBar.style.animation = `progress ${dismissDuration}ms linear`;
        }

        notification.timeoutId = setTimeout(() => {
            if (!notification.isPaused) {
                this.remove(notification.id);
            }
        }, dismissDuration);
    }

    remove(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index === -1) return;

        const notification = this.notifications[index];
        
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
        }

        notification.element.classList.remove('show');
        notification.element.classList.add('hide');

        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.remove();
            }
            this.notifications.splice(index, 1);
        }, 300);
    }

    removeConnectionNotifications() {
        this.notifications
            .filter(n => n.element.classList.contains('notification-connection'))
            .forEach(n => this.remove(n.id));
    }

    manageQueue() {
        if (this.notifications.length > this.maxVisible) {
            const toRemove = this.notifications.length - this.maxVisible;
            for (let i = 0; i < toRemove; i++) {
                this.remove(this.notifications[0].id);
            }
        }
    }

    clear() {
        [...this.notifications].forEach(n => this.remove(n.id));
    }
}

// Create singleton instance
const notificationService = new NotificationService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = notificationService;
}

// Make available globally (lowercase to match usage in update-checker.js)
window.notificationService = notificationService;
