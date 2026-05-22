ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS empresa text;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (id, nombre, email, rol, activo)
  VALUES (new.id, new.raw_user_meta_data->>'nombre', new.email, 'consulta', false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
