-- Migration: 0035_create_fusionar_maquinarias_fn.sql
-- Description: Create PL/pgSQL function to merge two machinery records atomically.

CREATE OR REPLACE FUNCTION public.fusionar_maquinarias(
  maquina_origen_id TEXT,
  maquina_destino_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to ensure clean updates and deletions
AS $$
BEGIN
  -- 1. Validar que el usuario sea superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE id = auth.uid() AND rol = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: Solo los Super Administradores pueden fusionar maquinarias.';
  END IF;

  -- 2. Validar que las maquinarias existan y no sean la misma
  IF maquina_origen_id = maquina_destino_id THEN
    RAISE EXCEPTION 'La máquina origen y destino no pueden ser la misma.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.maquinaria WHERE id = maquina_origen_id) THEN
    RAISE EXCEPTION 'La máquina duplicada (origen) no existe.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.maquinaria WHERE id = maquina_destino_id) THEN
    RAISE EXCEPTION 'La máquina principal (destino) no existe.';
  END IF;

  -- 3. Actualizar relaciones en la tabla ordenes
  UPDATE public.ordenes
  SET maquinaria_id = maquina_destino_id
  WHERE maquinaria_id = maquina_origen_id;

  -- 4. Actualizar relaciones en la tabla maquinaria_horometros
  UPDATE public.maquinaria_horometros
  SET maquinaria_id = maquina_destino_id
  WHERE maquinaria_id = maquina_origen_id;

  -- 5. Actualizar relaciones en la tabla levantamientos
  UPDATE public.levantamientos
  SET maquina = maquina_destino_id
  WHERE maquina = maquina_origen_id;

  -- 6. Eliminar la máquina duplicada
  DELETE FROM public.maquinaria
  WHERE id = maquina_origen_id;
END;
$$;
