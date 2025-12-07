// auth-service.js (Complete, with the new setSession method)

const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

class AuthService {
    constructor() {
        this.supabase = null;
        this.user = null;
        this.listeners = [];
    }

    async init() {
        try {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.anonKey
            );
            
            const { data } = await this.supabase.auth.getSession();
            if (data.session) {
                this.user = data.session.user;
                this._notifyListeners();
            }
            
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed:', event);
                this.user = session?.user || null;
                if (this.user) {
                    console.log('User metadata:', this.user.user_metadata);
                }
                this._notifyListeners();
            });
            
            return true;
        } catch (error) {
            console.error('Failed to initialize auth service:', error);
            return false;
        }
    }

    onAuthChange(callback) {
        this.listeners.push(callback);
        if (callback && typeof callback === 'function') {
            callback(this.user);
        }
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }

    _notifyListeners() {
        this.listeners.forEach(listener => {
            if (listener && typeof listener === 'function') {
                listener(this.user);
            }
        });
    }

    async signUp(email, password, name) {
        try {
            const processedName = typeof name === 'string' ? name.trim() : '';
            const { data, error } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        name: processedName
                    }
                }
            });
        
            if (error) {
                return { success: false, error: error.message };
            }
        
            // Profile is now automatically created by database trigger
            // No need to manually insert into profiles table
            
            return { success: true, data };
        
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            if (data.user) {
                if (!data.user.user_metadata?.name) {
                    try {
                        const { data: profileData, error: profileError } = await this.supabase
                            .from('profiles')
                            .select('name')
                            .eq('id', data.user.id)
                            .single();
                            
                        if (profileData && profileData.name) {
                            data.user.user_metadata = data.user.user_metadata || {};
                            data.user.user_metadata.name = profileData.name;
                            this.user = data.user;
                            this._notifyListeners();
                        }
                    } catch (profileFetchError) {
                        console.error('Failed to fetch profile during sign-in:', profileFetchError);
                    }
                }
            }
            
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async signInWithGoogle() {
        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: 'aios://auth-callback'
                }
            });

            if (error) {
                throw error;
            }

            return { success: true, url: data.url };
        } catch (error) {
            console.error('Google Sign-In URL generation error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fetch session titles only (lightweight) for displaying the session list
     * This is optimized to fetch only metadata without heavy runs data
     */
    async fetchSessionTitles(limit = 15, offset = 0) {
        if (!this.supabase) {
            throw new Error('Supabase client not initialized.');
        }

        const session = await this.getSession();
        const userId = this.user?.id || session?.user?.id;

        if (!userId) {
            throw new Error('User not authenticated.');
        }

        // First, try to fetch from session_titles table (has proper sorting by session_created_at)
        const { data: titlesData, error: titlesError } = await this.supabase
            .from('session_titles')
            .select('session_id, tittle, created_at, session_created_at')
            .eq('user_id', userId)
            .order('session_created_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (titlesError) {
            console.error('Error fetching session titles:', titlesError);
            throw new Error(titlesError.message || 'Failed to fetch session titles.');
        }

        // Get session IDs that have titles
        const sessionIdsWithTitles = new Set((titlesData || []).map(t => t.session_id));

        // Calculate remaining slots for sessions without titles
        const remainingSlots = limit - (titlesData?.length || 0);

        let sessionsWithoutTitles = [];
        if (remainingSlots > 0) {
            // Fetch sessions from agno_sessions that don't have titles yet
            // Only fetch metadata (exclude heavy runs field)
            const { data, error: sessionsError } = await this.supabase
                .from('agno_sessions')
                .select('session_id, user_id, created_at, session_type')
                .eq('user_id', userId)
                .not('session_id', 'in', `(${Array.from(sessionIdsWithTitles).join(',')})`)
                .order('created_at', { ascending: false })
                .range(0, remainingSlots - 1);

            if (sessionsError) {
                console.error('Error fetching sessions without titles:', sessionsError);
            } else {
                sessionsWithoutTitles = data || [];
            }
        }

        // Combine both sources
        const allSessions = [
            ...(titlesData || []).map(t => ({
                session_id: t.session_id,
                session_title: t.tittle,
                created_at: t.session_created_at || t.created_at,
                has_title: true
            })),
            ...(sessionsWithoutTitles || []).map(s => ({
                session_id: s.session_id,
                session_title: null,
                created_at: s.created_at,
                has_title: false
            }))
        ];

        // Sort by created_at (most recent first)
        allSessions.sort((a, b) => b.created_at - a.created_at);
        
        // PHASE 3: Check which sessions have attachments
        if (allSessions.length > 0) {
            const sessionIds = allSessions.map(s => s.session_id);
            const { data: attachmentData, error: attachmentError } = await this.supabase
                .from('attachment')
                .select('session_id')
                .in('session_id', sessionIds)
                .eq('user_id', userId);

            if (!attachmentError && attachmentData) {
                const sessionsWithAttachments = new Set(attachmentData.map(a => a.session_id));
                allSessions.forEach(session => {
                    session.has_attachments = sessionsWithAttachments.has(session.session_id);
                });
            }
        }
        
        return allSessions;
    }

    /**
     * Fetch attachment metadata for a specific session
     * @param {string} sessionId - Session ID to fetch attachments for
     * @returns {Promise<Array>} Array of attachment metadata objects
     */
    async fetchSessionAttachments(sessionId) {
        if (!this.supabase) {
            throw new Error('Supabase client not initialized.');
        }

        const session = await this.getSession();
        const userId = this.user?.id || session?.user?.id;

        if (!userId) {
            throw new Error('User not authenticated.');
        }

        const { data, error } = await this.supabase
            .from('attachment')
            .select('metadata')
            .eq('session_id', sessionId)
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching session attachments:', error);
            throw new Error(error.message || 'Failed to fetch attachments.');
        }

        return (data || []).map(row => row.metadata);
    }

    /**
     * Fetch full session data including runs for a specific session
     * This is called when user clicks on a session to view details
     */
    async fetchSessionData(sessionId) {
        if (!this.supabase) {
            throw new Error('Supabase client not initialized.');
        }

        const session = await this.getSession();
        const userId = this.user?.id || session?.user?.id;

        if (!userId) {
            throw new Error('User not authenticated.');
        }

        // Fetch full session data including runs
        const { data: sessionData, error } = await this.supabase
            .from('agno_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .eq('user_id', userId)
            .single();

        if (error) {
            throw new Error(error.message || 'Failed to fetch session data.');
        }

        // Try to get title from session_titles table
        const { data: titleData } = await this.supabase
            .from('session_titles')
            .select('tittle')
            .eq('session_id', sessionId)
            .eq('user_id', userId)
            .single();

        return {
            ...sessionData,
            session_title: titleData?.tittle || null
        };
    }

    /**
     * Legacy method - kept for backward compatibility
     * Now uses the optimized fetchSessionTitles internally
     */
    async fetchUserSessions(limit = 15) {
        return await this.fetchSessionTitles(limit);
    }

    async setSession(accessToken, refreshToken) {
        try {
            const { data, error } = await this.supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            if (error) {
                console.error('Error setting session in auth service:', error);
                return { success: false, error: error.message };
            }

            // The onAuthStateChange listener will now fire with the correct user data
            // and the state will be a persistent SIGNED_IN.
            console.log('Session successfully set in auth service.');
            return { success: true, data };
        } catch (error) {
            console.error('Catch block error setting session:', error);
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getCurrentUser() {
        return this.user;
    }

    isAuthenticated() {
        return !!this.user;
    }

    async getSession() {
        try {
            const { data, error } = await this.supabase.auth.getSession();
            if (error) {
                console.error('Error getting session:', error.message);
                return null;
            }
            return data.session;
        } catch (error) {
            console.error('Failed to get session:', error.message);
            return null;
        }
    }
}

const authService = new AuthService();
module.exports = authService;