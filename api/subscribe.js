export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { contact, type, launchId, launchName, launchNet } = req.body;
  if (!contact || !launchId) return res.status(400).json({ error: 'Missing fields' });

  // Store in Supabase
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabase.from('subscriptions').insert({
    contact,
    type,
    launch_id: launchId,
    launch_name: launchName,
    launch_net: launchNet,
    sent_minute: false,
    sent_outcome: false,
    created_at: new Date().toISOString(),
  });

  if (error) return res.status(500).json({ error: error.message });

  // Send confirmation email using your existing Resend setup
  if (type === 'email') {
    const SITE_URL = process.env.SITE_URL || 'https://orbit-rocket-tracker.vercel.app';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: contact,
        subject: `ORBIT — You're subscribed to ${launchName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #60A5FA;">🚀 ORBIT Launch Notifications</h2>
            <p>You're subscribed to receive notifications for:</p>
            <h3 style="color: #F0F4FF;">${launchName}</h3>
            <p>You will receive:</p>
            <ul>
              <li>⏱ A T-1 minute alert before launch</li>
              <li>🎯 The launch outcome once confirmed</li>
            </ul>
            <p><a href="${SITE_URL}" style="color: #60A5FA;">Open ORBIT</a></p>
            <p style="color: #666; font-size: 12px;">
              This notification is for this launch only.
            </p>
          </div>
        `,
      }),
    });
  }

  return res.status(200).json({ success: true });
}