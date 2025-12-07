// js/supabase-client.js

const SUPABASE_URL = 'https://ilprcrqemdiilbtaqelm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscHJjcnFlbWRpaWxidGFxZWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODMwMjIsImV4cCI6MjA3OTQ1OTAyMn0.p8pk9jBKPyFPXpG1WJtyNglF18LdERc7dd4SlKhGxc4';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
  },
});