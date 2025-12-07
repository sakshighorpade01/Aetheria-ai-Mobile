// js/skeleton-loader.js
// Skeleton loading state manager

/**
 * SkeletonLoader - Manages skeleton loading states throughout the application
 * Provides methods to show/hide skeletons for various components
 */
class SkeletonLoader {
    constructor() {
        this.activeSkeletons = new Map();
    }

    /**
     * Show a message skeleton (for chat messages)
     * @param {HTMLElement} container - Container to append skeleton
     * @param {string} type - 'user' or 'bot'
     * @param {string} id - Unique identifier for this skeleton
     * @returns {HTMLElement} The skeleton element
     */
    showMessageSkeleton(container, type = 'bot', id = null) {
        const skeletonId = id || `skeleton-msg-${Date.now()}`;
        
        const skeleton = document.createElement('div');
        skeleton.className = `skeleton-message skeleton-message-${type} skeleton-fade-in`;
        skeleton.dataset.skeletonId = skeletonId;
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Loading message');
        
        skeleton.innerHTML = `
            <div class="skeleton-message-bubble">
                <div class="skeleton-message-content">
                    <div class="skeleton skeleton-text long"></div>
                    <div class="skeleton skeleton-text medium"></div>
                    <div class="skeleton skeleton-text short"></div>
                </div>
            </div>
            <span class="skeleton-sr-only">Loading message content...</span>
        `;
        
        container.appendChild(skeleton);
        this.activeSkeletons.set(skeletonId, skeleton);
        
        return skeleton;
    }

    /**
     * Show multiple message skeletons (for initial load)
     * @param {HTMLElement} container - Container to append skeletons
     * @param {number} count - Number of skeletons to show
     * @returns {Array<HTMLElement>} Array of skeleton elements
     */
    showChatLoadingSkeleton(container, count = 3) {
        const skeletons = [];
        
        for (let i = 0; i < count; i++) {
            const type = i % 2 === 0 ? 'bot' : 'user';
            const skeleton = this.showMessageSkeleton(container, type, `chat-load-${i}`);
            skeletons.push(skeleton);
        }
        
        return skeletons;
    }

    /**
     * Show profile dropdown skeleton
     * @param {HTMLElement} container - Container to append skeleton
     * @returns {HTMLElement} The skeleton element
     */
    showProfileSkeleton(container) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-profile-dropdown skeleton-fade-in';
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Loading profile');
        
        skeleton.innerHTML = `
            <div class="skeleton-profile-header">
                <div class="skeleton skeleton-avatar large"></div>
                <div class="skeleton-profile-info">
                    <div class="skeleton skeleton-text medium"></div>
                    <div class="skeleton skeleton-text short"></div>
                </div>
            </div>
            <div class="settings-menu-divider"></div>
            ${this.generateMenuItemSkeletons(5)}
            <span class="skeleton-sr-only">Loading profile information...</span>
        `;
        
        container.innerHTML = skeleton.outerHTML;
        this.activeSkeletons.set('profile-dropdown', skeleton);
        
        return skeleton;
    }

    /**
     * Generate menu item skeletons
     * @param {number} count - Number of items
     * @returns {string} HTML string
     */
    generateMenuItemSkeletons(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-menu-item">
                    <div class="skeleton skeleton-icon"></div>
                    <div class="skeleton skeleton-text medium" style="flex: 1;"></div>
                    <div class="skeleton skeleton-icon"></div>
                </div>
            `;
        }
        return html;
    }

    /**
     * Show context window skeleton (session list)
     * @param {HTMLElement} container - Container to append skeleton
     * @param {number} count - Number of session items
     * @returns {HTMLElement} The skeleton element
     */
    showContextWindowSkeleton(container, count = 6) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-context-window skeleton-fade-in';
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Loading sessions');
        
        let itemsHtml = '';
        for (let i = 0; i < count; i++) {
            itemsHtml += '<div class="skeleton skeleton-session-item"></div>';
        }
        
        skeleton.innerHTML = `
            ${itemsHtml}
            <span class="skeleton-sr-only">Loading session history...</span>
        `;
        
        container.innerHTML = skeleton.outerHTML;
        this.activeSkeletons.set('context-window', skeleton);
        
        return skeleton;
    }

    /**
     * Show settings panel skeleton
     * @param {HTMLElement} container - Container to append skeleton
     * @returns {HTMLElement} The skeleton element
     */
    showSettingsSkeleton(container) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-settings-panel skeleton-fade-in';
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Loading settings');
        
        skeleton.innerHTML = `
            <div class="skeleton-form-group">
                <div class="skeleton skeleton-label"></div>
                <div class="skeleton skeleton-input-field"></div>
            </div>
            <div class="skeleton-form-group">
                <div class="skeleton skeleton-label"></div>
                <div class="skeleton skeleton-input-field"></div>
            </div>
            <div class="skeleton-form-group">
                <div class="skeleton skeleton-label"></div>
                <div class="skeleton skeleton-input-field"></div>
            </div>
            <div class="skeleton-form-group">
                <div class="skeleton skeleton-button"></div>
            </div>
            <span class="skeleton-sr-only">Loading settings...</span>
        `;
        
        container.innerHTML = skeleton.outerHTML;
        this.activeSkeletons.set('settings-panel', skeleton);
        
        return skeleton;
    }

    /**
     * Show task list skeleton
     * @param {HTMLElement} container - Container to append skeleton
     * @param {number} count - Number of task items
     * @returns {HTMLElement} The skeleton element
     */
    showTaskListSkeleton(container, count = 4) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-task-list skeleton-fade-in';
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Loading tasks');
        
        let itemsHtml = '';
        for (let i = 0; i < count; i++) {
            itemsHtml += `
                <div class="skeleton-task-item">
                    <div class="skeleton skeleton-task-checkbox"></div>
                    <div class="skeleton-task-content">
                        <div class="skeleton skeleton-text long"></div>
                        <div class="skeleton skeleton-text medium"></div>
                    </div>
                </div>
            `;
        }
        
        skeleton.innerHTML = `
            ${itemsHtml}
            <span class="skeleton-sr-only">Loading tasks...</span>
        `;
        
        container.innerHTML = skeleton.outerHTML;
        this.activeSkeletons.set('task-list', skeleton);
        
        return skeleton;
    }

    /**
     * Show file attachment skeleton
     * @param {HTMLElement} container - Container to append skeleton
     * @param {number} count - Number of file items
     * @returns {HTMLElement} The skeleton element
     */
    showFileAttachmentSkeleton(container, count = 2) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-fade-in';
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Processing files');
        
        let itemsHtml = '';
        for (let i = 0; i < count; i++) {
            itemsHtml += `
                <div class="skeleton-file-preview">
                    <div class="skeleton skeleton-file-icon"></div>
                    <div class="skeleton skeleton-file-name"></div>
                    <div class="skeleton skeleton-icon"></div>
                </div>
            `;
        }
        
        skeleton.innerHTML = itemsHtml;
        container.appendChild(skeleton);
        
        const skeletonId = `file-attachment-${Date.now()}`;
        this.activeSkeletons.set(skeletonId, skeleton);
        
        return skeleton;
    }

    /**
     * Show code block skeleton
     * @param {HTMLElement} container - Container to append skeleton
     * @returns {HTMLElement} The skeleton element
     */
    showCodeBlockSkeleton(container) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-code-block skeleton-fade-in';
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Loading code');
        
        skeleton.innerHTML = `
            <div class="skeleton-code-header">
                <div class="skeleton-code-info">
                    <div class="skeleton skeleton-icon"></div>
                    <div class="skeleton skeleton-text short"></div>
                </div>
                <div class="skeleton skeleton-icon"></div>
            </div>
            <div class="skeleton-code-content"></div>
            <span class="skeleton-sr-only">Loading code block...</span>
        `;
        
        container.appendChild(skeleton);
        
        const skeletonId = `code-block-${Date.now()}`;
        this.activeSkeletons.set(skeletonId, skeleton);
        
        return skeleton;
    }

    /**
     * Show artifact skeleton
     * @param {HTMLElement} container - Container to append skeleton
     * @returns {HTMLElement} The skeleton element
     */
    showArtifactSkeleton(container) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-artifact skeleton-fade-in';
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Loading artifact');
        
        skeleton.innerHTML = `
            <div class="skeleton-artifact-header">
                <div class="skeleton skeleton-text medium"></div>
                <div class="skeleton skeleton-icon"></div>
            </div>
            <div class="skeleton-artifact-content"></div>
            <span class="skeleton-sr-only">Loading artifact...</span>
        `;
        
        container.appendChild(skeleton);
        
        const skeletonId = `artifact-${Date.now()}`;
        this.activeSkeletons.set(skeletonId, skeleton);
        
        return skeleton;
    }

    /**
     * Remove a specific skeleton by ID
     * @param {string} skeletonId - The skeleton ID to remove
     */
    removeSkeleton(skeletonId) {
        const skeleton = this.activeSkeletons.get(skeletonId);
        if (skeleton && skeleton.parentNode) {
            // Fade out animation
            skeleton.style.opacity = '0';
            skeleton.style.transition = 'opacity 0.2s ease';
            
            setTimeout(() => {
                skeleton.remove();
                this.activeSkeletons.delete(skeletonId);
            }, 200);
        }
    }

    /**
     * Remove skeleton by element
     * @param {HTMLElement} skeleton - The skeleton element to remove
     */
    removeSkeletonElement(skeleton) {
        if (skeleton && skeleton.parentNode) {
            skeleton.style.opacity = '0';
            skeleton.style.transition = 'opacity 0.2s ease';
            
            setTimeout(() => {
                skeleton.remove();
                
                // Remove from active skeletons map
                for (const [id, el] of this.activeSkeletons.entries()) {
                    if (el === skeleton) {
                        this.activeSkeletons.delete(id);
                        break;
                    }
                }
            }, 200);
        }
    }

    /**
     * Remove all skeletons from a container
     * @param {HTMLElement} container - Container to clear skeletons from
     */
    removeAllSkeletonsFromContainer(container) {
        const skeletons = container.querySelectorAll('[data-skeleton-id], [aria-busy="true"]');
        skeletons.forEach(skeleton => {
            this.removeSkeletonElement(skeleton);
        });
    }

    /**
     * Remove all active skeletons
     */
    removeAllSkeletons() {
        this.activeSkeletons.forEach((skeleton, id) => {
            this.removeSkeleton(id);
        });
    }

    /**
     * Replace skeleton with actual content
     * @param {string} skeletonId - The skeleton ID to replace
     * @param {HTMLElement} content - The actual content element
     */
    replaceSkeletonWithContent(skeletonId, content) {
        const skeleton = this.activeSkeletons.get(skeletonId);
        if (skeleton && skeleton.parentNode) {
            // Fade in the new content
            content.style.opacity = '0';
            skeleton.parentNode.replaceChild(content, skeleton);
            
            requestAnimationFrame(() => {
                content.style.transition = 'opacity 0.3s ease';
                content.style.opacity = '1';
            });
            
            this.activeSkeletons.delete(skeletonId);
        }
    }

    /**
     * Check if a skeleton is currently active
     * @param {string} skeletonId - The skeleton ID to check
     * @returns {boolean}
     */
    isSkeletonActive(skeletonId) {
        return this.activeSkeletons.has(skeletonId);
    }

    /**
     * Get count of active skeletons
     * @returns {number}
     */
    getActiveSkeletonCount() {
        return this.activeSkeletons.size;
    }

    /**
     * Show a generic loading skeleton in a container
     * @param {HTMLElement} container - Container to show skeleton in
     * @param {Object} options - Configuration options
     * @returns {HTMLElement} The skeleton element
     */
    showGenericSkeleton(container, options = {}) {
        const {
            lines = 3,
            type = 'text', // 'text', 'card', 'list'
            id = null
        } = options;

        const skeletonId = id || `generic-${Date.now()}`;
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-fade-in';
        skeleton.dataset.skeletonId = skeletonId;
        skeleton.setAttribute('aria-busy', 'true');
        skeleton.setAttribute('aria-label', 'Loading content');

        if (type === 'text') {
            let html = '';
            for (let i = 0; i < lines; i++) {
                const width = i === lines - 1 ? 'short' : (i % 2 === 0 ? 'long' : 'medium');
                html += `<div class="skeleton skeleton-text ${width}"></div>`;
            }
            skeleton.innerHTML = html;
        } else if (type === 'card') {
            skeleton.innerHTML = '<div class="skeleton skeleton-card"></div>';
        } else if (type === 'list') {
            let html = '';
            for (let i = 0; i < lines; i++) {
                html += `
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <div class="skeleton skeleton-icon"></div>
                        <div class="skeleton skeleton-text long" style="flex: 1;"></div>
                    </div>
                `;
            }
            skeleton.innerHTML = html;
        }

        container.appendChild(skeleton);
        this.activeSkeletons.set(skeletonId, skeleton);

        return skeleton;
    }
}

// Create and export singleton instance
const skeletonLoader = new SkeletonLoader();

// Make it available globally
if (typeof window !== 'undefined') {
    window.skeletonLoader = skeletonLoader;
}

export default skeletonLoader;
