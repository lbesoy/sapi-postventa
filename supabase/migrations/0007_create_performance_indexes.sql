-- ========================================================
-- MIGRATION 0007: CREACIÓN DE ÍNDICES DE RENDIMIENTO (PERFORMANCE INDEXES)
-- ========================================================

-- 1. Índices para la tabla public.ordenes
CREATE INDEX IF NOT EXISTS idx_ordenes_tecnico ON public.ordenes(tecnico);
CREATE INDEX IF NOT EXISTS idx_ordenes_cliente ON public.ordenes(cliente);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON public.ordenes(estado);

-- 2. Índices para la tabla public.tickets
CREATE INDEX IF NOT EXISTS idx_tickets_cliente ON public.tickets(cliente);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON public.tickets(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_asignado ON public.tickets(asignado);

-- 3. Índices para la tabla public.maquinaria
CREATE INDEX IF NOT EXISTS idx_maquinaria_cliente ON public.maquinaria(cliente);
CREATE INDEX IF NOT EXISTS idx_maquinaria_serie ON public.maquinaria(serie);
