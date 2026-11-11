import { env } from './common.ts';

// ---------- Email OTP via Resend (https://resend.com). Needs RESEND_API_KEY and EMAIL_FROM. ----------
export function emailConfigured() {
  return Boolean(env('RESEND_API_KEY') && env('EMAIL_FROM'));
}

export async function sendEmailOtp(to: string, code: string): Promise<boolean> {
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
    <h2 style="margin:0 0 12px">The Elix</h2>
    <p>Your email verification code is:</p>
    <p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:16px 0">${code}</p>
    <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('EMAIL_FROM'),
        to: [to],
        subject: `${code} is your The Elix verification code`,
        html,
        text: `Your The Elix email verification code is ${code}. It expires in 10 minutes.`,
      }),
    });
    if (!res.ok) console.error('Resend error', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('Resend request failed', e);
    return false;
  }
}

// ---------- SMS OTP via Twilio Verify (https://www.twilio.com/docs/verify). ----------
// Twilio generates, sends, expires and checks the SMS code and handles the Indian DLT requirements for Verify.
export function smsConfigured() {
  return Boolean(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_VERIFY_SERVICE_SID'));
}

const twilioBase = () => `https://verify.twilio.com/v2/Services/${env('TWILIO_VERIFY_SERVICE_SID')}`;
const twilioAuth = () => 'Basic ' + btoa(`${env('TWILIO_ACCOUNT_SID')}:${env('TWILIO_AUTH_TOKEN')}`);

export async function sendSmsOtp(to: string): Promise<{ ok: boolean; invalidNumber?: boolean }> {
  try {
    const res = await fetch(`${twilioBase()}/Verifications`, {
      method: 'POST',
      headers: { Authorization: twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, Channel: 'sms' }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    console.error('Twilio send error', res.status, data?.code, data?.message);
    return { ok: false, invalidNumber: data?.code === 60200 || data?.code === 60205 };
  } catch (e) {
    console.error('Twilio request failed', e);
    return { ok: false };
  }
}

// 'approved' | 'incorrect' | 'expired' | 'error'
export async function checkSmsOtp(to: string, code: string): Promise<'approved' | 'incorrect' | 'expired' | 'error'> {
  try {
    const res = await fetch(`${twilioBase()}/VerificationCheck`, {
      method: 'POST',
      headers: { Authorization: twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, Code: code }),
    });
    if (res.status === 404) return 'expired'; // Twilio: no pending verification (expired, already approved or too many checks)
    if (!res.ok) {
      console.error('Twilio check error', res.status);
      return 'error';
    }
    const data = await res.json();
    return data?.status === 'approved' ? 'approved' : 'incorrect';
  } catch (e) {
    console.error('Twilio check failed', e);
    return 'error';
  }
}
