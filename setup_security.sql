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

-- 2.5 Limpiar políticas previas para evitar conflictos de duplicación al re-ejecutar el script
DROP POLICY IF EXISTS "Admins full access ordenes" ON public.ordenes;
DROP POLICY IF EXISTS "Admins y Supervisores full access ordenes" ON public.ordenes;
DROP POLICY IF EXISTS "Técnicos pueden ver sus órdenes" ON public.ordenes;
DROP POLICY IF EXISTS "Técnicos pueden editar sus órdenes" ON public.ordenes;
DROP POLICY IF EXISTS "Consulta read access ordenes" ON public.ordenes;

DROP POLICY IF EXISTS "Admins full access tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins y Supervisores full access tickets" ON public.tickets;
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
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
);

CREATE POLICY "Admins y Supervisores full access tickets" ON public.tickets FOR ALL TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
);

CREATE POLICY "Admins y Supervisores full access clientes" ON public.clientes FOR ALL TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
);

CREATE POLICY "Admins y Supervisores full access maquinaria" ON public.maquinaria FOR ALL TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor', 'tecnico')
) WITH CHECK (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor', 'tecnico')
);
CREATE POLICY "Admins insert user_roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin')
);

CREATE POLICY "Admins update user_roles" ON public.user_roles FOR UPDATE TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin')
) WITH CHECK (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin')
);

CREATE POLICY "Admins delete user_roles" ON public.user_roles FOR DELETE TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin')
);

CREATE POLICY "Consulta y Tecnicos read access clientes" ON public.clientes FOR SELECT TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('tecnico', 'consulta', 'empresa', 'supervisor')
);

CREATE POLICY "Consulta y Tecnicos read access maquinaria" ON public.maquinaria FOR SELECT TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('tecnico', 'consulta', 'empresa', 'supervisor')
);

CREATE POLICY "Consulta y Tecnicos read access tickets" ON public.tickets FOR SELECT TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('tecnico', 'consulta', 'empresa', 'supervisor')
);

-- 5. Crear Políticas para Técnicos y Consulta sobre Órdenes de Servicio
CREATE POLICY "Técnicos pueden ver sus órdenes" ON public.ordenes FOR SELECT TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) = 'tecnico' AND
  tecnico = (SELECT nombre FROM public.user_roles WHERE id = auth.uid())
);

CREATE POLICY "Técnicos pueden editar sus órdenes" ON public.ordenes FOR UPDATE TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) = 'tecnico' AND
  tecnico = (SELECT nombre FROM public.user_roles WHERE id = auth.uid())
);

CREATE POLICY "Consulta read access ordenes" ON public.ordenes FOR SELECT TO authenticated USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) = 'consulta'
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
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.calendario_eventos;
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.clara_transactions;
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.clara_cards;
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.facturas_analizadas;
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.facturas_conciliadas;
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.auditoria_logs;

-- Crear políticas universales para usuarios autenticados
CREATE POLICY "Permitir todo a autenticados" ON public.gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a autenticados" ON public.calendario_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a autenticados" ON public.clara_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a autenticados" ON public.clara_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a autenticados" ON public.facturas_analizadas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a autenticados" ON public.facturas_conciliadas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a autenticados" ON public.auditoria_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========================================================
-- 7. Configuración de Storage Bucket (evidencias)
-- ========================================================

-- Crear el bucket "evidencias" si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

-- Asegurar RLS en objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas de storage para evitar duplicación
DROP POLICY IF EXISTS "Permitir subidas a todo el crm" ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura publica" ON storage.objects;

-- Crear políticas de storage
CREATE POLICY "Permitir subidas a todo el crm" 
ON storage.objects 
FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'evidencias');

CREATE POLICY "Permitir lectura publica" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'evidencias');
