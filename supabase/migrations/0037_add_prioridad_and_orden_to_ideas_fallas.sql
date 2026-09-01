-- Migration 0037: Add 'prioridad' and 'orden' columns to 'ideas_fallas' table
-- Purpose: Support prioritization and drag-and-drop ordering in Ideas y Fallas module

ALTER TABLE public.ideas_fallas 
ADD COLUMN IF NOT EXISTS prioridad TEXT NOT NULL DEFAULT 'Media';

ALTER TABLE public.ideas_fallas 
ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0;

-- Create index on orden for efficient ordering
CREATE INDEX IF NOT EXISTS idx_ideas_fallas_orden ON public.ideas_fallas (orden);
