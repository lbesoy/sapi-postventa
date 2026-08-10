-- Migration: Fix user roles registration fields
-- Purpose: Ensures user_roles table has email, telefono, and empresa columns, and updates trigger to copy them on signup.

-- 1. Ensure columns exist
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS telefono text;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS empresa text;

-- 2. Update the handle_new_user trigger function to copy fields
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (id, nombre, email, telefono, rol, empresa, activo)
  VALUES (
    new.id, 
    coalesce(new.raw_user_meta_data->>'nombre', ''), 
    new.email, 
    coalesce(new.phone, new.raw_user_meta_data->>'telefono', ''),
    coalesce(new.raw_user_meta_data->>'rol', 'consulta'), 
    new.raw_user_meta_data->>'empresa', 
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    telefono = EXCLUDED.telefono,
    rol = EXCLUDED.rol,
    empresa = EXCLUDED.empresa;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
