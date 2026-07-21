-- Migration: Create levantamientos table
-- Purpose: Adds the levantamientos table for the new inspection visits flow

CREATE TABLE IF NOT EXISTS public.levantamientos (
    id TEXT PRIMARY KEY,
    folio TEXT NOT NULL UNIQUE,
    cliente TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
    sitio TEXT REFERENCES public.sitios(id) ON DELETE SET NULL,
    maquina TEXT REFERENCES public.maquinaria(id) ON DELETE SET NULL,
    solicitante TEXT,
    descripcion TEXT,
    fecha_esperada TIMESTAMP WITH TIME ZONE,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    tecnico_asignado TEXT,
    notas_tecnico TEXT,
    evidencias JSONB DEFAULT '{}'::jsonb,
    ticket_generado_id TEXT REFERENCES public.tickets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.levantamientos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Permitir select a usuarios autenticados en levantamientos" ON public.levantamientos;
DROP POLICY IF EXISTS "Permitir insert a usuarios autenticados en levantamientos" ON public.levantamientos;
DROP POLICY IF EXISTS "Permitir update a usuarios autenticados en levantamientos" ON public.levantamientos;
DROP POLICY IF EXISTS "Permitir delete a usuarios autenticados en levantamientos" ON public.levantamientos;

-- Create policies for authenticated users
CREATE POLICY "Permitir select a usuarios autenticados en levantamientos"
    ON public.levantamientos FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir insert a usuarios autenticados en levantamientos"
    ON public.levantamientos FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir update a usuarios autenticados en levantamientos"
    ON public.levantamientos FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir delete a usuarios autenticados en levantamientos"
    ON public.levantamientos FOR DELETE
    USING (auth.role() = 'authenticated');

-- Trigger to automatically update updated_at column (optional but good practice)
-- Assuming the function update_modified_column() exists, if not we skip it. 
-- In Eurorep it seems they rely on app logic for dates, so I won't add a trigger to keep it consistent with other tables.
