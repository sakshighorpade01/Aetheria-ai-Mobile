/**
 * Update Checker Service
 * Checks for new versions and notifies users
 */

class UpdateChecker {
    constructor() {
        this.currentVersion = '1.1.4'; // Should match package.json
        this.githubRepo = 'GodBoii/AI-OS-website'; // Repository where releases are published
        this.updateCheckUrl = `https://api.github.com/repos/${this.githubRepo}/releases/latest`;
        this.checkInterval = 3600000; // Check every hour (in milliseconds)
        this.lastCheckTime = null;
        this.latestUpdateData = null; // Store latest update info
        this.updateAvailable = false;
    }

    /**
     * Initialize the update checker
     */
    init() {
        // Check on startup (after 10 seconds delay)
        setTimeout(() => this.checkForUpdates(), 10000);
        
        // Check periodically
        setInterval(() => this.checkForUpdates(), this.checkInterval);
        
        // Setup UI event listeners
        this.setupUIListeners();
        
        console.log('Update checker initialized');
    }

    /**
     * Setup UI event listeners for Updates tab
     */
    setupUIListeners() {
        const checkBtn = document.getElementById('check-updates-btn');
        const downloadBtn = document.getElementById('download-update-btn');
        
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.manualCheck());
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (this.latestUpdateData) {
                    const downloadUrl = this.getDownloadUrl(this.latestUpdateData);
                    window.open(downloadUrl, '_blank');
                }
            });
        }
    }

    /**
     * Update the Updates tab UI
     */
    updateUI(status = 'checking') {
        const icon = document.getElementById('update-icon');
        const title = document.getElementById('update-status-title');
        const message = document.getElementById('update-status-message');
        const lastCheck = document.getElementById('last-check-time');
        const currentVersionDisplay = document.getElementById('current-version-display');
        const updateDetails = document.getElementById('update-details');
        const downloadBtn = document.getElementById('download-update-btn');
        const checkBtn = document.getElementById('check-updates-btn');

        if (currentVersionDisplay) {
            currentVersionDisplay.textContent = this.currentVersion;
        }

        if (lastCheck && this.lastCheckTime) {
            const timeAgo = this.getTimeAgo(this.lastCheckTime);
            lastCheck.textContent = timeAgo;
        }

        if (status === 'checking') {
            if (icon) icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            if (title) title.textContent = 'Checking for updates...';
            if (message) message.textContent = 'Please wait while we check for the latest version.';
            if (updateDetails) updateDetails.classList.add('hidden');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            if (checkBtn) checkBtn.disabled = true;
        } else if (status === 'up-to-date') {
            if (icon) {
                icon.innerHTML = '<i class="fas fa-check-circle"></i>';
                icon.style.color = '#4caf50';
            }
            if (title) title.textContent = 'You\'re up to date!';
            if (message) message.textContent = `You have the latest version of Aetheria AI (v${this.currentVersion}).`;
            if (updateDetails) updateDetails.classList.add('hidden');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            if (checkBtn) checkBtn.disabled = false;
        } else if (status === 'update-available') {
            if (icon) {
                icon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
                icon.style.color = '#ff9800';
            }
            if (title) title.textContent = 'Update Available!';
            if (message) message.textContent = `Version ${this.latestUpdateData.version} is now available.`;
            if (updateDetails) {
                updateDetails.classList.remove('hidden');
                this.populateUpdateDetails();
            }
            if (downloadBtn) downloadBtn.classList.remove('hidden');
            if (checkBtn) checkBtn.disabled = false;
        } else if (status === 'error') {
            if (icon) {
                icon.innerHTML = '<i class="fas fa-times-circle"></i>';
                icon.style.color = '#f44336';
            }
            if (title) title.textContent = 'Check Failed';
            if (message) message.textContent = 'Unable to check for updates. Please try again later.';
            if (updateDetails) updateDetails.classList.add('hidden');
            if (downloadBtn) downloadBtn.classList.add('hidden');
            if (checkBtn) checkBtn.disabled = false;
        }
    }

    /**
     * Populate update details in the UI
     */
    populateUpdateDetails() {
        const versionNumber = document.getElementById('new-version-number');
        const releaseNotes = document.getElementById('release-notes-content');
        const downloadLinks = document.getElementById('download-links');

        if (!this.latestUpdateData) return;

        if (versionNumber) {
            versionNumber.textContent = this.latestUpdateData.version;
        }

        if (releaseNotes) {
            releaseNotes.innerHTML = this.latestUpdateData.releaseNotes;
        }

        if (downloadLinks && this.latestUpdateData.downloads) {
            downloadLinks.innerHTML = '';
            const platform = this.detectPlatform();
            
            const platformNames = {
                'windows': { icon: '🪟', name: 'Windows' },
                'linux-appimage': { icon: '🐧', name: 'Linux AppImage' },
                'linux-deb': { icon: '🐧', name: 'Linux (Debian)' },
                'linux-rpm': { icon: '🐧', name: 'Linux (RPM)' },
                'mac': { icon: '🍎', name: 'macOS' }
            };

            Object.entries(this.latestUpdateData.downloads).forEach(([key, url]) => {
                const info = platformNames[key] || { icon: '📦', name: key };
                const isRecommended = (platform === 'windows' && key === 'windows') ||
                                     (platform === 'linux' && key === 'linux-appimage') ||
                                     (platform === 'mac' && key === 'mac');
                
                const link = document.createElement('a');
                link.href = url;
                link.className = 'download-link' + (isRecommended ? ' recommended' : '');
                link.target = '_blank';
                link.innerHTML = `
                    <span class="platform-icon">${info.icon}</span>
                    <span class="platform-name">${info.name}</span>
                    ${isRecommended ? '<span class="recommended-badge">Recommended</span>' : ''}
                `;
                downloadLinks.appendChild(link);
            });
        }
    }

    /**
     * Get time ago string
     */
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    }

    /**
     * Check for updates from GitHub Releases API
     */
    async checkForUpdates(silent = false) {
        try {
            if (!silent) {
                this.updateUI('checking');
            }
            
            this.lastCheckTime = new Date();
            
            const response = await fetch(this.updateCheckUrl, {
                cache: 'no-cache',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                console.warn('Failed to check for updates:', response.status);
                if (!silent) {
                    this.updateUI('error');
                }
                return;
            }

            const release = await response.json();
            
            // Extract version from tag_name (remove 'v' prefix if present)
            const latestVersion = release.tag_name.replace(/^v/, '');
            
            if (this.isNewerVersion(latestVersion, this.currentVersion)) {
                // Transform GitHub release data to our format
                const updateData = this.transformReleaseData(release, latestVersion);
                this.latestUpdateData = updateData;
                this.updateAvailable = true;
                
                if (!silent) {
                    this.updateUI('update-available');
                }
                
                // Show notification only on automatic checks (not manual)
                if (silent) {
                    this.notifyUpdate(updateData);
                }
            } else {
                this.updateAvailable = false;
                this.latestUpdateData = null;
                console.log('App is up to date:', this.currentVersion);
                
                if (!silent) {
                    this.updateUI('up-to-date');
                }
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
            if (!silent) {
                this.updateUI('error');
            }
        }
    }

    /**
     * Transform GitHub release data to our internal format
     */
    transformReleaseData(release, version) {
        const downloads = {};
        
        // Parse assets to find platform-specific downloads
        if (release.assets && release.assets.length > 0) {
            release.assets.forEach(asset => {
                const name = asset.name.toLowerCase();
                
                if (name.endsWith('.exe')) {
                    downloads.windows = asset.browser_download_url;
                } else if (name.endsWith('.appimage')) {
                    downloads['linux-appimage'] = asset.browser_download_url;
                } else if (name.endsWith('.deb')) {
                    downloads['linux-deb'] = asset.browser_download_url;
                } else if (name.endsWith('.rpm')) {
                    downloads['linux-rpm'] = asset.browser_download_url;
                } else if (name.endsWith('.dmg')) {
                    downloads.mac = asset.browser_download_url;
                }
            });
        }
        
        // Convert markdown release notes to HTML (basic conversion)
        const releaseNotes = this.markdownToHtml(release.body || 'Bug fixes and improvements');
        
        return {
            version: version,
            releaseDate: release.published_at.split('T')[0],
            downloadUrl: release.html_url,
            downloads: downloads,
            releaseNotes: releaseNotes,
            critical: false, // Can be determined by checking release name/body for keywords
            minVersion: '1.0.0'
        };
    }

    /**
     * Basic markdown to HTML conversion for release notes
     */
    markdownToHtml(markdown) {
        if (!markdown) return 'Bug fixes and improvements';
        
        let html = markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            // Lists
            .replace(/^\* (.+)$/gim, '<li>$1</li>')
            .replace(/^- (.+)$/gim, '<li>$1</li>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Wrap lists
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Wrap in paragraph if not already wrapped
        if (!html.startsWith('<')) {
            html = `<p>${html}</p>`;
        }
        
        return html;
    }

    /**
     * Compare version numbers (semantic versioning)
     */
    isNewerVersion(latest, current) {
        const latestParts = latest.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (latestParts[i] > currentParts[i]) return true;
            if (latestParts[i] < currentParts[i]) return false;
        }
        return false;
    }

    /**
     * Detect user's platform
     */
    detectPlatform() {
        const platform = navigator.platform.toLowerCase();
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (platform.includes('win')) return 'windows';
        if (platform.includes('mac')) return 'mac';
        if (platform.includes('linux')) return 'linux';
        
        // Fallback to user agent
        if (userAgent.includes('windows')) return 'windows';
        if (userAgent.includes('mac')) return 'mac';
        if (userAgent.includes('linux')) return 'linux';
        
        return 'unknown';
    }

    /**
     * Get appropriate download URL for user's platform
     */
    getDownloadUrl(updateData) {
        const platform = this.detectPlatform();
        
        // If platform-specific downloads exist
        if (updateData.downloads) {
            if (platform === 'windows' && updateData.downloads.windows) {
                return updateData.downloads.windows;
            }
            if (platform === 'linux') {
                // Prefer AppImage for Linux
                return updateData.downloads['linux-appimage'] || 
                       updateData.downloads['linux-deb'] || 
                       updateData.downloads['linux-rpm'];
            }
            if (platform === 'mac' && updateData.downloads.mac) {
                return updateData.downloads.mac;
            }
        }
        
        // Fallback to general download URL
        return updateData.downloadUrl;
    }

    /**
     * Show update notification to user
     */
    notifyUpdate(updateData) {
        const { version, critical } = updateData;
        const downloadUrl = this.getDownloadUrl(updateData);
        
        // Check if we already notified about this version
        const lastNotified = localStorage.getItem('lastNotifiedVersion');
        if (lastNotified === version) {
            return; // Don't spam notifications
        }
        
        // Show simple notification
        const message = `Version ${version} is now available! Click to view details.`;
        const type = critical ? 'warning' : 'info';
        
        if (window.notificationService) {
            const notifId = window.notificationService.show(message, type, 8000);
            
            // Add click handler to notification to open Updates tab
            setTimeout(() => {
                const notifElement = document.querySelector(`[data-notification-id="${notifId}"]`);
                if (notifElement) {
                    notifElement.style.cursor = 'pointer';
                    notifElement.addEventListener('click', () => {
                        // Open AIOS settings to Updates tab
                        if (window.AIOS) {
                            window.AIOS.showWindow();
                            window.AIOS.switchTab('updates');
                        }
                    });
                }
            }, 100);
        } else {
            // Fallback to browser notification
            this.showBrowserNotification(version, downloadUrl);
        }

        // Store that we've notified about this version
        localStorage.setItem('lastNotifiedVersion', version);
    }

    /**
     * Show release notes in a modal
     */
    showReleaseNotes(notes, version, updateData) {
        const downloadUrl = this.getDownloadUrl(updateData);
        const platform = this.detectPlatform();
        
        // Build download options HTML
        let downloadOptions = '';
        if (updateData.downloads) {
            downloadOptions = '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color, #333);"><p style="margin-bottom: 8px; font-weight: 500;">Download for other platforms:</p><div style="display: flex; flex-direction: column; gap: 8px;">';
            
            if (updateData.downloads.windows) {
                downloadOptions += `<a href="${updateData.downloads.windows}" target="_blank" style="color: var(--primary-color, #007bff); text-decoration: none;">🪟 Windows (.exe)</a>`;
            }
            if (updateData.downloads['linux-appimage']) {
                downloadOptions += `<a href="${updateData.downloads['linux-appimage']}" target="_blank" style="color: var(--primary-color, #007bff); text-decoration: none;">🐧 Linux AppImage</a>`;
            }
            if (updateData.downloads['linux-deb']) {
                downloadOptions += `<a href="${updateData.downloads['linux-deb']}" target="_blank" style="color: var(--primary-color, #007bff); text-decoration: none;">🐧 Linux (.deb)</a>`;
            }
            if (updateData.downloads['linux-rpm']) {
                downloadOptions += `<a href="${updateData.downloads['linux-rpm']}" target="_blank" style="color: var(--primary-color, #007bff); text-decoration: none;">🐧 Linux (.rpm)</a>`;
            }
            if (updateData.downloads.mac) {
                downloadOptions += `<a href="${updateData.downloads.mac}" target="_blank" style="color: var(--primary-color, #007bff); text-decoration: none;">🍎 macOS (.dmg)</a>`;
            }
            
            downloadOptions += '</div></div>';
        }
        
        const modal = document.createElement('div');
        modal.className = 'update-modal';
        modal.innerHTML = `
            <div class="update-modal-content">
                <div class="update-modal-header">
                    <h2>What's New in v${version}</h2>
                    <button class="update-modal-close">&times;</button>
                </div>
                <div class="update-modal-body">
                    ${notes || 'Bug fixes and improvements'}
                    ${downloadOptions}
                </div>
                <div class="update-modal-footer">
                    <button class="btn-secondary update-modal-later">Remind Me Later</button>
                    <button class="btn-primary update-modal-download">Download for ${platform === 'windows' ? 'Windows' : platform === 'linux' ? 'Linux' : 'Your Platform'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        modal.querySelector('.update-modal-close').onclick = () => modal.remove();
        modal.querySelector('.update-modal-later').onclick = () => modal.remove();
        modal.querySelector('.update-modal-download').onclick = () => {
            window.open(downloadUrl, '_blank');
            modal.remove();
        };
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    /**
     * Fallback browser notification
     */
    showBrowserNotification(version, downloadUrl) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('Update Available', {
                body: `Version ${version} is ready to download`,
                icon: 'assets/icon.png'
            });
            
            notification.onclick = () => {
                window.open(downloadUrl, '_blank');
            };
        }
    }

    /**
     * Dismiss update notification
     */
    dismissUpdateNotification(version) {
        localStorage.setItem('dismissedVersion', version);
        localStorage.setItem('dismissedAt', Date.now());
    }

    /**
     * Manual check for updates (triggered by user)
     */
    async manualCheck() {
        if (window.notificationService) {
            window.notificationService.show('Checking for updates...', 'info', 2000);
        }

        await this.checkForUpdates(false); // false = not silent, update UI
    }
}

// Initialize on page load
const updateChecker = new UpdateChecker();
window.updateChecker = updateChecker;

// Auto-start if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => updateChecker.init());
} else {
    updateChecker.init();
}
