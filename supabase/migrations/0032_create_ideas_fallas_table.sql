-- Migration: Create ideas_fallas table
-- Purpose: Adds the ideas_fallas table for improvements and bug reporting in EuroRep config panel

CREATE TABLE IF NOT EXISTS public.ideas_fallas (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL, -- 'Idea' o 'Falla'
    titulo TEXT NOT NULL,
    descripcion TEXT,
    estado TEXT NOT NULL DEFAULT 'Pendiente', -- 'Pendiente', 'En Progreso', 'Resuelto', 'Rechazado'
    creado_por TEXT,
    creado_por_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ideas_fallas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Permitir select a usuarios autenticados en ideas_fallas" ON public.ideas_fallas;
DROP POLICY IF EXISTS "Permitir insert a usuarios autenticados en ideas_fallas" ON public.ideas_fallas;
DROP POLICY IF EXISTS "Permitir update a usuarios autenticados en ideas_fallas" ON public.ideas_fallas;
DROP POLICY IF EXISTS "Permitir delete a usuarios autenticados en ideas_fallas" ON public.ideas_fallas;

-- Create policies for authenticated users
CREATE POLICY "Permitir select a usuarios autenticados en ideas_fallas"
    ON public.ideas_fallas FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir insert a usuarios autenticados en ideas_fallas"
    ON public.ideas_fallas FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir update a usuarios autenticados en ideas_fallas"
    ON public.ideas_fallas FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir delete a usuarios autenticados en ideas_fallas"
    ON public.ideas_fallas FOR DELETE
    USING (auth.role() = 'authenticated');
