/**
 * Utilidades para la generación de borradores / plantillas de correo
 */

export const STAGES = {
  REPORTADO: 'Reportado',
  EN_CURSO: 'En Curso',
  COTIZADO: 'Cotizado',
  EN_PROCESO: 'En Proceso',
  ORDEN_SERVICIO: 'Orden de Servicio',
  CERRADO: 'Cerrado'
};

export function getTemplateForStage(stage, ticket, cliente) {
  const folio = ticket.folio || 'N/A';
  const asuntoOriginal = ticket.asunto || 'Solicitud de Servicio';
  const clienteNombre = cliente?.nombre || ticket.solicitante || 'Cliente';
  
  let subject = `Ticket ${folio} - ${asuntoOriginal}`;
  let bodyHtml = '';

  switch (stage) {
    case STAGES.REPORTADO:
      subject = `Ticket Recibido - ${folio}: ${asuntoOriginal}`;
      bodyHtml = `
        <p>Hola <strong>${clienteNombre}</strong>,</p>
        <p>Hemos recibido tu solicitud de servicio con éxito. Tu ticket ha sido registrado en nuestro sistema con el folio <strong>${folio}</strong>.</p>
        <p><strong>Detalle del reporte:</strong></p>
        <blockquote style="margin: 15px 0; padding: 10px 15px; border-left: 4px solid #e8820c; background-color: #f8fafc; color: #475569; font-style: italic;">
          ${ticket.descripcion || 'Sin descripción'}
        </blockquote>
        <p>Estamos revisando los detalles para asignar al personal idóneo. Te mantendremos informado en este mismo hilo.</p>
      `;
      break;

    case STAGES.EN_CURSO:
      subject = `Re: Ticket Recibido - ${folio}: ${asuntoOriginal}`;
      bodyHtml = `
        <p>Hola <strong>${clienteNombre}</strong>,</p>
        <p>Tu solicitud de servicio ahora está <strong>En Curso</strong>. Hemos asignado al siguiente personal técnico para atender tu equipo:</p>
        <p><strong>Técnico Asignado:</strong> ${ticket.asignado || 'Personal Técnico Eurorep'}</p>
        <p>Pronto se pondrá en contacto contigo o acudirá a tus instalaciones para realizar la evaluación.</p>
      `;
      break;

    case STAGES.COTIZADO:
      subject = `Re: Ticket Recibido - ${folio}: ${asuntoOriginal}`;
      bodyHtml = `
        <p>Hola <strong>${clienteNombre}</strong>,</p>
        <p>La evaluación técnica ha concluido y la cotización correspondiente está lista:</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0;">
          <ul style="margin: 0; padding-left: 20px; color: #475569;">
            <li><strong>Cotización SAP:</strong> ${ticket.cotizacion_sap || ticket.cotizacion_sap || 'Pendiente'}</li>
            <li><strong>Monto:</strong> $${Number(ticket.monto_cotizacion || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</li>
          </ul>
        </div>
        <p>Por favor, ingresa al portal de clientes para revisar el detalle y autorizarla para proceder.</p>
      `;
      break;

    case STAGES.EN_PROCESO:
      subject = `Re: Ticket Recibido - ${folio}: ${asuntoOriginal}`;
      bodyHtml = `
        <p>Hola <strong>${clienteNombre}</strong>,</p>
        <p>Muchas gracias. Hemos registrado la <strong>aprobación</strong> de la cotización para tu ticket.</p>
        <p>Estamos procesando la asignación del Pedido SAP correspondiente para coordinar los trabajos.</p>
      `;
      break;

    case STAGES.ORDEN_SERVICIO:
      subject = `Re: Ticket Recibido - ${folio}: ${asuntoOriginal}`;
      bodyHtml = `
        <p>Hola <strong>${clienteNombre}</strong>,</p>
        <p>El Pedido SAP ha sido registrado con éxito:</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0;">
          <ul style="margin: 0; padding-left: 20px; color: #475569;">
            <li><strong>Pedido SAP:</strong> ${ticket.pedido_sap || 'N/A'}</li>
          </ul>
        </div>
        <p>La orden de servicio asociada se encuentra en ejecución por el equipo técnico asignado.</p>
      `;
      break;

    case STAGES.CERRADO:
      subject = `Re: Ticket Recibido - ${folio}: ${asuntoOriginal}`;
      bodyHtml = `
        <p>Hola <strong>${clienteNombre}</strong>,</p>
        <p>Te informamos que tu solicitud de servicio con folio <strong>${folio}</strong> ha sido completada y cerrada exitosamente.</p>
        <p>Si tienes alguna duda o comentario adicional, puedes responder a este correo.</p>
        <p>Agradecemos tu preferencia.</p>
      `;
      break;

    default:
      bodyHtml = `<p>Tu ticket ha sido actualizado a la etapa: <strong>${stage}</strong>.</p>`;
  }

  // Estructura y diseño premium responsivo (Eurorep)
  const fullHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #e8820c; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #1e293b; font-size: 20px; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">Portal de Servicio Posventa</h1>
        <span style="color: #e8820c; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Euro Representaciones</span>
      </div>
      <div style="line-height: 1.6; font-size: 15px; color: #475569;">
        ${bodyHtml}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px; text-align: center; color: #94a3b8; font-size: 11px; line-height: 1.4;">
        <p>Este es un correo automático referente al folio <strong>${folio}</strong>.</p>
        <p>© ${new Date().getFullYear()} Euro Representaciones. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  return { subject, html: fullHtml };
}

export function getTemplateForInternalComment(ticket, comment, recipientName) {
  const folio = ticket.folio || 'N/A';
  const asuntoOriginal = ticket.asunto || 'Solicitud de Servicio';
  
  const subject = `Nuevo Comentario Interno - Ticket ${folio}: ${asuntoOriginal}`;
  const bodyHtml = `
    <p>Hola <strong>${recipientName}</strong>,</p>
    <p>Se ha registrado un nuevo <strong>comentario interno</strong> en el ticket con folio <strong>${folio}</strong>.</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0;">
      <p style="margin: 0 0 10px 0; font-size: 0.85rem; color: #64748b;">
        <strong>Autor:</strong> ${comment.usuario || 'Sistema'} | 
        <strong>Fecha:</strong> ${comment.fecha ? new Date(comment.fecha).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'N/A'}
      </p>
      <div style="color: #475569; font-size: 0.95rem; white-space: pre-wrap; line-height: 1.5; font-style: italic;">
        ${comment.texto || ''}
      </div>
    </div>
    <p>Puedes ingresar al sistema EuroRep para dar seguimiento.</p>
  `;

  // Estructura y diseño premium responsivo (Eurorep)
  const fullHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #e8820c; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #1e293b; font-size: 20px; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">Portal de Servicio Posventa</h1>
        <span style="color: #e8820c; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Euro Representaciones</span>
      </div>
      <div style="line-height: 1.6; font-size: 15px; color: #475569;">
        ${bodyHtml}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px; text-align: center; color: #94a3b8; font-size: 11px; line-height: 1.4;">
        <p>Este es un correo automático referente al folio <strong>${folio}</strong>.</p>
        <p>© ${new Date().getFullYear()} Euro Representaciones. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  return { subject, html: fullHtml };
}

export function getTemplateForExternalComment(ticket, comment, isSentByStaff, recipientName) {
  const folio = ticket.folio || 'N/A';
  const asuntoOriginal = ticket.asunto || 'Solicitud de Servicio';
  
  let subject = '';
  let bodyHtml = '';
  
  if (isSentByStaff) {
    subject = `Respuesta de Soporte EuroRep - Ticket ${folio}: ${asuntoOriginal}`;
    bodyHtml = `
      <p>Hola <strong>${recipientName}</strong>,</p>
      <p>El equipo de soporte de <strong>EuroRep</strong> ha dejado un nuevo mensaje en tu ticket de servicio con folio <strong>${folio}</strong>.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0;">
        <p style="margin: 0 0 10px 0; font-size: 0.85rem; color: #e8820c; font-weight: bold;">
          Soporte EuroRep
        </p>
        <div style="color: #475569; font-size: 0.95rem; white-space: pre-wrap; line-height: 1.5;">
          ${comment.texto || ''}
        </div>
      </div>
      <p>Puedes responder a este mensaje ingresando a tu <a href="https://postventa.eurorep.mx/cliente.html" style="color: #e8820c; text-decoration: underline; font-weight: bold;">Portal de Clientes</a>.</p>
    `;
  } else {
    subject = `Nuevo Mensaje de Cliente - Ticket ${folio}: ${asuntoOriginal}`;
    bodyHtml = `
      <p>Hola <strong>${recipientName}</strong>,</p>
      <p>El cliente ha enviado un nuevo mensaje en el ticket con folio <strong>${folio}</strong>.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin: 15px 0;">
        <p style="margin: 0 0 10px 0; font-size: 0.85rem; color: #64748b;">
          <strong>Cliente:</strong> ${comment.usuario || 'Cliente'} | 
          <strong>Fecha:</strong> ${comment.fecha ? new Date(comment.fecha).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : 'N/A'}
        </p>
        <div style="color: #475569; font-size: 0.95rem; white-space: pre-wrap; line-height: 1.5; font-style: italic;">
          ${comment.texto || ''}
        </div>
      </div>
      <p>Puedes ver este mensaje e ingresar tu respuesta accediendo al panel administrativo de EuroRep.</p>
    `;
  }

  // Estructura y diseño premium responsivo (Eurorep)
  const fullHtml = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 25px; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #e8820c; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #1e293b; font-size: 20px; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">Portal de Servicio Posventa</h1>
        <span style="color: #e8820c; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Euro Representaciones</span>
      </div>
      <div style="line-height: 1.6; font-size: 15px; color: #475569;">
        ${bodyHtml}
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px; text-align: center; color: #94a3b8; font-size: 11px; line-height: 1.4;">
        <p>Este es un correo automático referente al folio <strong>${folio}</strong>.</p>
        <p>© ${new Date().getFullYear()} Euro Representaciones. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  return { subject, html: fullHtml };
}
