import { createClient } from '@supabase/supabase-js';

// Only the PUBLIC (publishable) key is ever used in the browser. What it may read or write is decided by the
// Row Level Security policies in supabase/migrations/0001_schema_rls_storage.sql and the later migrations.
// Never add a service_role / secret key to this project.
//
// Environment variables (see .env.example):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY   (Supabase Dashboard > Project Settings > API Keys > "Publishable key")
// The older name VITE_SUPABASE_ANON_KEY is still accepted so existing setups keep working.
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const publicKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Used only by the dashboard's upload progress bar (public values).
export const SUPABASE_URL = url;
export const SUPABASE_PUBLIC_KEY = publicKey;

export const isSupabaseConfigured = Boolean(url && publicKey && !url.includes('YOUR-PROJECT-REF') && !publicKey.startsWith('YOUR-'));

export const supabase = isSupabaseConfigured
  ? createClient(url, publicKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const MEDIA_BUCKET = 'elix-media';
