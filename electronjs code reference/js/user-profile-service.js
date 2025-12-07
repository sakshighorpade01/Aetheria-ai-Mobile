// js/user-profile-service.js (Complete, Validated Version)

/**
 * UserProfileService - Centralized service for retrieving user profile information
 * Implements a fallback chain: AIOS Data → Auth Service → System Username → "there"
 */
class UserProfileService {
    constructor() {
        this.cachedUserName = null;
        this.cacheTimestamp = null;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get user name with comprehensive fallback chain
     * @returns {Promise<string>} The user's name or fallback
     */
    async getUserName() {
        // Return cached name if still valid
        if (this.cachedUserName && this.isCacheValid()) {
            return this.cachedUserName;
        }

        let userName = null;

        try {
            // First attempt: Get from AIOS user data
            userName = await this.getNameFromAiosData();
            if (userName) {
                console.log('UserProfileService: Retrieved name from AIOS data:', userName);
                return this.cacheAndReturn(userName);
            }
        } catch (error)
        {
            console.warn('UserProfileService: Failed to get name from AIOS data:', error);
        }

        try {
            // Second attempt: Get from authentication service
            userName = await this.getNameFromAuth();
            if (userName) {
                console.log('UserProfileService: Retrieved name from auth service:', userName);
                return this.cacheAndReturn(userName);
            }
        } catch (error) {
            console.warn('UserProfileService: Failed to get name from auth:', error);
        }

        try {
            // Third attempt: Get system username
            userName = await this.getSystemUsername();
            if (userName) {
                console.log('UserProfileService: Retrieved system username:', userName);
                return this.cacheAndReturn(userName);
            }
        } catch (error) {
            console.warn('UserProfileService: Failed to get system username:', error);
        }

        // Final fallback
        console.log('UserProfileService: Using final fallback "there"');
        return this.cacheAndReturn('there');
    }

    /**
     * Get name from AIOS user data
     * @returns {Promise<string|null>} User name or null
     */
    async getNameFromAiosData() {
        try {
            if (!window.AIOS || !window.AIOS.userData) {
                return null;
            }
            const userData = window.AIOS.userData;
            if (userData.account?.name?.trim() && userData.account.name !== 'User Name') {
                return userData.account.name.trim();
            }
            return null;
        } catch (error) {
            console.error('Error getting name from AIOS data:', error);
            return null;
        }
    }

    /**
     * Get name from authentication service
     * @returns {Promise<string|null>} Auth service name or null
     */
    async getNameFromAuth() {
        try {
            if (!window.electron?.auth) {
                return null;
            }
            const authService = window.electron.auth;
            const currentUser = authService.getCurrentUser();
            if (!currentUser) {
                return null;
            }

            // Try user metadata name first (most reliable)
            if (currentUser.user_metadata?.name?.trim()) {
                return currentUser.user_metadata.name.trim();
            }
            if (currentUser.user_metadata?.full_name?.trim()) {
                return currentUser.user_metadata.full_name.trim();
            }

            // Try extracting name from email as a fallback
            if (currentUser.email?.trim()) {
                const emailName = currentUser.email.split('@')[0];
                if (emailName && emailName.length > 0) {
                    return emailName.replace(/[._-]/g, ' ').trim();
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting name from auth:', error);
            return null;
        }
    }

    /**
     * Get system username as fallback
     * @returns {Promise<string|null>} System username or null
     */
    async getSystemUsername() {
        try {
            if (window.electron?.os?.userInfo) {
                const userInfo = await window.electron.os.userInfo();
                if (userInfo?.username?.trim()) {
                    return userInfo.username.trim();
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting system username:', error);
            return null;
        }
    }

    /**
     * Format name for display (capitalize first letter)
     * @param {string} name - Raw name
     * @returns {string} Formatted name
     */
    formatNameForDisplay(name) {
        if (!name || typeof name !== 'string') {
            return 'there';
        }
        const trimmed = name.trim();
        if (trimmed.length === 0) {
            return 'there';
        }
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }

    /**
     * Cache the retrieved name and return it formatted
     * @param {string} name - Name to cache
     * @returns {string} Formatted name
     */
    cacheAndReturn(name) {
        this.cachedUserName = name;
        this.cacheTimestamp = Date.now();
        return this.formatNameForDisplay(name);
    }

    /**
     * Check if cached name is still valid
     * @returns {boolean} True if cache is valid
     */
    isCacheValid() {
        return this.cacheTimestamp && (Date.now() - this.cacheTimestamp) < this.cacheExpiry;
    }

    /**
     * Clear cached name (useful for when profile changes)
     */
    clearCache() {
        this.cachedUserName = null;
        this.cacheTimestamp = null;
    }
}

// Export for use in other modules
export default UserProfileService;