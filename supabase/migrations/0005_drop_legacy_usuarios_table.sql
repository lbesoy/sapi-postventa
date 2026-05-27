-- ========================================================
-- MIGRATION 0005: ELIMINAR TABLA LEGACY DE USUARIOS
-- ========================================================

-- Elimina la tabla public.usuarios histórica que ya no está en uso
DROP TABLE IF EXISTS public.usuarios CASCADE;
