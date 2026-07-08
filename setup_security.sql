-- 1. Crear tabla para los roles de usuario ligada a Supabase Auth
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nombre text,
    rol text NOT NULL DEFAULT 'consulta',
    activo boolean DEFAULT false
);

-- 2. Activar RLS en todas las tablas importantes
ALTER TABLE public.ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones_sap ENABLE ROW LEVEL SECURITY;

-- 2.2 Crear Helpers de Seguridad con Caching STABLE (Evita cuellos de botella en RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  v_rol text;
BEGIN
  SELECT rol INTO v_rol FROM public.user_roles WHERE id = auth.uid();
  RETURN coalesce(v_rol, 'consulta');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_my_name()
RETURNS text AS $$
DECLARE
  v_nombre text;
BEGIN
  SELECT nombre INTO v_nombre FROM public.user_roles WHERE id = auth.uid();
  RETURN coalesce(v_nombre, '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2.5 Limpiar políticas previas para evitar conflictos de duplicación al re-ejecutar el script
DROP POLICY IF EXISTS "Admins full access ordenes" ON public.ordenes;
DROP POLICY IF EXISTS "Admins y Supervisores full access ordenes" ON public.ordenes;
DROP POLICY IF EXISTS "Técnicos pueden ver sus órdenes" ON public.ordenes;
DROP POLICY IF EXISTS "Técnicos pueden editar sus órdenes" ON public.ordenes;
DROP POLICY IF EXISTS "Consulta read access ordenes" ON public.ordenes;
DROP POLICY IF EXISTS "Clientes y Empresas read access ordenes" ON public.ordenes;


DROP POLICY IF EXISTS "Admins full access tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins y Supervisores full access tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins y Laura Paz full access tickets" ON public.tickets;
DROP POLICY IF EXISTS "Supervisores own access tickets" ON public.tickets;
DROP POLICY IF EXISTS "Consulta y Tecnicos read access tickets" ON public.tickets;

DROP POLICY IF EXISTS "Admins full access clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admins y Supervisores full access clientes" ON public.clientes;
DROP POLICY IF EXISTS "Consulta y Tecnicos read access clientes" ON public.clientes;

DROP POLICY IF EXISTS "Admins full access maquinaria" ON public.maquinaria;
DROP POLICY IF EXISTS "Admins y Supervisores full access maquinaria" ON public.maquinaria;
DROP POLICY IF EXISTS "Consulta y Tecnicos read access maquinaria" ON public.maquinaria;

DROP POLICY IF EXISTS "Admins full access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios pueden leer su propio rol" ON public.user_roles;
DROP POLICY IF EXISTS "Allow select on user_roles to authenticated" ON public.user_roles;

-- 3. Crear Políticas (Policies) para Administradores y Supervisores (Acceso Completo)
CREATE POLICY "Admins y Supervisores full access ordenes" ON public.ordenes FOR ALL TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
);

CREATE POLICY "Admins y Laura Paz full access tickets" ON public.tickets FOR ALL TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin')
  OR (
    public.get_my_role() = 'supervisor'
    AND public.get_my_name() ILIKE '%laura%paz%'
  )
) WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin')
  OR (
    public.get_my_role() = 'supervisor'
    AND public.get_my_name() ILIKE '%laura%paz%'
  )
);

CREATE POLICY "Supervisores own access tickets" ON public.tickets FOR ALL TO authenticated USING (
  public.get_my_role() = 'supervisor'
  AND NOT (public.get_my_name() ILIKE '%laura%paz%')
  AND (
    asignado = public.get_my_name()
    OR solicitante = public.get_my_name()
  )
) WITH CHECK (
  public.get_my_role() = 'supervisor'
  AND NOT (public.get_my_name() ILIKE '%laura%paz%')
  AND (
    asignado = public.get_my_name()
    OR solicitante = public.get_my_name()
  )
);

CREATE POLICY "Admins y Supervisores full access clientes" ON public.clientes FOR ALL TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
);

CREATE POLICY "Admins y Supervisores full access maquinaria" ON public.maquinaria FOR ALL TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor', 'tecnico')
) WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor', 'tecnico')
);

CREATE POLICY "Admins insert user_roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin')
);

CREATE POLICY "Admins update user_roles" ON public.user_roles FOR UPDATE TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin')
) WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin')
);

CREATE POLICY "Admins delete user_roles" ON public.user_roles FOR DELETE TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin')
);

CREATE POLICY "Consulta y Tecnicos read access clientes" ON public.clientes FOR SELECT TO authenticated USING (
  public.get_my_role() IN ('tecnico', 'consulta', 'empresa', 'cliente', 'supervisor')
);

CREATE POLICY "Consulta y Tecnicos read access maquinaria" ON public.maquinaria FOR SELECT TO authenticated USING (
  public.get_my_role() IN ('tecnico', 'consulta', 'empresa', 'cliente', 'supervisor')
);

CREATE POLICY "Consulta y Tecnicos read access tickets" ON public.tickets FOR SELECT TO authenticated USING (
  public.get_my_role() IN ('tecnico', 'consulta', 'empresa', 'cliente')
  OR (
    public.get_my_role() = 'supervisor'
    AND (
      public.get_my_name() ILIKE '%laura%paz%'
      OR asignado = public.get_my_name()
      OR solicitante = public.get_my_name()
    )
  )
);

-- 5. Crear Políticas para Técnicos y Consulta sobre Órdenes de Servicio
CREATE POLICY "Técnicos pueden ver sus órdenes" ON public.ordenes FOR SELECT TO authenticated USING (
  public.get_my_role() = 'tecnico' AND (
    tecnico = public.get_my_name() OR
    notas LIKE '%"' || public.get_my_name() || '"%'
  )
);

CREATE POLICY "Técnicos pueden editar sus órdenes" ON public.ordenes FOR UPDATE TO authenticated USING (
  public.get_my_role() = 'tecnico' AND (
    tecnico = public.get_my_name() OR
    notas LIKE '%"' || public.get_my_name() || '"%'
  )
);

CREATE POLICY "Consulta read access ordenes" ON public.ordenes FOR SELECT TO authenticated USING (
  public.get_my_role() = 'consulta'
);

CREATE POLICY "Clientes y Empresas read access ordenes" ON public.ordenes FOR SELECT TO authenticated USING (
  public.get_my_role() IN ('empresa', 'cliente')
);

-- 5. Crear Trigger para añadir automáticamente los usuarios nuevos a la tabla de roles
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (id, nombre, rol, activo)
  VALUES (new.id, new.raw_user_meta_data->>'nombre', 'consulta', false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Permitir a todos los usuarios autenticados consultar la lista de roles para el modal selector de usuario
CREATE POLICY "Allow select on user_roles to authenticated" ON public.user_roles FOR SELECT TO authenticated USING (
  true
);

-- ========================================================
-- 6. Políticas de RLS para Tablas de Gastos, Calendario, Clara y Facturas
-- ========================================================

-- Habilitar RLS
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clara_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clara_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_analizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_conciliadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas para evitar conflictos de duplicación
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.gastos;
DROP POLICY IF EXISTS "Admins y Supervisores full access gastos" ON public.gastos;
DROP POLICY IF EXISTS "Usuarios propios access gastos" ON public.gastos;

DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.calendario_eventos;

DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.clara_transactions;
DROP POLICY IF EXISTS "Admins y Supervisores full access clara_transactions" ON public.clara_transactions;
DROP POLICY IF EXISTS "Usuarios propios read clara_transactions" ON public.clara_transactions;

DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.clara_cards;
DROP POLICY IF EXISTS "Admins y Supervisores full access clara_cards" ON public.clara_cards;
DROP POLICY IF EXISTS "Usuarios propios read clara_cards" ON public.clara_cards;

DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.facturas_analizadas;
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.facturas_conciliadas;
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.auditoria_logs;

-- Crear políticas universales para usuarios autenticados (Tablas no-financieras)
CREATE POLICY "Permitir todo a autenticados" ON public.calendario_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a autenticados" ON public.facturas_analizadas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a autenticados" ON public.facturas_conciliadas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a autenticados" ON public.auditoria_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Crear políticas específicas y seguras (Tablas financieras)

-- 1. GASTOS
-- Admins / Supervisores: Acceso total
CREATE POLICY "Admins y Supervisores full access gastos" ON public.gastos FOR ALL TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
);

-- Usuarios regulares: Solo sus propios gastos
CREATE POLICY "Usuarios propios access gastos" ON public.gastos FOR ALL TO authenticated USING (
  usuario_id = auth.uid()
) WITH CHECK (
  usuario_id = auth.uid()
);

-- 2. TARJETAS CLARA
-- Admins / Supervisores: Acceso total
CREATE POLICY "Admins y Supervisores full access clara_cards" ON public.clara_cards FOR ALL TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
);

-- Usuarios regulares: Solo ver sus propias tarjetas asignadas
CREATE POLICY "Usuarios propios read clara_cards" ON public.clara_cards FOR SELECT TO authenticated USING (
  usuario_vinculado_id = auth.uid()
);

-- 3. TRANSACCIONES CLARA
-- Admins / Supervisores: Acceso total
CREATE POLICY "Admins y Supervisores full access clara_transactions" ON public.clara_transactions FOR ALL TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
);

-- Usuarios regulares: Ver transacciones de sus propias tarjetas vinculadas
CREATE POLICY "Usuarios propios read clara_transactions" ON public.clara_transactions FOR SELECT TO authenticated USING (
  card_last_4 IN (
    SELECT right(tarjeta, 4)
    FROM public.clara_cards
    WHERE usuario_vinculado_id = auth.uid()
  )
  OR alias_tarjeta ILIKE '%' || public.get_my_name() || '%'
);

-- ========================================================
-- 7. Configuración de Storage Bucket (evidencias) - COMENTADO PARA EVITAR ERRORES DE PERMISOS
-- ========================================================

-- Crear el bucket "evidencias" si no existe
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('evidencias', 'evidencias', true)
-- ON CONFLICT (id) DO NOTHING;

-- Asegurar RLS en objects
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas de storage para evitar duplicación
-- DROP POLICY IF EXISTS "Permitir subidas a todo el crm" ON storage.objects;
-- DROP POLICY IF EXISTS "Permitir lectura publica" ON storage.objects;

-- Crear políticas de storage
-- CREATE POLICY "Permitir subidas a todo el crm" 
-- ON storage.objects 
-- FOR INSERT 
-- TO authenticated 
-- WITH CHECK (bucket_id = 'evidencias');

-- CREATE POLICY "Permitir lectura publica" 
-- ON storage.objects 
-- FOR SELECT 
-- TO public 
-- USING (bucket_id = 'evidencias');

-- ========================================================
-- 8. Configuración de Telemetría (sapi_telemetry)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.sapi_telemetry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text,
    user_name text,
    user_role text,
    action text,
    details jsonb,
    timestamp timestamptz DEFAULT now(),
    user_agent text
);

ALTER TABLE public.sapi_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir insert de telemetria a todos" ON public.sapi_telemetry;
CREATE POLICY "Permitir insert de telemetria a todos" ON public.sapi_telemetry 
FOR INSERT TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir select de telemetria a admins y superadmins" ON public.sapi_telemetry;
CREATE POLICY "Permitir select de telemetria a admins y superadmins" ON public.sapi_telemetry 
FOR SELECT TO authenticated 
USING (public.get_my_role() IN ('superadmin', 'admin'));

-- 9. Configuración de tabla de Pedidos SAP (pedidos_sap)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.pedidos_sap (
    numero_pedido TEXT PRIMARY KEY,
    fecha TIMESTAMP WITH TIME ZONE,
    fecha_entrega TIMESTAMP WITH TIME ZONE,
    monto NUMERIC,
    moneda TEXT,
    cliente_id TEXT,
    cliente_nombre TEXT,
    vendedor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pedidos_sap ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a autenticados en pedidos" ON public.pedidos_sap;
CREATE POLICY "Permitir todo a autenticados en pedidos" ON public.pedidos_sap FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir select a publico en pedidos" ON public.pedidos_sap;
CREATE POLICY "Permitir select a publico en pedidos" ON public.pedidos_sap FOR SELECT TO public USING (true);

-- 10. Configuración de Políticas para Refacciones y Sitios
-- ========================================================
ALTER TABLE public.refacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sitios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select a publico en refacciones" ON public.refacciones;
CREATE POLICY "Permitir select a publico en refacciones" ON public.refacciones FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir select a publico en sitios" ON public.sitios;
CREATE POLICY "Permitir select a publico en sitios" ON public.sitios FOR SELECT TO public USING (true);
