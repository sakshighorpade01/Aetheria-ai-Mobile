import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

class AuthService {
    constructor() {
        // Initialize with empty values - will be set in init()
        this.supabase = null;
        this.user = null;
        this.listeners = [];
    }

    async init() {
        try {
            // Create Supabase client
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.anonKey
            );
            
            // Check for existing session
            const { data } = await this.supabase.auth.getSession();
            if (data.session) {
                this.user = data.session.user;
                console.log('User from session:', this.user);
                this._notifyListeners();
            }
            
            // Set up auth state change listener
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

    // Add listener for auth state changes
    onAuthChange(callback) {
        this.listeners.push(callback);
        // Immediately notify with current state
        if (callback && typeof callback === 'function') {
            callback(this.user);
        }
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }

    // Notify all listeners of auth state change
    _notifyListeners() {
        this.listeners.forEach(listener => {
            if (listener && typeof listener === 'function') {
                listener(this.user);
            }
        });
    }

    // Sign up with email, password, and name
    async signUp(email, password, name) {
        console.log('Auth service received signup parameters:', {
            email: email,
            password: password ? '[REDACTED]' : undefined,
            name: name,
            nameType: typeof name
        });
        
        console.log('Signup call stack:', new Error().stack);
        
        const processedName = typeof name === 'string' ? name.trim() : '';
        console.log('Processed name:', processedName);
        
        try {
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
                console.error('Signup error:', error);
                return { success: false, error: error.message };
            }
            
            console.log('Signup response:', data);
            console.log('User metadata after signup:', data.user?.user_metadata);
            
            if (data.user) {
                if (!data.user.user_metadata?.name && processedName) {
                    console.log('Name not found in user_metadata, updating it manually');
                    try {
                        const { data: updateData, error: updateError } = await this.supabase.auth.updateUser({
                            data: { name: processedName }
                        });
                        
                        if (updateError) {
                            console.error('Error updating user metadata:', updateError);
                        } else {
                            console.log('User metadata updated successfully:', updateData.user.user_metadata);
                            data.user.user_metadata = updateData.user.user_metadata;
                        }
                    } catch (updateError) {
                        console.error('Failed to update user metadata:', updateError);
                    }
                }
                
                try {
                    const { error: profileError } = await this.supabase
                        .from('profiles')
                        .upsert({
                            id: data.user.id,
                            email: email,
                            name: processedName,
                            updated_at: new Date().toISOString()
                        });
                        
                    if (profileError) {
                        console.error('Error updating profile:', profileError);
                    } else {
                        console.log('Profile updated successfully');
                    }
                } catch (profileError) {
                    console.error('Failed to update profile:', profileError);
                }
            }
            
            return { success: true, data };
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, error: error.message };
        }
    }

    // Sign in with email and password
    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            console.log('Sign in response:', data);
            console.log('User metadata after signin:', data.user?.user_metadata);
            
            if (data.user) {
                if (data.user.user_metadata?.name) {
                    console.log('Name found in user_metadata:', data.user.user_metadata.name);
                    this.user = data.user;
                    this._notifyListeners();
                } else {
                    try {
                        console.log('Name not found in user_metadata, fetching from profiles table');
                        const { data: profileData, error: profileError } = await this.supabase
                            .from('profiles')
                            .select('name')
                            .eq('id', data.user.id)
                            .single();
                            
                        if (profileError) {
                            console.error('Error fetching profile:', profileError);
                        } else if (profileData && profileData.name) {
                            console.log('Name found in profiles table:', profileData.name);
                            data.user.user_metadata = data.user.user_metadata || {};
                            data.user.user_metadata.name = profileData.name;
                            this.user = data.user;
                            this._notifyListeners();
                        } else {
                            console.log('Name not found in profiles table either');
                        }
                    } catch (profileFetchError) {
                        console.error('Failed to fetch profile:', profileFetchError);
                    }
                }
            }
            
            return { success: true, data };
        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, error: error.message };
        }
    }

    // Sign out
    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get current user
    getCurrentUser() {
        return this.user;
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.user;
    }

    // --- ADDED THIS METHOD ---
    // Get the full session object, including the access token
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

// Create singleton instance
export const authService = new AuthService();