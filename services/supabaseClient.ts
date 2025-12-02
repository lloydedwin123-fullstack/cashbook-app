import { createClient } from '@supabase/supabase-js';

// Configuration from provided credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ypvvjbwyysvpjhixxyoe.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdnZqYnd5eXN2cGpoaXh4eW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDUxNDgsImV4cCI6MjA3ODc4MTE0OH0.MJkmHzRB_gIX0TZuUFT_l605AvCCqV-RLVENmQ3N1_s';

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase URL or Key is missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);