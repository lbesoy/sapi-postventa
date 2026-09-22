-- ========================================================
-- MIGRATION 0041: CREACIÓN DE ÍNDICES ADICIONALES DE RENDIMIENTO
-- ========================================================

-- 1. Índice por fecha en public.ordenes
CREATE INDEX IF NOT EXISTS idx_ordenes_created_at ON public.ordenes(created_at);

-- 2. Índices para filtrado de tickets por categoría y fecha
CREATE INDEX IF NOT EXISTS idx_tickets_categoria ON public.tickets(categoria);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at);

-- 3. Índices para consultas de roles de usuario
CREATE INDEX IF NOT EXISTS idx_user_roles_activo ON public.user_roles(activo);
