// js/aios.js

import { supabase } from './supabase-client.js';
import NotificationService from './notification-service.js';

// Backend URL for OAuth integrations - Production (Render)
const OAUTH_BACKEND_URL = 'https://aios-web.onrender.com';
// Backend URL for API calls - Production (Railway)
const API_BACKEND_URL = 'https://aios-web-production.up.railway.app';

export class AIOS {
    constructor() {
        this.initialized = false;
        this.currentTab = 'profile';
        this.elements = {};
        this.notificationService = new NotificationService();
    }

    async init() {
        if (this.initialized) return;

        this.cacheElements();
        this.setupEventListeners();

        // Load saved theme preference
        this.loadThemePreference();
        this.updateThemeUI();

        // Handle OAuth callback on page load
        await this.handleOAuthCallback();

        // Handle integration OAuth callback
        this.handleIntegrationOAuthCallback();

        // Get current user and update UI
        const { data: { user } } = await supabase.auth.getUser();
        await this.updateAuthUI(user);

        this.initialized = true;
    }

    loadThemePreference() {
        const savedTheme = localStorage.getItem('theme-preference');
        if (savedTheme) {
            document.body.classList.remove('light-mode', 'dark-mode');
            document.body.classList.add(`${savedTheme}-mode`);
        }
        // If no saved preference, keep the default from HTML (dark-mode)
    }

    cacheElements() {
        this.elements = {
            profileMenuBtn: document.getElementById('profile-menu-btn'),
            profileDropdown: document.getElementById('profile-dropdown'),
            settingsView: document.getElementById('settings-view'),
            profilePhoto: document.getElementById('profile-photo'),
            profileIconDefault: document.getElementById('profile-icon-default'),

            settingsMenuItems: document.querySelectorAll('.settings-menu-item'),
            settingsPanels: document.querySelectorAll('.settings-full-panel'),
            backButtons: document.querySelectorAll('.back-to-menu-btn'),

            logoutBtn: document.getElementById('logout-btn'),
            userNameDisplay: document.getElementById('userName-display'),
            userEmailDisplay: document.getElementById('userEmail-display'),
            profileAvatarLarge: document.getElementById('profile-avatar-large'),
            accountLoggedOut: document.getElementById('account-logged-out'),
            accountLoggedIn: document.getElementById('account-logged-in'),

            authTabs: document.querySelectorAll('.auth-tab-btn'),
            loginForm: document.getElementById('login-form'),
            signupForm: document.getElementById('signup-form'),
            loginError: document.getElementById('login-error'),
            signupError: document.getElementById('signup-error'),

            themeOptions: document.querySelectorAll('.theme-option'),

            githubConnectBtn: document.getElementById('connect-github-btn'),
            googleConnectBtn: document.getElementById('connect-google-btn'),
            vercelConnectBtn: document.getElementById('connect-vercel-btn'),
            supabaseConnectBtn: document.getElementById('connect-supabase-btn'),

            // Google Sign-In Buttons
            googleSignInBtn: document.getElementById('google-signin-btn'),
            googleSignUpBtn: document.getElementById('google-signup-btn'),
        };
    }

    setupEventListeners() {
        // Listen for OAuth callback messages from popup windows
        window.addEventListener('message', (event) => {
            // Verify the message is from our own origin
            if (event.origin !== window.location.origin) return;

            // Handle OAuth callback message
            if (event.data && event.data.type === 'oauth-callback') {
                console.log('Received OAuth callback message from popup:', event.data);
                
                if (event.data.success) {
                    this.showNotification(`Successfully connected to ${event.data.provider}!`, 'success');
                    // Refresh integration status
                    this.updateIntegrationStatus();
                } else {
                    this.showNotification(
                        `Failed to connect: ${event.data.error || 'Unknown error'}`,
                        'error'
                    );
                }
            }
        });

        // Profile menu toggle
        this.elements.profileMenuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleProfileMenu();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#profile-menu-btn') && !e.target.closest('#profile-dropdown')) {
                this.closeProfileMenu();
            }
        });

        // Settings menu items to open full panels
        this.elements.settingsMenuItems?.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                this.openPanel(section);
            });
        });

        // Back buttons to return to dropdown menu
        this.elements.backButtons?.forEach(btn => {
            btn.addEventListener('click', () => {
                this.closePanel();
            });
        });

        this.elements.logoutBtn?.addEventListener('click', () => this.handleLogout());

        this.elements.loginForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        this.elements.signupForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        this.elements.authTabs?.forEach(tab =>
            tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.authTab))
        );

        this.elements.themeOptions?.forEach(option =>
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                this.setTheme(theme);
            })
        );

        this.elements.githubConnectBtn?.addEventListener('click', (e) => this.handleIntegrationClick(e));
        this.elements.googleConnectBtn?.addEventListener('click', (e) => this.handleIntegrationClick(e));
        this.elements.vercelConnectBtn?.addEventListener('click', (e) => this.handleIntegrationClick(e));
        this.elements.supabaseConnectBtn?.addEventListener('click', (e) => this.handleIntegrationClick(e));

        // Google Sign-In event listeners
        this.elements.googleSignInBtn?.addEventListener('click', () => this.handleGoogleSignIn());
        this.elements.googleSignUpBtn?.addEventListener('click', () => this.handleGoogleSignIn());

        supabase.auth.onAuthStateChange((_event, session) => {
            this.updateAuthUI(session?.user);
        });
    }

    setTheme(theme) {
        document.body.classList.remove('light-mode', 'dark-mode');
        document.body.classList.add(`${theme}-mode`);
        // Save theme preference to localStorage
        localStorage.setItem('theme-preference', theme);
        this.updateThemeUI();
    }

    updateThemeUI() {
        const isDark = document.body.classList.contains('dark-mode');
        this.elements.themeOptions.forEach(option => {
            const theme = option.dataset.theme;
            const active = (isDark && theme === 'dark') || (!isDark && theme === 'light');
            option.classList.toggle('active', active);
        });
    }

    toggleProfileMenu() {
        const isOpen = !this.elements.profileDropdown.classList.contains('hidden');
        if (isOpen) {
            this.closeProfileMenu();
        } else {
            this.openProfileMenu();
        }
    }

    openProfileMenu() {
        this.elements.profileDropdown.classList.remove('hidden');
        this.elements.profileMenuBtn.setAttribute('aria-expanded', 'true');

        // Load settings view into dropdown
        if (this.elements.settingsView && !this.elements.profileDropdown.contains(this.elements.settingsView)) {
            this.elements.profileDropdown.appendChild(this.elements.settingsView);
        }

        // Update integration status if user is on account section
        this.updateIntegrationStatus();
    }

    closeProfileMenu() {
        this.elements.profileDropdown.classList.add('hidden');
        this.elements.profileMenuBtn.setAttribute('aria-expanded', 'false');
    }

    openPanel(section) {
        const panel = document.getElementById(`${section}-panel`);
        if (panel) {
            panel.classList.remove('hidden');
            this.closeProfileMenu();

            // Update integration status when opening integrations panel
            if (section === 'integrations') {
                this.updateIntegrationStatus();
            }
        }
    }

    closePanel() {
        this.elements.settingsPanels?.forEach(panel => {
            panel.classList.add('hidden');
        });
        this.openProfileMenu();
    }

    switchAuthTab(tabName) {
        this.elements.authTabs.forEach(tab =>
            tab.classList.toggle('active', tab.dataset.authTab === tabName)
        );
        this.elements.loginForm.classList.toggle('active', tabName === 'login');
        this.elements.signupForm.classList.toggle('active', tabName === 'signup');
    }

    // Legacy methods for backward compatibility
    openSidebar() {
        this.openProfileMenu();
    }

    closeSidebar() {
        this.closeProfileMenu();
        this.elements.settingsPanels?.forEach(panel => {
            panel.classList.add('hidden');
        });
    }

    async handleLogin() {
        const email = this.elements.loginForm.querySelector('#loginEmail').value;
        const password = this.elements.loginForm.querySelector('#loginPassword').value;
        this.elements.loginError.textContent = '';

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            this.elements.loginError.textContent = error.message;
        } else {
            this.showNotification('Logged in successfully!', 'success');
            this.elements.loginForm.reset();
            this.closeProfileMenu();
        }
    }

    async handleSignup() {
        const name = this.elements.signupForm.querySelector('#signupName').value;
        const email = this.elements.signupForm.querySelector('#signupEmail').value;
        const password = this.elements.signupForm.querySelector('#signupPassword').value;
        const confirm = this.elements.signupForm.querySelector('#confirmPassword').value;

        this.elements.signupError.textContent = '';
        if (password !== confirm) {
            this.elements.signupError.textContent = 'Passwords do not match.';
            return;
        }

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } }
        });

        if (error) {
            this.elements.signupError.textContent = error.message;
        } else {
            this.showNotification('Signup successful! Check your email.', 'success');
            this.elements.signupForm.reset();
            this.switchAuthTab('login');
        }
    }

    async handleLogout() {
        if (confirm('Are you sure you want to log out?')) {
            await supabase.auth.signOut();
            this.showNotification('Logged out successfully.', 'success');
        }
    }

    async updateAuthUI(user) {
        const isAuthenticated = !!user;
        this.elements.accountLoggedIn?.classList.toggle('hidden', !isAuthenticated);
        this.elements.accountLoggedOut?.classList.toggle('hidden', isAuthenticated);

        if (isAuthenticated) {
            const userName = user.user_metadata?.name || user.user_metadata?.full_name || 'User';
            const userEmail = user.email;

            // Update profile header card
            if (this.elements.userNameDisplay) {
                this.elements.userNameDisplay.textContent = userName;
            }
            if (this.elements.userEmailDisplay) {
                this.elements.userEmailDisplay.textContent = userEmail;
            }

            // Update profile photo in top bar
            this.updateProfilePhoto(user);

            // Update profile avatar in header card
            this.updateProfileAvatarLarge(user);
        } else {
            // Clear profile photo when logged out
            this.clearProfilePhoto();
            this.clearProfileAvatarLarge();
            this.updateIntegrationStatus(); // safe to clear buttons
        }
    }

    updateProfilePhoto(user) {
        // Get profile photo URL from user metadata
        const photoUrl = user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            user.user_metadata?.photo_url;

        if (photoUrl && this.elements.profilePhoto) {
            this.elements.profilePhoto.src = photoUrl;
            this.elements.profilePhoto.classList.remove('hidden');

            // Add error handler in case image fails to load
            this.elements.profilePhoto.onerror = () => {
                this.clearProfilePhoto();
            };
        } else {
            this.clearProfilePhoto();
        }
    }

    clearProfilePhoto() {
        if (this.elements.profilePhoto) {
            this.elements.profilePhoto.classList.add('hidden');
            this.elements.profilePhoto.src = '';
        }
    }

    updateProfileAvatarLarge(user) {
        // Get profile photo URL from user metadata
        const photoUrl = user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            user.user_metadata?.photo_url;

        const avatarContainer = this.elements.profileAvatarLarge;
        if (!avatarContainer) return;

        // Clear existing content
        avatarContainer.innerHTML = '';

        if (photoUrl) {
            // Create and add image element
            const img = document.createElement('img');
            img.src = photoUrl;
            img.alt = 'Profile Avatar';
            img.onerror = () => {
                // Fallback to icon if image fails to load
                avatarContainer.innerHTML = '<i class="fas fa-user"></i>';
            };
            avatarContainer.appendChild(img);
        } else {
            // Show default icon if no photo URL
            avatarContainer.innerHTML = '<i class="fas fa-user"></i>';
        }
    }

    clearProfileAvatarLarge() {
        const avatarContainer = this.elements.profileAvatarLarge;
        if (avatarContainer) {
            avatarContainer.innerHTML = '<i class="fas fa-user"></i>';
        }
    }

    handleIntegrationClick(event) {
        const button = event.currentTarget;
        const provider = button.dataset.provider;
        const action = button.dataset.action || 'connect';

        if (action === 'connect') {
            this.handleIntegrationConnect(provider);
        } else {
            this.handleIntegrationDisconnect(provider);
        }
    }

    async handleIntegrationConnect(provider) {
        this.showNotification(`Connecting to ${provider}...`, 'info');
        await supabase.auth.refreshSession();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            this.showNotification("You must be logged in to connect an integration.", 'error');
            return;
        }

        try {
            // Build OAuth URL with session token - use Render for OAuth
            const authUrl = `${OAUTH_BACKEND_URL}/login/${provider}?token=${session.access_token}`;

            // Open OAuth popup window
            const authWindow = window.open(
                authUrl,
                `${provider}Auth`,
                'width=600,height=700,scrollbars=yes,resizable=yes'
            );

            if (!authWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }

            // Monitor popup for completion
            const checkInterval = setInterval(() => {
                try {
                    // Check if popup was closed
                    if (authWindow.closed) {
                        clearInterval(checkInterval);
                        console.log('OAuth popup closed');
                    }
                } catch (e) {
                    // Cross-origin errors are expected
                }
            }, 500);

            // Timeout after 5 minutes
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!authWindow.closed) {
                    authWindow.close();
                    this.showNotification('OAuth timeout. Please try again.', 'error');
                }
            }, 300000);

        } catch (error) {
            console.error('Integration connection error:', error);
            this.showNotification(`Error connecting to ${provider}: ${error.message}`, 'error');
        }
    }

    async handleIntegrationDisconnect(provider) {
        if (!confirm(`Are you sure you want to disconnect your ${provider} account?`)) return;

        await supabase.auth.refreshSession();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            this.showNotification("Session expired. Please log in again.", 'error');
            return;
        }

        try {
            const response = await fetch(`${API_BACKEND_URL}/api/integrations/disconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ service: provider })
            });

            if (!response.ok) throw new Error('Failed to disconnect.');
            this.showNotification(`Successfully disconnected from ${provider}.`, 'success');
            this.updateIntegrationStatus();
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    async updateIntegrationStatus() {
        await supabase.auth.refreshSession();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            // Clear all integration buttons when not logged in
            this.updateButtonUI(this.elements.githubConnectBtn, false);
            this.updateButtonUI(this.elements.googleConnectBtn, false);
            this.updateButtonUI(this.elements.vercelConnectBtn, false);
            this.updateButtonUI(this.elements.supabaseConnectBtn, false);
            return;
        }

        try {
            const response = await fetch(`${API_BACKEND_URL}/api/integrations`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) {
                console.error("Failed to fetch integration status:", response.statusText);
                return;
            }

            const { integrations } = await response.json();

            // Update all integration buttons
            this.updateButtonUI(this.elements.githubConnectBtn, integrations.includes('github'));
            this.updateButtonUI(this.elements.googleConnectBtn, integrations.includes('google'));
            this.updateButtonUI(this.elements.vercelConnectBtn, integrations.includes('vercel'));
            this.updateButtonUI(this.elements.supabaseConnectBtn, integrations.includes('supabase'));

        } catch (error) {
            console.error("Error fetching integration status:", error);
            // Don't show error to user, just log it
        }
    }

    updateButtonUI(button, isConnected) {
        if (!button) return;
        const textSpan = button.querySelector('.btn-text');
        const connectIcon = button.querySelector('.icon-connect');
        const connectedIcon = button.querySelector('.icon-connected');

        if (isConnected) {
            button.dataset.action = 'disconnect';
            textSpan.textContent = 'Disconnect';
            connectIcon.style.display = 'none';
            connectedIcon.style.display = 'inline';
            button.classList.add('connected');
        } else {
            button.dataset.action = 'connect';
            textSpan.textContent = 'Connect';
            connectIcon.style.display = 'inline';
            connectedIcon.style.display = 'none';
            button.classList.remove('connected');
        }
    }

    showNotification(message, type = 'success', duration = 4000) {
        if (this.notificationService) {
            return this.notificationService.show(message, type, duration);
        }
    }

    /**
     * Handle Google Sign-In using Supabase OAuth
     */
    async handleGoogleSignIn() {
        this.elements.loginError.textContent = '';
        this.elements.signupError.textContent = '';

        try {
            // Get current URL for redirect
            const redirectUrl = `${window.location.origin}${window.location.pathname}`;

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });

            if (error) {
                console.error('Google Sign-In error:', error);
                const errorMsg = 'Failed to initiate Google Sign-In. Please try again.';
                this.elements.loginError.textContent = errorMsg;
                this.elements.signupError.textContent = errorMsg;
                this.showNotification(errorMsg, 'error');
            }
            // The browser will redirect to Google's OAuth page automatically
            // After authentication, Google will redirect back to our app
        } catch (error) {
            console.error('Unexpected error during Google Sign-In:', error);
            const errorMsg = 'An unexpected error occurred. Please try again.';
            this.elements.loginError.textContent = errorMsg;
            this.elements.signupError.textContent = errorMsg;
            this.showNotification(errorMsg, 'error');
        }
    }

    /**
     * Handle OAuth callback when user is redirected back from Google
     */
    async handleOAuthCallback() {
        try {
            // Check if we have OAuth parameters in the URL
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const searchParams = new URLSearchParams(window.location.search);

            // Supabase returns tokens in hash for implicit flow or in search for PKCE flow
            const hasOAuthParams = hashParams.has('access_token') ||
                searchParams.has('code') ||
                hashParams.has('error') ||
                searchParams.has('error');

            if (hasOAuthParams) {
                // Check for errors first
                const error = hashParams.get('error') || searchParams.get('error');
                const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

                if (error) {
                    console.error('OAuth error:', error, errorDescription);
                    this.showNotification(
                        `Sign-in failed: ${errorDescription || error}`,
                        'error'
                    );
                    // Clean up URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }

                // Let Supabase handle the OAuth callback automatically
                // It will parse the tokens from the URL and set the session
                const { data, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('Error getting session after OAuth:', sessionError);
                    this.showNotification('Failed to complete sign-in. Please try again.', 'error');
                } else if (data.session) {
                    console.log('OAuth callback successful, user signed in:', data.session.user);
                    this.showNotification('Successfully signed in with Google!', 'success');

                    // Close the profile menu after successful login
                    setTimeout(() => {
                        this.closeProfileMenu();
                    }, 1500);
                }

                // Clean up URL to remove OAuth parameters
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error('Error handling OAuth callback:', error);
        }
    }

    /**
     * Handle integration OAuth callback (GitHub, Google integrations, etc.)
     * This is called when the OAuth popup redirects back with auth_success or auth_error
     */
    handleIntegrationOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authSuccess = urlParams.get('auth_success');
        const authError = urlParams.get('auth_error');
        const provider = urlParams.get('provider');
        const message = urlParams.get('message');

        // Check if this is an OAuth callback in a popup window
        if (authSuccess === 'true' || authError === 'true') {
            // If we're in a popup (opened by window.open), notify the parent and close
            if (window.opener && !window.opener.closed) {
                console.log('OAuth callback detected in popup, notifying parent window');
                
                // Send message to parent window
                window.opener.postMessage({
                    type: 'oauth-callback',
                    success: authSuccess === 'true',
                    provider: provider,
                    error: authError === 'true' ? message : null
                }, window.location.origin);

                // Close the popup after a short delay
                setTimeout(() => {
                    window.close();
                }, 500);
            } else {
                // If not in a popup, just show notification and clean URL
                if (authSuccess === 'true') {
                    this.showNotification(`Successfully connected to ${provider}!`, 'success');
                    this.updateIntegrationStatus();
                } else if (authError === 'true') {
                    this.showNotification(`Failed to connect: ${message || 'Unknown error'}`, 'error');
                }

                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }
}