-- Migration: 0043_add_fecha_modificacion_to_tickets.sql
-- Description: Add fecha_modificacion and updated_at columns to public.tickets and setup auto-update trigger

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS fecha_modificacion TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Backfill fecha_modificacion and updated_at for existing tickets
UPDATE public.tickets 
SET 
  fecha_modificacion = COALESCE(fecha_creacion, created_at, NOW()),
  updated_at = COALESCE(fecha_creacion, created_at, NOW())
WHERE fecha_modificacion IS NULL OR updated_at IS NULL;

-- Trigger function to automatically update timestamps on tickets table
CREATE OR REPLACE FUNCTION public.update_tickets_modificacion_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_modificacion = COALESCE(NEW.fecha_modificacion, NOW());
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_tickets_modificacion ON public.tickets;
CREATE TRIGGER trg_update_tickets_modificacion
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_tickets_modificacion_timestamp();

-- Create index for fast sorting and filtering by last modification date
CREATE INDEX IF NOT EXISTS idx_tickets_fecha_modificacion ON public.tickets(fecha_modificacion DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON public.tickets(updated_at DESC);
