-- ========================================================
-- MIGRATION 0017: CREATE FACTURAS_ANALIZADAS TABLE
-- ========================================================

CREATE TABLE IF NOT EXISTS public.facturas_analizadas (
    id TEXT PRIMARY KEY, -- ID del elemento en OneDrive
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'xml' o 'pdf'
    rfc_emisor TEXT,
    nombre_emisor TEXT,
    uuid_xml TEXT,
    total NUMERIC(12,2) DEFAULT 0,
    fecha_emision TEXT,
    base64_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.facturas_analizadas ENABLE ROW LEVEL SECURITY;

-- Crear políticas públicas para lectura y escritura desde la aplicación cliente
CREATE POLICY "Allow public select" ON public.facturas_analizadas
    FOR SELECT USING (true);

CREATE POLICY "Allow public all" ON public.facturas_analizadas
    FOR ALL USING (true);
