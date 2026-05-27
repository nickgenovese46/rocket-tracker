import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { fetchLaunchLibrary } from './_lib/launchLibrary.js';

const SITE_URL = process.env.SITE_URL || 'https://orbit-rocket-tracker.vercel.app';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'ORBIT <onboarding@resend.dev>';

function configured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.RESEND_API_KEY
  );
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmail(resend, to, subject, body) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#010409;color:#F0F4FF;padding:32px;border-radius:12px;">
        ${body}
        <a href="${SITE_URL}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#2563EB;color:white;border-radius:8px;text-decoration:none;">
          Open ORBIT
        </a>
      </div>
    `,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!configured()) {
    return res.status(500).json({ error: 'Notification environment variables are not configured.' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();
  const minuteWindowEnd = new Date(now.getTime() + 6 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();
  const outcomeCutoff = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const results = { minuteSent: 0, outcomeSent: 0, errors: [] };

  const { data: minuteRows = [], error: minuteError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('type', 'email')
    .eq('sent_minute', false)
    .gte('launch_net', nowIso)
    .lte('launch_net', minuteWindowEnd)
    .limit(50);

  if (minuteError) return res.status(500).json({ error: minuteError.message });

  for (const row of minuteRows) {
    try {
      const launchName = escapeHtml(row.launch_name);
      await sendEmail(
        resend,
        row.contact,
        `ORBIT — T-1 minute for ${row.launch_name}`,
        `
          <h2 style="color:#60A5FA;margin-bottom:8px;">T-1 minute</h2>
          <p style="color:#b3c0d4;line-height:1.7;">${launchName} is scheduled to launch in about one minute.</p>
        `
      );
      await supabase.from('subscriptions').update({ sent_minute: true }).eq('id', row.id);
      results.minuteSent += 1;
    } catch (error) {
      results.errors.push({ id: row.id, stage: 'minute', error: error.message });
    }
  }

  const { data: outcomeRows = [], error: outcomeError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('type', 'email')
    .eq('sent_outcome', false)
    .lte('launch_net', outcomeCutoff)
    .limit(50);

  if (outcomeError) return res.status(500).json({ error: outcomeError.message });

  for (const row of outcomeRows) {
    try {
      const launch = await fetchLaunchLibrary(`/launch/${row.launch_id}/`, {}, { attempts: 1 });
      const status = launch?.status?.name || 'Status pending';
      const lowerStatus = status.toLowerCase();
      const isFinal = lowerStatus.includes('success') || lowerStatus.includes('failure') || lowerStatus.includes('failed');
      if (!isFinal) continue;

      const launchName = escapeHtml(row.launch_name);
      await sendEmail(
        resend,
        row.contact,
        `ORBIT — ${row.launch_name} ${status}`,
        `
          <h2 style="color:#60A5FA;margin-bottom:8px;">Launch outcome</h2>
          <p style="color:#b3c0d4;line-height:1.7;">${launchName} is now marked as <strong style="color:#F0F4FF;">${escapeHtml(status)}</strong>.</p>
        `
      );
      await supabase.from('subscriptions').update({ sent_outcome: true }).eq('id', row.id);
      results.outcomeSent += 1;
    } catch (error) {
      results.errors.push({ id: row.id, stage: 'outcome', error: error.message });
    }
  }

  return res.status(200).json(results);
}
