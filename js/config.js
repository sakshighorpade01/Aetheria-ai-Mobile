/**
 * Configuration for the AI-OS application
 */
const config = {
    // Backend connection settings
    backend: {
        // URL for the Python backend running in Docker
        url: 'http://localhost:8765',
        
        // Maximum number of reconnection attempts
        maxReconnectAttempts: 50,
        
        // Delay between reconnection attempts (in milliseconds)
        reconnectDelay: 20000,
        
        // Connection timeout (in milliseconds)
        connectionTimeout: 20000
    },
    
    // Supabase configuration
    supabase: {
        // Supabase project URL
        url: 'https://vpluyoknbywuhahcnlfx.supabase.co',
        
        // Supabase anonymous key
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbHV5b2tuYnl3dWhhaGNubGZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjMwMDEsImV4cCI6MjA2MjYzOTAwMX0.7o8ICrbVdndxi_gLafKf9aqyDgkqNrisZvrJT3XEUfA'
    }
};

module.exports = config; 