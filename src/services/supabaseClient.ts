import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nlaiijnrvwbsapooophu.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYWlpam5ydndic2Fwb29vcGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDMzNzUsImV4cCI6MjEwMTMxOTM3NX0.AYa5gpCfV7wMu6hKn0XoO2fLxa2-5pQDa5cckChLdiE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
