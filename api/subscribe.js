import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.SITE_URL || 'https://orbit-rocket-tracker.vercel.app';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'ORBIT <onboarding@resend.dev>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const email = String(contact || '').trim().toLowerCase();

  if (type !== 'email') {
    return res.status(400).json({ error: 'Email notifications are currently supported.' });
  }
  if (!EMAIL_RE.test(email) || !launchId || !launchName || !launchNet) {
    return res.status(400).json({ error: 'A valid email and launch are required.' });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase is not configured for notifications.' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Store subscription in Supabase
  const { error: dbError } = await supabase.from('subscriptions').insert({
    contact:      email,
    type:         'email',
    launch_id:    launchId,
    launch_name:  launchName,
    launch_net:   launchNet,
    sent_minute:  false,
    sent_outcome: false,
  });

  if (dbError && dbError.code !== '23505') {
    return res.status(500).json({ error: dbError.message });
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const safeLaunchName = escapeHtml(launchName);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
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
    } catch(e) {
      console.error('Confirmation email failed:', e);
      // Don't fail the whole request if confirmation email fails
    }
  }

  return res.status(200).json({ success: true });
}
