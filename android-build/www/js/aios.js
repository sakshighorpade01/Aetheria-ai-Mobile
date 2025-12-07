// js/aios.js

import { supabase } from './supabase-client.js';

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168');
// This BACKEND_URL is for the popup window, NOT for the initial fetch.
const BACKEND_URL = 'https://aios-web-production-39ef.up.railway.app';

export class AIOS {
    constructor() {
        this.initialized = false;
        this.currentTab = 'profile';
        this.elements = {};
    }

    async init() {
        if (this.initialized) return;

        this.cacheElements();
        this.setupEventListeners();
        this.updateThemeUI();

        await this.updateAuthUI();
        this.initialized = true;
    }

    cacheElements() {
        this.elements = {
            sidebar: document.getElementById('sidebar-container'),
            overlay: document.getElementById('sidebar-overlay'),
            settingsView: document.getElementById('settings-view'),
            closeBtn: document.getElementById('close-aios'),

            tabs: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),

            logoutBtn: document.getElementById('logout-btn'),
            userEmail: document.getElementById('userEmail'),
            userName: document.getElementById('userName'),
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
        };
    }

    setupEventListeners() {
        this.elements.closeBtn?.addEventListener('click', () => this.closeSidebar());
        this.elements.overlay?.addEventListener('click', () => this.closeSidebar());

        this.elements.tabs?.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
                if (tab.dataset.tab === 'account') {
                    this.updateIntegrationStatus();
                }
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
    }

    switchTab(tabName) {
        this.elements.tabs.forEach(tab =>
            tab.classList.toggle('active', tab.dataset.tab === tabName)
        );
        this.elements.tabContents.forEach(content =>
            content.classList.toggle('active', content.id === `${tabName}-tab`)
        );
    }

    switchAuthTab(tabName) {
        this.elements.authTabs.forEach(tab =>
            tab.classList.toggle('active', tab.dataset.authTab === tabName)
        );
        this.elements.loginForm.classList.toggle('active', tabName === 'login');
        this.elements.signupForm.classList.toggle('active', tabName === 'signup');
    }

    openSidebar() {
        this.elements.sidebar?.classList.add('open');
        this.elements.overlay?.classList.add('open');

        const activeTab = this.elements.tabs ? [...this.elements.tabs].find(t => t.classList.contains('active')) : null;
        if (activeTab?.dataset.tab === 'account') {
            this.updateIntegrationStatus();
        }
    }

    closeSidebar() {
        this.elements.sidebar?.classList.remove('open');
        this.elements.overlay?.classList.remove('open');
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
            this.closeSidebar();
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
            this.elements.userEmail.textContent = user.email;
            this.elements.userName.textContent = user.user_metadata?.name || 'User';
        } else {
            this.updateIntegrationStatus(); // safe to clear buttons
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
        const proxyLoginUrl = `/login/${provider}?token=${session.access_token}`;

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
            const response = await fetch(`/api/integrations/disconnect`, {
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
            return;
        }

        try {
            // Use a relative path here to leverage the proxy
            const response = await fetch(`/api/integrations`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) {
                console.error("Failed to fetch integration status:", response.statusText);
                return;
            }

            const { integrations } = await response.json();
            this.updateButtonUI(this.elements.githubConnectBtn, integrations.includes('github'));
            this.updateButtonUI(this.elements.googleConnectBtn, integrations.includes('google'));
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

    showNotification(message, type = 'success') {
        const container = document.querySelector('.notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        container.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateY(0)';
            notification.style.opacity = '1';
        }, 10);

        setTimeout(() => {
            notification.style.transform = 'translateY(20px)';
            notification.style.opacity = '0';
            notification.addEventListener('transitionend', () => notification.remove());
        }, 3000);
    }
}