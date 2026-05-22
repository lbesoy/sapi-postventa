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

-- 3. Crear Políticas (Policies) para Administradores (Pueden ver y hacer todo)
CREATE POLICY "Admins full access ordenes" ON public.ordenes FOR ALL USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin')
);
CREATE POLICY "Admins full access tickets" ON public.tickets FOR ALL USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin')
);
CREATE POLICY "Admins full access clientes" ON public.clientes FOR ALL USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin')
);
CREATE POLICY "Admins full access maquinaria" ON public.maquinaria FOR ALL USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin')
);
CREATE POLICY "Admins full access user_roles" ON public.user_roles FOR ALL USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin')
);

-- 4. Crear Políticas para Técnicos (Solo pueden ver y modificar SUS órdenes)
CREATE POLICY "Técnicos pueden ver sus órdenes" ON public.ordenes FOR SELECT USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) = 'tecnico' AND
  tecnico = (SELECT nombre FROM public.user_roles WHERE id = auth.uid())
);
CREATE POLICY "Técnicos pueden editar sus órdenes" ON public.ordenes FOR UPDATE USING (
  (SELECT rol FROM public.user_roles WHERE id = auth.uid()) = 'tecnico' AND
  tecnico = (SELECT nombre FROM public.user_roles WHERE id = auth.uid())
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

-- Permitir a los usuarios leer su propio rol
CREATE POLICY "Usuarios pueden leer su propio rol" ON public.user_roles FOR SELECT USING (
  id = auth.uid()
);
