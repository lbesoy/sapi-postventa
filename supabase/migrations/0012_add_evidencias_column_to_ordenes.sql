-- ========================================================
-- MIGRATION 0012: AGREGAR COLUMNA DE EVIDENCIAS EN ORDENES
-- ========================================================

-- Agregar columna "evidencias" de tipo JSONB a la tabla public.ordenes si no existe
ALTER TABLE public.ordenes 
ADD COLUMN IF NOT EXISTS evidencias JSONB DEFAULT '{}'::jsonb;

-- Comentario descriptivo de la columna para auditoría
COMMENT ON COLUMN public.ordenes.evidencias IS 'Almacena las URLs de las evidencias fotográficas de entrada (fotoInicio), salida (fotoFin) y adicionales cargadas en el Storage de Supabase.';
