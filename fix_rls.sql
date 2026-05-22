-- =========================================================================
-- SOLUCIÓN DE SEGURIDAD / RLS PARA LA TABLA USER_ROLES EN SUPABASE
-- Ejecuta una de las siguientes opciones en el SQL Editor de tu consola Supabase.
-- =========================================================================

-- OPCIÓN 1 (Recomendada y más sencilla): 
-- Desactiva el Row Level Security (RLS) en la tabla user_roles.
-- Dado que esta tabla no contiene contraseñas ni PINs, y solo sirve para saber 
-- el rol de cada usuario y listarlos en la aplicación, desactivar RLS es seguro 
-- y permite al selector de usuarios ("Cambiar Usuario") funcionar sin problemas para todos.

ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────


-- OPCIÓN 2 (Si prefieres mantener RLS activado en user_roles):
-- Si quieres conservar RLS, ejecuta las siguientes sentencias para eliminar 
-- las políticas anteriores con recursividad infinita y configurar accesos correctos.

/*
-- 1. Limpiar políticas anteriores en user_roles
DROP POLICY IF EXISTS "Admins full access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios pueden leer su propio rol" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public select on user_roles" ON public.user_roles;

-- 2. Crear una política para lectura pública (SELECT)
-- Esto permite que cualquier usuario pueda ver la lista de nombres y roles para el modal "Cambiar Usuario"
CREATE POLICY "Allow public select on user_roles" 
  ON public.user_roles 
  FOR SELECT 
  USING (true);

-- 3. Crear una función auxiliar SECURITY DEFINER para verificar si el usuario es administrador
-- Esto evita la recursividad infinita (stack overflow) al evaluar la política de escritura
CREATE OR REPLACE FUNCTION public.is_admin_check(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = user_id AND rol IN ('superadmin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear política para escritura/administración completa en user_roles
CREATE POLICY "Admins write access user_roles" 
  ON public.user_roles 
  FOR ALL 
  USING (public.is_admin_check(auth.uid()))
  WITH CHECK (public.is_admin_check(auth.uid()));
*/
