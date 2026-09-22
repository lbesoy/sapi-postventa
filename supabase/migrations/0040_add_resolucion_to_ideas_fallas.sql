-- Migration 0040: Add 'resolucion', 'resuelto_por', and 'fecha_resolucion' columns to 'ideas_fallas' table
-- Purpose: Store solution explanations, conclusions, author and resolution timestamps for completed ideas and bugs

ALTER TABLE public.ideas_fallas 
ADD COLUMN IF NOT EXISTS resolucion TEXT,
ADD COLUMN IF NOT EXISTS resuelto_por TEXT,
ADD COLUMN IF NOT EXISTS fecha_resolucion TIMESTAMP WITH TIME ZONE;
