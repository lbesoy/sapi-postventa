import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { getTemplateForStage, getTemplateForInternalComment, STAGES } from './utils/email-templates.js';

export default async function handler(req, res) {
  // CORS y cabeceras
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sapi-Client-Token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 1. Validar Token de Seguridad
  const clientToken = req.headers['x-sapi-client-token'];
  const expectedToken = process.env.SAPI_CLIENT_TOKEN || 'SapiSecuredClientToken';

  if (!clientToken || clientToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Security Token' });
  }

  const { type, record, old_record } = req.body;
  if (!record) return res.status(400).json({ error: 'Missing webhook record data' });

  try {
    // 2. Determinar si se agregó un comentario interno o si hay cambio de etapa relevante
    let stage = null;
    let isInternalComment = false;
    let latestComment = null;

    if (type === 'UPDATE' && old_record) {
      const oldComments = old_record.comentarios_internos || [];
      const newComments = record.comentarios_internos || [];
      if (newComments.length > oldComments.length) {
        isInternalComment = true;
        latestComment = newComments[newComments.length - 1];
      }
    }

    if (!isInternalComment) {
      if (type === 'INSERT') {
        stage = STAGES.REPORTADO;
      } else if (type === 'UPDATE' && old_record) {
        // Comparar cambios
        const oldAsignado = (old_record.asignado || '').trim();
        const newAsignado = (record.asignado || '').trim();
        
        const oldCotSap = (old_record.cotizacion_sap || '').trim();
        const newCotSap = (record.cotizacion_sap || '').trim();
        
        const oldCotAceptada = (old_record.cot_aceptada || '').trim().toLowerCase();
        const newCotAceptada = (record.cot_aceptada || '').trim().toLowerCase();
        
        const oldPedido = (old_record.pedido_sap || '').trim();
        const newPedido = (record.pedido_sap || '').trim();
        
        const oldEstado = (old_record.estado || '').trim().toLowerCase();
        const newEstado = (record.estado || '').trim().toLowerCase();

        // Reglas de transición de etapas
        if (newEstado === 'cerrado' && oldEstado !== 'cerrado') {
          stage = STAGES.CERRADO;
        } else if (newPedido && !oldPedido) {
          stage = STAGES.ORDEN_SERVICIO;
        } else if (newCotAceptada === 'si' && oldCotAceptada !== 'si' && !newPedido) {
          stage = STAGES.EN_PROCESO;
        } else if (newCotSap && !oldCotSap) {
          stage = STAGES.COTIZADO;
        } else if (newAsignado && !oldAsignado && !newCotSap) {
          stage = STAGES.EN_CURSO;
        }
      }
    }

    // Si no es una transición relevante ni un comentario interno, ignorar
    if (!stage && !isInternalComment) {
      return res.status(200).json({ success: true, message: 'No relevant stage change or comment detected.' });
    }

    // 3. Inicializar Supabase usando Service Role Key (bypasa RLS)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase client environment variables are not set.');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    let emailsToNotify = [];
    let subject = '';
    let html = '';

    if (isInternalComment) {
      const authorName = latestComment ? latestComment.usuario : null;

      // 1. Obtener técnico asignado
      if (record.asignado) {
        const { data: tecRole } = await supabase
          .from('user_roles')
          .select('nombre, email')
          .eq('nombre', record.asignado)
          .maybeSingle();
        if (tecRole && tecRole.email && tecRole.nombre !== authorName) {
          emailsToNotify.push(tecRole.email);
        }
      }

      // 2. Obtener todos los admins/supervisores activos
      const { data: admins } = await supabase
        .from('user_roles')
        .select('nombre, email')
        .in('rol', ['superadmin', 'admin', 'supervisor'])
        .eq('activo', true);

      if (admins) {
        admins.forEach(adm => {
          if (adm.email && adm.nombre !== authorName && !emailsToNotify.includes(adm.email)) {
            emailsToNotify.push(adm.email);
          }
        });
      }

      if (emailsToNotify.length === 0) {
        return res.status(200).json({ success: true, message: 'Notification skipped: No recipients found for internal comment.' });
      }

      // Generar plantilla de comentario interno
      const template = getTemplateForInternalComment(record, latestComment, 'Equipo EuroRep');
      subject = template.subject;
      html = template.html;

    } else {
      // Obtener los datos del cliente
      const { data: cliente, error: cliErr } = await supabase
        .from('clientes')
        .select('nombre, email')
        .eq('id', record.cliente)
        .single();

      if (cliErr || !cliente) {
        console.warn(`[Webhook Notification] No se encontró cliente o email para el ID: ${record.cliente}`);
        return res.status(200).json({ success: true, message: 'Notification skipped: Customer has no email or is missing.' });
      }

      if (!cliente.email) {
        return res.status(200).json({ success: true, message: 'Notification skipped: Customer email is empty.' });
      }

      emailsToNotify.push(cliente.email);

      // Generar la Plantilla HTML y Asunto de Etapa
      const template = getTemplateForStage(stage, record, cliente);
      subject = template.subject;
      html = template.html;
    }

    // 5. Configurar Transportador de Correo (SMTP Outlook / Office 365)
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      }
    });

    // 6. Configurar hilos (In-Reply-To / References) - Omitir en comentarios internos para seguridad
    const ultimoMsgId = record.ultimo_email_message_id;
    const threadIds = record.email_thread_ids;

    const mailOptions = {
      from: `"SAPI Eurorep" <${process.env.SMTP_EMAIL}>`,
      to: emailsToNotify.join(', '),
      subject,
      html,
    };

    if (!isInternalComment && stage !== STAGES.REPORTADO && ultimoMsgId) {
      mailOptions.inReplyTo = ultimoMsgId;
      mailOptions.references = threadIds || ultimoMsgId;
    }

    // Enviar correo
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Notification Sent] Stage: ${stage || 'Internal Comment'}, Message-ID: ${info.messageId}`);

    if (!isInternalComment) {
      // 7. Actualizar la base de datos con el nuevo Message-ID
      const nuevosThreadIds = threadIds ? `${threadIds} ${info.messageId}` : info.messageId;
      
      await supabase
        .from('tickets')
        .update({
          ultimo_email_message_id: info.messageId,
          email_thread_ids: nuevosThreadIds
        })
        .eq('id', record.id);
    }

    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('[Notification Webhook Error]:', error);
    return res.status(500).json({ error: error.message || 'Failed to process notification webhook' });
  }
}
