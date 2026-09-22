-- Migration: 0042_create_fusionar_usuarios_fn.sql
-- Description: Create PL/pgSQL function to merge two user accounts atomically in EuroRep / Supabase.

CREATE OR REPLACE FUNCTION public.fusionar_cuentas_usuario(
  p_email_viejo TEXT,
  p_email_nuevo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to ensure clean updates and deletions across all tables
AS $$
DECLARE
  v_id_viejo UUID;
  v_id_nuevo UUID;
  v_nombre_viejo TEXT;
  v_nombre_nuevo TEXT;
  v_rol_viejo TEXT;
  v_tel_viejo TEXT;
  v_empresa_vieja TEXT;
  v_caller_role TEXT;
BEGIN
  -- 1. Validar que quien ejecuta sea superadmin o admin
  SELECT rol INTO v_caller_role FROM public.user_roles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('superadmin', 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: Solo los administradores pueden fusionar cuentas de usuario.';
  END IF;

  -- 2. Limpiar y normalizar correos
  p_email_viejo := LOWER(TRIM(p_email_viejo));
  p_email_nuevo := LOWER(TRIM(p_email_nuevo));

  IF p_email_viejo = p_email_nuevo THEN
    RAISE EXCEPTION 'El correo origen y destino no pueden ser iguales.';
  END IF;

  -- 3. Obtener datos de la cuenta antigua
  SELECT id, nombre, rol, telefono, empresa
  INTO v_id_viejo, v_nombre_viejo, v_rol_viejo, v_tel_viejo, v_empresa_vieja
  FROM public.user_roles
  WHERE LOWER(email) = p_email_viejo;

  IF v_id_viejo IS NULL THEN
    RAISE EXCEPTION 'No se encontró la cuenta de origen con correo: %', p_email_viejo;
  END IF;

  -- 4. Obtener datos de la cuenta nueva
  SELECT id, nombre
  INTO v_id_nuevo, v_nombre_nuevo
  FROM public.user_roles
  WHERE LOWER(email) = p_email_nuevo;

  IF v_id_nuevo IS NULL THEN
    RAISE EXCEPTION 'No se encontró la cuenta de destino con correo: %', p_email_nuevo;
  END IF;

  IF v_nombre_nuevo IS NULL OR TRIM(v_nombre_nuevo) = '' THEN
    v_nombre_nuevo := v_nombre_viejo;
  END IF;

  -- 5. Traspasar rol, perfil, teléfono y empresa a la nueva cuenta (y activarla)
  UPDATE public.user_roles
  SET
    nombre = COALESCE(NULLIF(TRIM(v_nombre_nuevo), ''), v_nombre_viejo),
    rol = COALESCE(v_rol_viejo, 'tecnico'),
    telefono = COALESCE(NULLIF(telefono, ''), v_tel_viejo),
    empresa = COALESCE(NULLIF(empresa, ''), v_empresa_vieja),
    activo = true
  WHERE id = v_id_nuevo;

  -- 6. Traspasar Gastos
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gastos') THEN
    UPDATE public.gastos SET usuario_id = v_id_nuevo WHERE usuario_id = v_id_viejo;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gastos_aprobados') THEN
    UPDATE public.gastos_aprobados SET usuario_id = v_id_nuevo WHERE usuario_id = v_id_viejo;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'gastos_rechazados') THEN
    UPDATE public.gastos_rechazados SET usuario_id = v_id_nuevo WHERE usuario_id = v_id_viejo;
  END IF;

  -- 7. Traspasar Tarjetas Clara
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clara_cards') THEN
    UPDATE public.clara_cards SET usuario_vinculado_id = v_id_nuevo WHERE usuario_vinculado_id = v_id_viejo;
  END IF;

  -- 8. Traspasar Asignación de Empresas/Clientes
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cliente_usuarios') THEN
    INSERT INTO public.cliente_usuarios (cliente_id, usuario_id)
    SELECT cliente_id, v_id_nuevo FROM public.cliente_usuarios WHERE usuario_id = v_id_viejo
    ON CONFLICT DO NOTHING;
    DELETE FROM public.cliente_usuarios WHERE usuario_id = v_id_viejo;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cliente_tecnicos') THEN
    INSERT INTO public.cliente_tecnicos (cliente_id, usuario_id)
    SELECT cliente_id, v_id_nuevo FROM public.cliente_tecnicos WHERE usuario_id = v_id_viejo
    ON CONFLICT DO NOTHING;
    DELETE FROM public.cliente_tecnicos WHERE usuario_id = v_id_viejo;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cliente_supervisores') THEN
    INSERT INTO public.cliente_supervisores (cliente_id, usuario_id)
    SELECT cliente_id, v_id_nuevo FROM public.cliente_supervisores WHERE usuario_id = v_id_viejo
    ON CONFLICT DO NOTHING;
    DELETE FROM public.cliente_supervisores WHERE usuario_id = v_id_viejo;
  END IF;

  -- 9. Traspasar Eventos de Calendario
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'calendario_eventos') THEN
    UPDATE public.calendario_eventos SET tecnico_id = v_id_nuevo WHERE tecnico_id = v_id_viejo;
    UPDATE public.calendario_eventos SET creado_por = v_id_nuevo WHERE creado_por = v_id_viejo;
  END IF;

  -- 10. Traspasar Horómetros
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'maquinaria_horometros') THEN
    UPDATE public.maquinaria_horometros SET usuario_id = v_id_nuevo WHERE usuario_id = v_id_viejo;
  END IF;

  -- 11. Traspasar Auditoría y Telemetría
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'auditoria_logs') THEN
    UPDATE public.auditoria_logs SET usuario_id = v_id_nuevo WHERE usuario_id = v_id_viejo;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sapi_telemetry') THEN
    UPDATE public.sapi_telemetry SET user_id = v_id_nuevo WHERE user_id = v_id_viejo;
  END IF;

  -- 12. Traspasar Ideas y Fallas
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ideas_fallas') THEN
    UPDATE public.ideas_fallas SET creado_por_id = v_id_nuevo::text WHERE creado_por_id = v_id_viejo::text;
  END IF;

  -- 13. Si el nombre cambió, actualizar Órdenes, Bitácoras y Tickets
  IF v_nombre_viejo IS NOT NULL AND v_nombre_nuevo IS NOT NULL AND v_nombre_viejo <> v_nombre_nuevo THEN
    UPDATE public.ordenes SET tecnico = v_nombre_nuevo WHERE tecnico = v_nombre_viejo;
    UPDATE public.orden_bitacora SET tecnico = v_nombre_nuevo WHERE tecnico = v_nombre_viejo;
    UPDATE public.tickets SET asignado = v_nombre_nuevo WHERE asignado = v_nombre_viejo;
    UPDATE public.tickets SET solicitante = v_nombre_nuevo WHERE solicitante = v_nombre_viejo;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'calendario_eventos') THEN
      UPDATE public.calendario_eventos SET tecnico_nombre = v_nombre_nuevo WHERE tecnico_nombre = v_nombre_viejo;
    END IF;
  END IF;

  -- 14. Eliminar usuario antiguo de auth.users (cascada a user_roles)
  DELETE FROM auth.users WHERE id = v_id_viejo;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Fusión completada con éxito',
    'id_nuevo', v_id_nuevo,
    'email_nuevo', p_email_nuevo,
    'nombre', v_nombre_nuevo,
    'rol', v_rol_viejo
  );
END;
$$;
