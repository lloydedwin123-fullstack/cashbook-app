import { createClient } from '@supabase/supabase-js';

// Safe access to process.env for browser environments
const getEnv = (key: string, fallback: string): string => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
    // Check for Vite's import.meta.env if available (for Vercel/Vite builds)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore errors
  }
  return fallback;
};

// Configuration from provided credentials
const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://ypvvjbwyysvpjhixxyoe.supabase.co');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdnZqYnd5eXN2cGpoaXh4eW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDUxNDgsImV4cCI6MjA3ODc4MTE0OH0.MJkmHzRB_gIX0TZuUFT_l605AvCCqV-RLVENmQ3N1_s');

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase URL or Key is missing!");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
