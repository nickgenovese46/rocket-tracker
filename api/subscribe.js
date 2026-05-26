import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.SITE_URL || 'https://orbit-rocket-tracker.vercel.app';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'ORBIT <onboarding@resend.dev>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { contact, type = 'email', launchId, launchName, launchNet } = req.body || {};
  const normalizedContact = String(contact || '').trim();

  // Validate based on type
  if (type === 'email') {
    const email = normalizedContact.toLowerCase();
    if (!EMAIL_RE.test(email) || !launchId || !launchName || !launchNet) {
      return res.status(400).json({ error: 'A valid email and launch are required.' });
    }
  } else if (type === 'sms') {
    const digits = normalizedContact.replace(/[\s\-().]/g, '');
    if (!PHONE_RE.test(digits) || !launchId || !launchName || !launchNet) {
      return res.status(400).json({ error: 'A valid phone number and launch are required.' });
    }
  } else {
    return res.status(400).json({ error: 'type must be email or sms.' });
  }

  const contact_clean = type === 'email'
    ? normalizedContact.toLowerCase()
    : normalizedContact.replace(/[\s\-().]/g, ''); // strip formatting from phone

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase is not configured for notifications.' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Store subscription in Supabase
  const { error: dbError } = await supabase.from('subscriptions').insert({
    contact:      contact_clean,
    type,
    launch_id:    launchId,
    launch_name:  launchName,
    launch_net:   launchNet,
    sent_minute:  false,
    sent_outcome: false,
  });

  if (dbError && dbError.code !== '23505') {
    return res.status(500).json({ error: dbError.message });
  }

  // ── Email confirmation ─────────────────────────────────────────────
  if (type === 'email' && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const safeLaunchName = escapeHtml(launchName);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: [contact_clean],
        subject: `ORBIT — Subscribed to ${launchName}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#010409;color:#F0F4FF;padding:32px;border-radius:12px;">
            <h2 style="color:#60A5FA;margin-bottom:8px;">ORBIT Launch Notifications</h2>
            <p style="color:#b3c0d4;">You are subscribed to:</p>
            <h3 style="color:#F0F4FF;margin:8px 0 20px;">${safeLaunchName}</h3>
            <p style="color:#b3c0d4;">You will receive:</p>
            <ul style="color:#b3c0d4;line-height:2;">
              <li>A T-1 minute alert before launch</li>
              <li>The launch outcome once confirmed</li>
            </ul>
            <a href="${SITE_URL}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#2563EB;color:white;border-radius:8px;text-decoration:none;">
              Open ORBIT
            </a>
            <p style="color:#555;font-size:11px;margin-top:24px;">
              This notification is for this launch only and will not be used for marketing.
            </p>
          </div>
        `,
      });
    } catch (e) {
      console.error('Confirmation email failed:', e);
    }
  }

  // ── SMS confirmation via Twilio ────────────────────────────────────
  if (type === 'sms') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Twilio env vars not set — SMS not sent');
    } else {
      try {
        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const smsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To:   contact_clean,
              From: fromNumber,
              Body: `🚀 ORBIT: You're subscribed to ${escapeHtml(launchName)}. You'll get a T-1 min alert + launch outcome. ${SITE_URL}`,
            }).toString(),
          }
        );
        if (!smsRes.ok) {
          const errBody = await smsRes.text();
          console.error('Twilio error:', errBody);
        }
      } catch (e) {
        console.error('SMS send error:', e);
      }
    }
  }

  return res.status(200).json({ success: true });
}
