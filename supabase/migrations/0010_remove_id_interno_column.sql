-- 0010_remove_id_interno_column.sql
-- Migración para eliminar la columna redundante id_interno de la tabla public.maquinaria.
-- Puesto que ahora la clave primaria 'id' almacena directamente y de forma segura el ID de negocio/interno,
-- la columna 'id_interno' es obsoleta y se remueve para eliminar redundancias físicas en Supabase.

BEGIN;

-- 1. Eliminar la columna física
ALTER TABLE public.maquinaria DROP COLUMN IF EXISTS id_interno;

COMMIT;
