// js/aios.js

import { supabase } from './supabase-client.js';
import NotificationService from './notification-service.js';

// Backend URL for OAuth integrations and API calls - using deployed Render backend
const BACKEND_URL = 'https://aios-web.onrender.com';

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
        this.updateThemeUI();

        // Handle OAuth callback on page load
        await this.handleOAuthCallback();
        
        // Get current user and update UI
        const { data: { user } } = await supabase.auth.getUser();
        await this.updateAuthUI(user);
        
        this.initialized = true;
    }

    cacheElements() {
        this.elements = {
            profileMenuBtn: document.getElementById('profile-menu-btn'),
            profileDropdown: document.getElementById('profile-dropdown'),
            settingsView: document.getElementById('settings-view'),
            profilePhoto: document.getElementById('profile-photo'),
            profileIconDefault: document.getElementById('profile-icon-default'),
            
            // New profile header elements
            profileHeader: document.getElementById('profile-header'),
            profileAvatar: document.getElementById('profile-avatar'),
            profileAvatarFallback: document.getElementById('profile-avatar-fallback'),
            profileName: document.getElementById('profile-name'),
            profileEmail: document.getElementById('profile-email'),

            // Login prompt
            loginPrompt: document.getElementById('login-prompt'),
            openAuthModalBtn: document.getElementById('open-auth-modal-btn'),

            // Auth modal
            authModal: document.getElementById('auth-modal'),
            closeAuthModalBtn: document.querySelector('.close-auth-modal-btn'),

            // Account menu section
            accountMenuSection: document.getElementById('account-menu-section'),
            logoutSection: document.getElementById('logout-section'),
            
            // Legacy account section elements (for backward compatibility)
            accountLoggedOut: document.getElementById('account-logged-out'),
            accountLoggedIn: document.getElementById('account-logged-in'),
            userName: document.getElementById('userName'),
            userEmail: document.getElementById('userEmail'),

            settingsMenuItems: document.querySelectorAll('.settings-menu-item'),
            settingsPanels: document.querySelectorAll('.settings-full-panel'),
            backButtons: document.querySelectorAll('.back-to-menu-btn'),

            logoutBtn: document.getElementById('logout-btn'),

            authTabs: document.querySelectorAll('.auth-tab-btn'),
            loginForm: document.getElementById('login-form'),
            signupForm: document.getElementById('signup-form'),
            loginError: document.getElementById('login-error'),
            signupError: document.getElementById('signup-error'),

            themeOptions: document.querySelectorAll('.theme-option'),
            themeStatus: document.getElementById('theme-status'),
            integrationsStatus: document.getElementById('integrations-status'),

            githubConnectBtn: document.getElementById('connect-github-btn'),
            googleConnectBtn: document.getElementById('connect-google-btn'),
            
            // Google Sign-In Buttons
            googleSignInBtn: document.getElementById('google-signin-btn'),
            googleSignUpBtn: document.getElementById('google-signup-btn'),
        };
    }

    setupEventListeners() {
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
        
        // Open auth modal
        this.elements.openAuthModalBtn?.addEventListener('click', () => {
            this.closeProfileMenu();
            this.openAuthModal();
        });
        
        // Close auth modal
        this.elements.closeAuthModalBtn?.addEventListener('click', () => {
            this.closeAuthModal();
        });
        
        // Close modal on backdrop click
        this.elements.authModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.authModal) {
                this.closeAuthModal();
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
        this.updateThemeUI();
    }

    updateThemeUI() {
        const isDark = document.body.classList.contains('dark-mode');
        this.elements.themeOptions.forEach(option => {
            const theme = option.dataset.theme;
            const active = (isDark && theme === 'dark') || (!isDark && theme === 'light');
            option.classList.toggle('active', active);
        });
        
        // Update theme status text and icon
        if (this.elements.themeStatus) {
            this.elements.themeStatus.textContent = isDark ? 'Dark mode' : 'Light mode';
        }
        
        // Update theme icon
        const themeIcon = document.querySelector('.theme-icon i');
        if (themeIcon) {
            themeIcon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
    
    openAuthModal() {
        this.elements.authModal?.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    closeAuthModal() {
        this.elements.authModal?.classList.add('hidden');
        document.body.style.overflow = '';
        // Clear any errors
        if (this.elements.loginError) this.elements.loginError.textContent = '';
        if (this.elements.signupError) this.elements.signupError.textContent = '';
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
            this.closeAuthModal();
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
        
        // Toggle profile header and login prompt (new UI)
        this.elements.profileHeader?.classList.toggle('hidden', !isAuthenticated);
        this.elements.loginPrompt?.classList.toggle('hidden', isAuthenticated);

        // Toggle legacy account sections (dropdown forms)
        this.elements.accountLoggedOut?.classList.toggle('hidden', isAuthenticated);
        this.elements.accountLoggedIn?.classList.toggle('hidden', !isAuthenticated);

        // Toggle account menu sections (new UI)
        this.elements.accountMenuSection?.classList.toggle('hidden', !isAuthenticated);
        this.elements.logoutSection?.classList.toggle('hidden', !isAuthenticated);

        if (isAuthenticated) {
            const userName = user.user_metadata?.name || user.user_metadata?.full_name || 'User';
            const userEmail = user.email;
            
            // Update profile header
            const profileNameEl = this.elements.profileName || this.elements.userName;
            if (profileNameEl) {
                profileNameEl.textContent = userName;
            }

            const profileEmailEl = this.elements.profileEmail || this.elements.userEmail;
            if (profileEmailEl) {
                profileEmailEl.textContent = userEmail;
            }

            // Update profile avatar
            this.updateProfileAvatar(user);

            // Update top bar profile photo
            this.updateProfilePhoto(user);
            
            // Update integration status
            this.updateIntegrationStatus();
        } else {
            // Clear profile photo when logged out
            this.clearProfilePhoto();
            this.clearProfileAvatar();
        }
    }
    
    updateProfileAvatar(user) {
        const photoUrl = user.user_metadata?.avatar_url || 
                        user.user_metadata?.picture || 
                        user.user_metadata?.photo_url;
        
        if (photoUrl && this.elements.profileAvatar) {
            this.elements.profileAvatar.src = photoUrl;
            this.elements.profileAvatar.classList.remove('hidden');
            
            // Add error handler in case image fails to load
            this.elements.profileAvatar.onerror = () => {
                this.clearProfileAvatar();
            };
        } else {
            this.clearProfileAvatar();
        }
    }
    
    clearProfileAvatar() {
        if (this.elements.profileAvatar) {
            this.elements.profileAvatar.classList.add('hidden');
            this.elements.profileAvatar.src = '';
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

        // --- START OF THE FIX ---

        // URL for the initial fetch request. This is a RELATIVE path.
        // It will be proxied by Vercel as defined in vercel.json.
        // This makes it a same-origin request from the browser's perspective.
        const proxyLoginUrl = `${BACKEND_URL}/login/${provider}?token=${session.access_token}`;

        // URL for the popup window. This is the ABSOLUTE path to the backend.
        // The popup needs to navigate to the actual Render domain.
        const absoluteLoginUrl = `${BACKEND_URL}/login/${provider}?token=${session.access_token}`;

        try {
            // Step 1: Make a background request to the PROXY URL.
            // `redirect: 'manual'` prevents the browser from following the redirect.
            // Its only job is to get the session cookie from the backend.
            const response = await fetch(proxyLoginUrl, {
                method: 'GET',
                redirect: 'manual'
            });

            // Step 2: Check if the backend is trying to redirect us.
            // This is the expected successful outcome.
            if (response.type === 'opaqueredirect') {
                // The cookie is now set for the backend domain.
                // We can now safely open the auth window using the ABSOLUTE URL.
                window.open(absoluteLoginUrl, 'authWindow', 'width=600,height=700,scrollbars=yes');
            } else {
                // If we get here, the backend returned an error instead of a redirect.
                const errorText = await response.text();
                throw new Error(`Failed to initiate login. Server responded with: ${errorText}`);
            }
            // --- END OF THE FIX ---

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
            alert("Session expired. Please log in again.");
            return;
        }

        try {
            // Use a relative path here as well to leverage the proxy
            const response = await fetch(`${BACKEND_URL}/api/integrations/disconnect`, {
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
            this.updateButtonUI(this.elements.githubConnectBtn, false);
            this.updateButtonUI(this.elements.googleConnectBtn, false);
            if (this.elements.integrationsStatus) {
                this.elements.integrationsStatus.textContent = 'Connect external services';
            }
            return;
        }

        try {
            // Use a relative path here to leverage the proxy
            const response = await fetch(`${BACKEND_URL}/api/integrations`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) {
                console.error("Failed to fetch integration status:", response.statusText);
                return;
            }

            const { integrations } = await response.json();
            this.updateButtonUI(this.elements.githubConnectBtn, integrations.includes('github'));
            this.updateButtonUI(this.elements.googleConnectBtn, integrations.includes('google'));
            
            // Update integrations status subtitle
            if (this.elements.integrationsStatus) {
                const count = integrations.length;
                if (count === 0) {
                    this.elements.integrationsStatus.textContent = 'Connect external services';
                } else {
                    this.elements.integrationsStatus.textContent = `${count} service${count > 1 ? 's' : ''} connected`;
                }
            }
        } catch (error) {
            console.error("Error fetching integration status:", error);
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
                    
                    // Close the auth modal and profile menu after successful login
                    setTimeout(() => {
                        this.closeAuthModal();
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
}