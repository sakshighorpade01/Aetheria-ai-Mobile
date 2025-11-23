// js/supabase-client.js

const SUPABASE_URL = 'https://ilprcrqemdiilbtaqelm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscHJjcnFlbWRpaWxidGFxZWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjMwMDEsImV4cCI6MjA2MjYzOTAwMX0.7o8ICrbVdndxi_gLafKf9aqyDgkqNrisZvrJT3XEUfA';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
  },
});