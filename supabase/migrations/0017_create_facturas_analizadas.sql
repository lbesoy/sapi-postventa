-- ========================================================
-- MIGRATION 0017: CREATE FACTURAS_ANALIZADAS TABLE
-- ========================================================

CREATE TABLE IF NOT EXISTS public.facturas_analizadas (
    id TEXT PRIMARY KEY, -- ID del elemento en OneDrive (o UUID de CFDI si es manual)
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'xml' o 'pdf'
    
    -- Campos extraídos del XML/PDF SAT (27 campos)
    version_cfdi TEXT,
    uuid TEXT, -- Folio Fiscal UUID
    estatus TEXT,
    fecha_cancelacion TEXT,
    tipo_comprobante TEXT,
    fecha_emision TEXT,
    ano_emision TEXT,
    mes_emision TEXT,
    dia_emision TEXT,
    fecha_timbrado TEXT,
    serie TEXT,
    folio TEXT,
    forma_pago TEXT,
    metodo_pago TEXT,
    condiciones_pago TEXT,
    rfc_emisor TEXT,
    nombre_emisor TEXT,
    rfc_receptor TEXT,
    nombre_receptor TEXT,
    moneda TEXT,
    tipo_cambio TEXT,
    subtotal NUMERIC(12,2) DEFAULT 0,
    descuento NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    isr_retenido NUMERIC(12,2) DEFAULT 0,
    iva_retenido NUMERIC(12,2) DEFAULT 0,
    iva_trasladado NUMERIC(12,2) DEFAULT 0,

    base64_content TEXT, -- Contenido XML o PDF principal
    pdf_content TEXT,    -- Contenido PDF ligado (si el principal es XML)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.facturas_analizadas ENABLE ROW LEVEL SECURITY;

-- Crear políticas públicas para lectura y escritura desde la aplicación cliente
CREATE POLICY "Allow public select" ON public.facturas_analizadas
    FOR SELECT USING (true);

CREATE POLICY "Allow public all" ON public.facturas_analizadas
    FOR ALL USING (true);
