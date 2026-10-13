-- ==============================================================================
-- MIGRATION 0046: OPTIMIZACIÓN DE ÍNDICES CRÍTICOS EN TICKETS Y ÓRDENES
-- ==============================================================================
-- Propósito:
-- 1. Acelerar ordenamientos cronológicos descendentes (created_at DESC).
-- 2. Optimizar filtros frecuentes por estatus, folio, cliente y técnico.
-- 3. Prevenir table scans secuenciales costosos en PostgREST / PostgreSQL.
-- ==============================================================================

-- 1. ÍNDICES PARA LA TABLA: public.tickets
-- Índice descendente para listado y paginación ordenada por fecha
CREATE INDEX IF NOT EXISTS idx_tickets_created_at_desc ON public.tickets (created_at DESC);

-- Índice para búsquedas exactas por folio (TKT-XXXXX)
CREATE INDEX IF NOT EXISTS idx_tickets_folio ON public.tickets (folio);

-- Índice para conteos rápidos de estado (KPIs de abiertos, refacciones, etc.)
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON public.tickets (estado);

-- Índice compuesto para consultas filtradas por estado y ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_tickets_estado_created ON public.tickets (estado, created_at DESC);

-- Índice para filtrado de tickets por cliente
CREATE INDEX IF NOT EXISTS idx_tickets_cliente ON public.tickets (cliente);

-- 2. ÍNDICES PARA LA TABLA: public.ordenes
-- Índice descendente para listado de órdenes ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_ordenes_created_at_desc ON public.ordenes (created_at DESC);

-- Índice para búsquedas rápidas por folio de orden (OS-XXXXX)
CREATE INDEX IF NOT EXISTS idx_ordenes_folio ON public.ordenes (folio);

-- Índice compuesto de estado y fecha para órdenes de servicio
CREATE INDEX IF NOT EXISTS idx_ordenes_estado_created ON public.ordenes (estado, created_at DESC);
