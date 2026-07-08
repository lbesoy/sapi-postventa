import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Configurar CORS dinámico y seguro
  const allowedOrigins = [
    'https://sapi-postventa.vercel.app',
    'https://portal.eurorep.mx',
    'https://plataforma.eurorep.mx',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];
  
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const isLocal = (url) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);
  const isAllowedOrigin = allowedOrigins.some(o => origin.startsWith(o) || referer.startsWith(o)) || isLocal(origin) || isLocal(referer);
  
  if (!isAllowedOrigin && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Access Denied: Forbidden Origin' });
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : 'https://plataforma.eurorep.mx');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Sapi-Client-Token');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Validar autenticación de Supabase (Bearer Token) o Token del Cliente Seguro
  const authHeader = req.headers.authorization || '';
  const clientToken = req.headers['x-sapi-client-token'];
  
  // En producción se requiere estrictamente definir SAPI_CLIENT_TOKEN en el panel de Vercel.
  // En desarrollo se permite el token por defecto para facilitar pruebas.
  const expectedToken = process.env.SAPI_CLIENT_TOKEN || (process.env.NODE_ENV !== 'production' ? 'SapiSecuredClientToken' : undefined);

  const isSupabaseAuth = authHeader.startsWith('Bearer ');
  const isTokenAuth = expectedToken && clientToken === expectedToken;

  if (!isSupabaseAuth && !isTokenAuth) {
    return res.status(401).json({ error: 'Unauthorized: Missing or Invalid Security Token' });
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) {
          return res.status(401).json({ error: 'Unauthorized: Invalid Security Token' });
        }
      } catch (err) {
        console.error('Auth verification error:', err);
      }
    }
  }

  const { to, cc, bcc, subject, htmlBody, attachments } = req.body;

  if (!to || !subject || !htmlBody) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, htmlBody' });
  }

  // Validar correos que admiten listas separadas por comas
  const validateEmails = (emailsStr) => {
    if (!emailsStr) return true;
    const emails = emailsStr.split(',').map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emails.every(e => emailRegex.test(e));
  };

  if (!validateEmails(to)) {
    return res.status(400).json({ error: 'Invalid email address format for field: to' });
  }
  if (cc && !validateEmails(cc)) {
    return res.status(400).json({ error: 'Invalid email address format for field: cc' });
  }
  if (bcc && !validateEmails(bcc)) {
    return res.status(400).json({ error: 'Invalid email address format for field: bcc' });
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
      }
      // B1: Se eliminó ciphers: 'SSLv3' por ser obsoleto y vulnerable, permitiendo negociación TLS segura estándar
    });

    const mailOptions = {
      from: `"SAPI Eurorep" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html: htmlBody,
      attachments: attachments || [] 
      // attachment format: [{ filename: 'reporte.pdf', content: 'base64string', encoding: 'base64' }]
    };

    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    // B3: Se eliminó details: error.message para evitar la exposición de versiones y configuraciones internas del SMTP
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
