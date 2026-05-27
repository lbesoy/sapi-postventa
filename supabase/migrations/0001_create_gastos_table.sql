-- ========================================================
-- MIGRATION 0001: CREAR TABLA DE GASTOS CON COLUMNA SAT_DATA
-- ========================================================

CREATE TABLE IF NOT EXISTS public.gastos (
    id TEXT PRIMARY KEY,
    usuario_id TEXT,
    fecha TEXT,
    categoria TEXT,
    descripcion TEXT,
    monto NUMERIC NOT NULL DEFAULT 0,
    metodo_pago TEXT,
    clara_tx_id TEXT,
    clara_merchant TEXT,
    clara_card_last4 TEXT,
    orden_folio TEXT,
    uuid_fiscal TEXT,
    rfc_emisor TEXT,
    pdf_factura TEXT,
    xml_factura TEXT,
    evidencia TEXT,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    comentarios_aprobacion TEXT,
    es_prueba BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sat_data JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS initially (will be enabled in step 0004)
ALTER TABLE public.gastos DISABLE ROW LEVEL SECURITY;
