-- Migration 0013: Add fecha_cierre column to public.tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMP WITH TIME ZONE;
