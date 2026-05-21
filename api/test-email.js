import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  try {
    const data = await resend.emails.send({
      from: 'ORBIT <onboarding@resend.dev>',
      to: ['nickgeno29@gmail.com'],
      subject: 'ORBIT Test Email',
      html: '<strong>Launch notifications are working.</strong>',
    });

    res.status(200).json(data);

  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
}