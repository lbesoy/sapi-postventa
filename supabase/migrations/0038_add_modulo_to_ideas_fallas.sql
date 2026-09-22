-- Migration 0038: Add 'modulo' column to 'ideas_fallas' table
-- Purpose: Support tagging ideas and bugs by system module (Tickets, Órdenes, Clientes, Gastos, etc.)

ALTER TABLE public.ideas_fallas 
ADD COLUMN IF NOT EXISTS modulo TEXT DEFAULT 'General';

-- Add index on modulo for fast filtering
CREATE INDEX IF NOT EXISTS idx_ideas_fallas_modulo ON public.ideas_fallas (modulo);
