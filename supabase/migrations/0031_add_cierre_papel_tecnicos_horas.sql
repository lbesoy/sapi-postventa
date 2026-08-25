-- Migration: Add paper closure technicians and hours field to public.ordenes table
-- Purpose: Support recording technicians who worked on the order and their hours during paper closure

ALTER TABLE public.ordenes 
ADD COLUMN IF NOT EXISTS cierre_papel_tecnicos_horas JSONB;

COMMENT ON COLUMN public.ordenes.cierre_papel_tecnicos_horas IS 'JSON array of objects containing technician name and hours worked (e.g. [{"tecnico": "Name", "horas": 8.5}])';
