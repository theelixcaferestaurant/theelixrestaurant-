import { createClient } from 'npm:@supabase/supabase-js@2';
export { normalizeEmail, normalizeMobile, isDisposableEmail, clean, isUuid } from './validate.ts';

// ---- environment (set with `supabase secrets set`, see REVIEWS-SETUP.md). Nothing here is ever sent to the browser. ----
export const env = (name: string) => Deno.env.get(name) ?? '';

export function adminClient() {
  // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically into every Edge Function.
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---- CORS / responses ----
export function corsHeaders(req: Request): Record<string, string> {
  const allowed = env('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') ?? '';
  const allow = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function reply(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function readJson(req: Request, maxBytes = 12_000): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

// ---- crypto ----
const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Unbiased 6-digit code from the system CSPRNG.
export function randomCode(): string {
  const buf = new Uint32Array(1);
  const limit = 4_294_000_000 - (4_294_000_000 % 1_000_000); // reject the biased tail
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function pepper(): string {
  const p = env('OTP_PEPPER');
  if (p.length < 32) throw new Error('OTP_PEPPER secret is missing or shorter than 32 characters');
  return p;
}

export async function ipHash(req: Request): Promise<string | null> {
  const raw = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  return raw ? await hmacHex(pepper(), `ip:${raw}`) : null;
}

// ---- Cloudflare Turnstile (CAPTCHA). Enforced whenever TURNSTILE_SECRET_KEY is configured. ----
export const captchaEnabled = () => env('TURNSTILE_SECRET_KEY') !== '';

export async function captchaOk(token: unknown, req: Request): Promise<boolean> {
  if (!captchaEnabled()) return true;
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return false;
  const body = new URLSearchParams({ secret: env('TURNSTILE_SECRET_KEY'), response: token });
  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = await res.json();
    return data?.success === true;
  } catch {
    return false;
  }
}
