BEGIN;

-- 1. Actualizar las claves foráneas en las tablas hijas antes de cambiar la clave primaria,
-- mapeando del id UUID viejo al id_interno limpio de la maquinaria correspondiente.
UPDATE public.ordenes o
SET maquinaria_id = COALESCE(NULLIF(m.id_interno, ''), NULLIF(m.id_interno, 'NA'), NULLIF(m.id_interno, 'N/A'), m.serie, m.id)
FROM public.maquinaria m
WHERE o.maquinaria_id = m.id;

UPDATE public.maquinaria_horometros h
SET maquinaria_id = COALESCE(NULLIF(m.id_interno, ''), NULLIF(m.id_interno, 'NA'), NULLIF(m.id_interno, 'N/A'), m.serie, m.id)
FROM public.maquinaria m
WHERE h.maquinaria_id = m.id;

-- 2. Eliminar temporalmente las restricciones de clave foránea en las tablas hijas para permitir alterar la clave primaria
ALTER TABLE public.ordenes DROP CONSTRAINT IF EXISTS ordenes_maquinaria_id_fkey;
ALTER TABLE public.maquinaria_horometros DROP CONSTRAINT IF EXISTS maquinaria_horometros_maquinaria_id_fkey;

-- 3. Actualizar la columna 'id' de la tabla 'maquinaria' para que contenga el ID interno/Serie en lugar del UUID
UPDATE public.maquinaria
SET id = COALESCE(NULLIF(id_interno, ''), NULLIF(id_interno, 'NA'), NULLIF(id_interno, 'N/A'), serie, id);

-- 4. Volver a añadir las restricciones de clave foránea apuntando al nuevo ID (que ahora es el ID Interno limpio)
ALTER TABLE public.ordenes 
ADD CONSTRAINT ordenes_maquinaria_id_fkey 
FOREIGN KEY (maquinaria_id) REFERENCES public.maquinaria(id) ON DELETE SET NULL;

ALTER TABLE public.maquinaria_horometros 
ADD CONSTRAINT maquinaria_horometros_maquinaria_id_fkey 
FOREIGN KEY (maquinaria_id) REFERENCES public.maquinaria(id) ON DELETE CASCADE;

COMMIT;
