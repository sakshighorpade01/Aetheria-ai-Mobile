// js/notification-service.js
// Web-friendly notification manager with glassmorphism styling.

const ICON_MAP = {
  success: '<i class="fas fa-check-circle"></i>',
  error: '<i class="fas fa-exclamation-circle"></i>',
  warning: '<i class="fas fa-exclamation-triangle"></i>',
  info: '<i class="fas fa-info-circle"></i>',
};

class NotificationService {
  constructor({ container } = {}) {
    this.container = container || null;
    this.maxVisible = 5;
    this.defaultDuration = 5000;
    this.notifications = new Map();

    this.ensureContainer();
  }

  ensureContainer() {
    if (this.container && document.body.contains(this.container)) {
      return;
    }

    const existing = document.querySelector('.unified-notification-container');
    if (existing) {
      this.container = existing;
      return;
    }

    const el = document.createElement('div');
    el.className = 'unified-notification-container';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(el);
    this.container = el;
  }

  show(message, type = 'info', duration = this.defaultDuration) {
    if (!message) return null;

    this.ensureContainer();
    const id = `notification-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const element = this.createNotificationElement({ id, message, type, duration });
    this.container.appendChild(element);

    requestAnimationFrame(() => {
      element.classList.add('show');
    });

    const timeoutId = duration ? window.setTimeout(() => this.remove(id), duration) : null;
    this.notifications.set(id, { element, timeoutId });

    this.enforceLimit();
    return id;
  }

  createNotificationElement({ id, message, type, duration }) {
    const element = document.createElement('div');
    element.className = `unified-notification notification-${type}`;
    element.setAttribute('role', 'alert');
    element.dataset.notificationId = id;

    element.innerHTML = `
      <div class="notification-icon">${ICONS_BY_TYPE(type)}</div>
      <div class="notification-content">
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" aria-label="Dismiss notification">
        <i class="fas fa-times"></i>
      </button>
    `;

    const closeBtn = element.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.remove(id));

    if (duration) {
      const progress = document.createElement('div');
      progress.className = 'notification-progress';
      progress.style.animation = `progress ${duration}ms linear forwards`;
      element.appendChild(progress);

      element.addEventListener('mouseenter', () => this.pause(id));
      element.addEventListener('mouseleave', () => this.resume(id, duration));
    }

    return element;
  }

  pause(id) {
    const record = this.notifications.get(id);
    if (!record || !record.timeoutId) return;

    window.clearTimeout(record.timeoutId);
    record.timeoutId = null;

    const progress = record.element.querySelector('.notification-progress');
    if (progress) {
      progress.style.animationPlayState = 'paused';
    }
  }

  resume(id, duration) {
    const record = this.notifications.get(id);
    if (!record) return;

    if (record.timeoutId) return;

    const progress = record.element.querySelector('.notification-progress');
    if (progress) {
      progress.style.animationPlayState = 'running';
    }

    record.timeoutId = window.setTimeout(() => this.remove(id), duration);
  }

  remove(id) {
    const record = this.notifications.get(id);
    if (!record) return;

    if (record.timeoutId) {
      window.clearTimeout(record.timeoutId);
    }

    record.element.classList.remove('show');
    record.element.classList.add('hide');

    record.element.addEventListener('transitionend', () => {
      record.element.remove();
    }, { once: true });

    this.notifications.delete(id);
  }

  enforceLimit() {
    const overflow = this.notifications.size - this.maxVisible;
    if (overflow <= 0) return;

    const ids = Array.from(this.notifications.keys());
    for (let i = 0; i < overflow; i += 1) {
      this.remove(ids[i]);
    }
  }

  clear() {
    Array.from(this.notifications.keys()).forEach((id) => this.remove(id));
  }
}

function ICONS_BY_TYPE(type) {
  return ICON_MAP[type] || ICON_MAP.info;
}

export default NotificationService;
