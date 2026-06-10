-- ========================================================
-- MIGRATION 0018: CREATE FACTURAS_CONCILIADAS TABLE
-- ========================================================

CREATE TABLE IF NOT EXISTS public.facturas_conciliadas (
    id TEXT PRIMARY KEY, -- ID del elemento en OneDrive (o UUID de CFDI si es manual)
    gasto_id TEXT REFERENCES public.gastos(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
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
    base64_content TEXT,
    pdf_content TEXT,
    fecha_vinculacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.facturas_conciliadas ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas si ya existen para evitar errores al volver a correr el script
DROP POLICY IF EXISTS "Allow public select" ON public.facturas_conciliadas;
DROP POLICY IF EXISTS "Allow public all" ON public.facturas_conciliadas;

-- Crear políticas públicas para lectura y escritura desde la aplicación cliente
CREATE POLICY "Allow public select" ON public.facturas_conciliadas
    FOR SELECT USING (true);

CREATE POLICY "Allow public all" ON public.facturas_conciliadas
    FOR ALL USING (true);
