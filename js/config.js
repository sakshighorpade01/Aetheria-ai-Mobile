/**
 * Configuration for the AI-OS application
 */
export const config = {
    // Backend connection settings
    backend: {
        // URL for the Python backend - Production
        url: 'https://aios-web-production.up.railway.app',
        
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
        url: 'https://ilprcrqemdiilbtaqelm.supabase.co',
        
        // Supabase anonymous key
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscHJjcnFlbWRpaWxidGFxZWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjMwMDEsImV4cCI6MjA2MjYzOTAwMX0.7o8ICrbVdndxi_gLafKf9aqyDgkqNrisZvrJT3XEUfA'
    }
}; 