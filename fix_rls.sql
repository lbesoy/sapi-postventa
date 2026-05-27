-- =========================================================================
-- CONFIGURACIÓN DE SEGURIDAD SECURE RLS PARA LA TABLA USER_ROLES EN SUPABASE
-- Ejecuta este script en el SQL Editor de tu consola de Supabase para establecer
-- un control de acceso robusto basado en roles.
-- =========================================================================

-- 1. Garantizar que Row Level Security (RLS) esté activo en la tabla user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas previas en user_roles para evitar duplicados o conflictos
DROP POLICY IF EXISTS "Admins full access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios pueden leer su propio rol" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public select on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins write access user_roles" ON public.user_roles;

-- 3. Crear una política que permite a cualquier usuario autenticado consultar la lista de roles
-- Esto es necesario para que el selector de la interfaz ("Cambiar Usuario") pueda cargar los perfiles
CREATE POLICY "Allow select on user_roles to authenticated" 
  ON public.user_roles 
  FOR SELECT 
  TO authenticated
  USING (true);

-- 4. Crear una función auxiliar SECURITY DEFINER para comprobar privilegios de administrador
-- Al ejecutarse con privilegios del creador (SECURITY DEFINER), evita problemas de recursividad
-- infinita (infinite stack depth) al verificar políticas sobre la misma tabla
CREATE OR REPLACE FUNCTION public.is_admin_check(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = user_id AND rol IN ('superadmin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear la política de acceso completo (escritura/administración) para superadmins y admins
CREATE POLICY "Admins full access user_roles" 
  ON public.user_roles 
  FOR ALL 
  TO authenticated
  USING (public.is_admin_check(auth.uid()))
  WITH CHECK (public.is_admin_check(auth.uid()));
