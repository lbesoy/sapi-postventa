import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Configurar CORS
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
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Validar autenticación de Supabase (Bearer Token) del Administrador que llama
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Configuration Error: Missing keys' });
  }

  try {
    const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Validar token del usuario y obtener sus datos
    const { data: { user }, error: authErr } = await clientSupabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Verificar si el usuario que llama tiene el rol 'superadmin' o 'admin'
    const { data: callerRoleData, error: roleErr } = await clientSupabase
      .from('user_roles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (roleErr || !callerRoleData) {
      return res.status(403).json({ 
        error: `Forbidden: Could not verify permissions. ${roleErr ? roleErr.message : 'No role data'}` 
      });
    }

    const hasPermission = callerRoleData.rol === 'superadmin' || callerRoleData.rol === 'admin';
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    // 2. Extraer parámetros del body
    const { originUserId, targetUserId } = req.body;
    if (!originUserId || !targetUserId) {
      return res.status(400).json({ error: 'Missing originUserId or targetUserId' });
    }

    if (originUserId === targetUserId) {
      return res.status(400).json({ error: 'Origin and Target user cannot be the same' });
    }

    // 3. Crear cliente administrativo con Service Role
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Obtener datos de ambos usuarios
    const { data: originUser, error: origErr } = await adminSupabase
      .from('user_roles')
      .select('*')
      .eq('id', originUserId)
      .single();

    const { data: targetUser, error: destErr } = await adminSupabase
      .from('user_roles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (origErr || !originUser) {
      return res.status(404).json({ error: `Origin user not found: ${origErr?.message || 'Not found'}` });
    }

    if (destErr || !targetUser) {
      return res.status(404).json({ error: `Target user not found: ${destErr?.message || 'Not found'}` });
    }

    const originEmail = (originUser.email || '').trim().toLowerCase();
    const targetEmail = (targetUser.email || '').trim().toLowerCase();

    // Intentar ejecutar función RPC si existe en la base de datos
    if (originEmail && targetEmail) {
      try {
        const { data: rpcData, error: rpcError } = await adminSupabase.rpc('fusionar_cuentas_usuario', {
          p_email_viejo: originEmail,
          p_email_nuevo: targetEmail
        });
        if (!rpcError) {
          return res.status(200).json({ success: true, message: 'Fusión completada vía RPC', data: rpcData });
        }
        console.warn('[Admin Merge] RPC failed, falling back to direct updates:', rpcError.message);
      } catch (e) {
        console.warn('[Admin Merge] RPC exception:', e.message);
      }
    }

    // Fallback: Ejecución directa con cliente administrativo
    const targetNombre = (targetUser.nombre && targetUser.nombre.trim() !== '') ? targetUser.nombre : originUser.nombre;

    // 1. Actualizar datos en user_roles para la cuenta destino
    await adminSupabase
      .from('user_roles')
      .update({
        nombre: targetNombre,
        rol: originUser.rol || targetUser.rol || 'tecnico',
        telefono: targetUser.telefono || originUser.telefono || null,
        empresa: targetUser.empresa || originUser.empresa || null,
        activo: true
      })
      .eq('id', targetUserId);

    // 2. Traspasar relaciones cliente_usuarios
    try {
      const { data: relOld } = await adminSupabase.from('cliente_usuarios').select('*').eq('usuario_id', originUserId);
      if (relOld && relOld.length > 0) {
        for (const rel of relOld) {
          await adminSupabase.from('cliente_usuarios').upsert({
            cliente_id: rel.cliente_id,
            usuario_id: targetUserId
          }, { onConflict: 'cliente_id,usuario_id' });
        }
        await adminSupabase.from('cliente_usuarios').delete().eq('usuario_id', originUserId);
      }
    } catch (e) {}

    // 3. Traspasar cliente_tecnicos y cliente_supervisores
    try { await adminSupabase.from('cliente_tecnicos').update({ usuario_id: targetUserId }).eq('usuario_id', originUserId); } catch(e){}
    try { await adminSupabase.from('cliente_supervisores').update({ usuario_id: targetUserId }).eq('usuario_id', originUserId); } catch(e){}

    // 4. Traspasar Gastos
    try { await adminSupabase.from('gastos').update({ usuario_id: targetUserId }).eq('usuario_id', originUserId); } catch(e){}
    try { await adminSupabase.from('gastos_aprobados').update({ usuario_id: targetUserId }).eq('usuario_id', originUserId); } catch(e){}
    try { await adminSupabase.from('gastos_rechazados').update({ usuario_id: targetUserId }).eq('usuario_id', originUserId); } catch(e){}

    // 5. Traspasar Tarjetas Clara
    try { await adminSupabase.from('clara_cards').update({ usuario_vinculado_id: targetUserId }).eq('usuario_vinculado_id', originUserId); } catch(e){}

    // 6. Traspasar Eventos Calendario
    try { await adminSupabase.from('calendario_eventos').update({ tecnico_id: targetUserId, creado_por: targetUserId, tecnico_nombre: targetNombre }).eq('tecnico_id', originUserId); } catch(e){}

    // 7. Traspasar Horómetros
    try { await adminSupabase.from('maquinaria_horometros').update({ usuario_id: targetUserId }).eq('usuario_id', originUserId); } catch(e){}

    // 8. Traspasar Auditoría y Telemetría
    try { await adminSupabase.from('auditoria_logs').update({ usuario_id: targetUserId }).eq('usuario_id', originUserId); } catch(e){}
    try { await adminSupabase.from('sapi_telemetry').update({ user_id: targetUserId }).eq('user_id', originUserId); } catch(e){}

    // 9. Traspasar Ideas y Fallas
    try { await adminSupabase.from('ideas_fallas').update({ creado_por_id: String(targetUserId) }).eq('creado_por_id', String(originUserId)); } catch(e){}

    // 10. Traspasar Órdenes, Bitácoras y Tickets si el nombre del técnico cambió
    if (originUser.nombre) {
      try { await adminSupabase.from('ordenes').update({ tecnico: targetNombre }).eq('tecnico', originUser.nombre); } catch(e){}
      try { await adminSupabase.from('orden_bitacora').update({ tecnico: targetNombre }).eq('tecnico', originUser.nombre); } catch(e){}
      try { await adminSupabase.from('tickets').update({ asignado: targetNombre }).eq('asignado', originUser.nombre); } catch(e){}
      try { await adminSupabase.from('tickets').update({ solicitante: targetNombre }).eq('solicitante', originUser.nombre); } catch(e){}
    }

    // 11. Eliminar de user_roles
    try {
      await adminSupabase.from('user_roles').delete().eq('id', originUserId);
    } catch (e) {}

    // 12. Eliminar de auth.users usando Admin API
    try {
      await adminSupabase.auth.admin.deleteUser(originUserId);
    } catch (e) {
      console.warn('[Admin Merge] Warning deleting user from auth.users:', e.message);
    }

    return res.status(200).json({ success: true, message: 'Fusión completada con éxito' });
  } catch (error) {
    console.error('Admin merge users error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
