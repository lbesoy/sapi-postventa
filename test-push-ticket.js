const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const item = {
    id: 'test-id-123',
    folio: 'TKT-1234',
    fecha: '2026-05-08',
    fechaCreacion: new Date().toISOString()
  };
  const payload = {
    id: item.id,
    folio: item.folio,
    fecha: item.fecha,
    fecha_creacion: item.fechaCreacion,
    canal: item.canal,
    contacto: item.contacto,
    asunto: item.asunto,
    cliente: item.cliente,
    sitio: item.sitio,
    solicitante: item.solicitante,
    area: item.area,
    categoria: item.categoria,
    prioridad: item.prioridad,
    asignado: item.asignado,
    descripcion: item.descripcion,
    equipo: item.equipo,
    notas: item.notas,
    estado: item.estado,
    cotizacion_sap: item.cotizacionSAP,
    cot_aceptada: item.cotAceptada,
    motivo_rechazo: item.motivoRechazo,
    pedido_sap: item.pedidoSAP,
    tecnicos_asignados: item.tecnicosAsignados || [],
    pdf_pedido: item.pdfPedido,
    pdf_cotizacion: item.pdfCotizacion
  };
  const { error } = await supabase.from('tickets').upsert(payload);
  console.log("Error:", error);
}
test();
