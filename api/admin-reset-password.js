// Disparar nueva compilación en Vercel para cargar variables de entorno
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
    // Cliente normal de Supabase con el token del usuario que llama en cabeceras globales
    // para que las consultas (como leer roles) se ejecuten con su RLS de usuario autenticado
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
    const { targetUserId, newPassword } = req.body;
    if (!targetUserId || !newPassword) {
      return res.status(400).json({ error: 'Missing targetUserId or newPassword' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // 3. Crear cliente administrativo para ejecutar la acción
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Actualizar la contraseña del usuario objetivo
    const { data: updateData, error: updateErr } = await adminSupabase.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateErr) {
      return res.status(500).json({ error: `Update failed: ${updateErr.message}` });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
