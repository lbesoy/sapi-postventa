-- Migration: 0044_add_modificado_por_to_tickets.sql
-- Description: Add modificado_por column to public.tickets and backfill with creado_por/solicitante

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS modificado_por TEXT;

-- Backfill modificado_por for existing tickets
UPDATE public.tickets 
SET modificado_por = COALESCE(creado_por, solicitante, 'Usuario')
WHERE modificado_por IS NULL;

-- Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_tickets_modificado_por ON public.tickets(modificado_por);
