import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { to, subject, htmlBody, attachments } = req.body;

  if (!to || !subject || !htmlBody) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, htmlBody' });
  }

  try {
    // Configuración para Outlook / Office 365
    // Estas variables deben configurarse en el panel de Vercel (Settings -> Environment Variables)
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_EMAIL,     // ej: avisos@eurorep.mx
        pass: process.env.SMTP_PASSWORD,  // contraseña de aplicación (App Password)
      },
      tls: {
        ciphers: 'SSLv3'
      }
    });

    const mailOptions = {
      from: `"SAPI Eurorep" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html: htmlBody,
      attachments: attachments || [] 
      // attachment format: [{ filename: 'reporte.pdf', content: 'base64string', encoding: 'base64' }]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
}
