-- 0020_link_maquinaria_to_sitios.sql
-- Migración para añadir la columna sitio_id a la tabla public.maquinaria
-- y vincular formalmente la maquinaria con los sitios registrados.

BEGIN;

-- 1. Añadir la columna de clave foránea a la tabla de maquinaria
ALTER TABLE public.maquinaria 
  ADD COLUMN IF NOT EXISTS sitio_id TEXT;

-- 2. Crear la restricción de clave foránea referenciando a la tabla public.sitios
ALTER TABLE public.maquinaria
  DROP CONSTRAINT IF EXISTS fk_maquinaria_sitio;

ALTER TABLE public.maquinaria
  ADD CONSTRAINT fk_maquinaria_sitio
  FOREIGN KEY (sitio_id) 
  REFERENCES public.sitios(id)
  ON DELETE SET NULL;

-- 3. Migrar registros de maquinaria existentes vinculándolos a sitios por nombre/ubicación
UPDATE public.maquinaria m
SET sitio_id = s.id
FROM public.sitios s
WHERE s.cliente = m.cliente
  AND (
    s.nombre = m.ubicacion 
    OR s.nombre = (m.custom_data->>'ubicacion')
    OR s.direccion = m.ubicacion
    OR s.direccion = (m.custom_data->>'ubicacion')
  );

COMMIT;
