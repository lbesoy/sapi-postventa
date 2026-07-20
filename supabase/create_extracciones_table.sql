-- ==========================================
-- EUROREP CRM - MIGRATION: PDF EXTRACCIONES AI
-- ==========================================

-- 1. Crear tabla para guardar el historial de datos extraídos por IA
CREATE TABLE IF NOT EXISTS public.pdf_extracciones_ai (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT, -- Referencia opcional al ticket de servicio
    folio_sap TEXT,
    monto_total NUMERIC,
    cliente TEXT,
    ruta_servicio TEXT,
    conceptos JSONB DEFAULT '[]'::jsonb,
    extras JSONB DEFAULT '[]'::jsonb,
    origen_datos TEXT, -- Ej. 'Nombre de Archivo + SAP', 'Catálogo SAP', 'PDF AI'
    fecha_extraccion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar seguridad a nivel de fila (RLS)
ALTER TABLE public.pdf_extracciones_ai ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas para permitir operaciones
CREATE POLICY "Permitir todo a autenticados" ON public.pdf_extracciones_ai FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir insercion publica o anonima" ON public.pdf_extracciones_ai FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir select a publico" ON public.pdf_extracciones_ai FOR SELECT USING (true);
