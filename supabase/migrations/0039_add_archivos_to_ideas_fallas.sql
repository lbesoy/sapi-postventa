-- Migration 0039: Add 'archivos' column to 'ideas_fallas' table
-- Purpose: Support storing attached files and images (screenshots, PDFs, documents) for ideas and bugs

ALTER TABLE public.ideas_fallas 
ADD COLUMN IF NOT EXISTS archivos JSONB DEFAULT '[]'::jsonb;
