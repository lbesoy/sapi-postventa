-- ========================================================
-- MIGRATION 0019: CREAR TABLAS GASTOS_APROBADOS Y GASTOS_RECHAZADOS
-- ========================================================

CREATE TABLE IF NOT EXISTS public.gastos_aprobados (
    id TEXT PRIMARY KEY,
    usuario_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
    fecha TIMESTAMP WITH TIME ZONE,
    categoria TEXT,
    descripcion TEXT,
    monto NUMERIC NOT NULL DEFAULT 0,
    metodo_pago TEXT,
    clara_tx_id TEXT,
    clara_merchant TEXT,
    clara_card_last4 TEXT,
    orden_id TEXT REFERENCES public.ordenes(id) ON DELETE SET NULL,
    uuid_fiscal TEXT,
    rfc_emisor TEXT,
    pdf_factura TEXT,
    xml_factura TEXT,
    evidencia TEXT,
    estado TEXT NOT NULL DEFAULT 'Aprobado',
    comentarios_aprobacion TEXT,
    es_prueba BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sat_data JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gastos_rechazados (
    id TEXT PRIMARY KEY,
    usuario_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
    fecha TIMESTAMP WITH TIME ZONE,
    categoria TEXT,
    descripcion TEXT,
    monto NUMERIC NOT NULL DEFAULT 0,
    metodo_pago TEXT,
    clara_tx_id TEXT,
    clara_merchant TEXT,
    clara_card_last4 TEXT,
    orden_id TEXT REFERENCES public.ordenes(id) ON DELETE SET NULL,
    uuid_fiscal TEXT,
    rfc_emisor TEXT,
    pdf_factura TEXT,
    xml_factura TEXT,
    evidencia TEXT,
    estado TEXT NOT NULL DEFAULT 'Rechazado',
    comentarios_aprobacion TEXT,
    es_prueba BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sat_data JSONB DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS initially
ALTER TABLE public.gastos_aprobados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_rechazados DISABLE ROW LEVEL SECURITY;

-- Función de sincronización automática de estado
CREATE OR REPLACE FUNCTION public.sincronizar_gastos_estado()
RETURNS TRIGGER AS $$
BEGIN
    -- Eliminar de ambas tablas para evitar inconsistencias
    DELETE FROM public.gastos_aprobados WHERE id = NEW.id;
    DELETE FROM public.gastos_rechazados WHERE id = NEW.id;

    -- Insertar en la tabla según el estado correspondiente
    IF NEW.estado = 'Aprobado' THEN
        INSERT INTO public.gastos_aprobados (
            id, usuario_id, fecha, categoria, descripcion, monto, metodo_pago,
            clara_tx_id, clara_merchant, clara_card_last4, orden_id, uuid_fiscal,
            rfc_emisor, pdf_factura, xml_factura, evidencia, estado,
            comentarios_aprobacion, es_prueba, fecha_creacion, sat_data, created_at
        ) VALUES (
            NEW.id, NEW.usuario_id, NEW.fecha, NEW.categoria, NEW.descripcion, NEW.monto, NEW.metodo_pago,
            NEW.clara_tx_id, NEW.clara_merchant, NEW.clara_card_last4, NEW.orden_id, NEW.uuid_fiscal,
            NEW.rfc_emisor, NEW.pdf_factura, NEW.xml_factura, NEW.evidencia, NEW.estado,
            NEW.comentarios_aprobacion, NEW.es_prueba, NEW.fecha_creacion, NEW.sat_data, NEW.created_at
        );
    ELSIF NEW.estado = 'Rechazado' THEN
        INSERT INTO public.gastos_rechazados (
            id, usuario_id, fecha, categoria, descripcion, monto, metodo_pago,
            clara_tx_id, clara_merchant, clara_card_last4, orden_id, uuid_fiscal,
            rfc_emisor, pdf_factura, xml_factura, evidencia, estado,
            comentarios_aprobacion, es_prueba, fecha_creacion, sat_data, created_at
        ) VALUES (
            NEW.id, NEW.usuario_id, NEW.fecha, NEW.categoria, NEW.descripcion, NEW.monto, NEW.metodo_pago,
            NEW.clara_tx_id, NEW.clara_merchant, NEW.clara_card_last4, NEW.orden_id, NEW.uuid_fiscal,
            NEW.rfc_emisor, NEW.pdf_factura, NEW.xml_factura, NEW.evidencia, NEW.estado,
            NEW.comentarios_aprobacion, NEW.es_prueba, NEW.fecha_creacion, NEW.sat_data, NEW.created_at
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para Insertar/Actualizar
CREATE OR REPLACE TRIGGER trg_sincronizar_gastos_estado
AFTER INSERT OR UPDATE ON public.gastos
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_gastos_estado();

-- Función para manejar Borrados
CREATE OR REPLACE FUNCTION public.eliminar_gastos_estado()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.gastos_aprobados WHERE id = OLD.id;
    DELETE FROM public.gastos_rechazados WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger para Borrar
CREATE OR REPLACE TRIGGER trg_eliminar_gastos_estado
AFTER DELETE ON public.gastos
FOR EACH ROW
EXECUTE FUNCTION public.eliminar_gastos_estado();

-- Poblar datos preexistentes
INSERT INTO public.gastos_aprobados (
    id, usuario_id, fecha, categoria, descripcion, monto, metodo_pago,
    clara_tx_id, clara_merchant, clara_card_last4, orden_id, uuid_fiscal,
    rfc_emisor, pdf_factura, xml_factura, evidencia, estado,
    comentarios_aprobacion, es_prueba, fecha_creacion, sat_data, created_at
)
SELECT 
    id, usuario_id, fecha, categoria, descripcion, monto, metodo_pago,
    clara_tx_id, clara_merchant, clara_card_last4, orden_id, uuid_fiscal,
    rfc_emisor, pdf_factura, xml_factura, evidencia, estado,
    comentarios_aprobacion, es_prueba, fecha_creacion, sat_data, created_at
FROM public.gastos WHERE estado = 'Aprobado'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.gastos_rechazados (
    id, usuario_id, fecha, categoria, descripcion, monto, metodo_pago,
    clara_tx_id, clara_merchant, clara_card_last4, orden_id, uuid_fiscal,
    rfc_emisor, pdf_factura, xml_factura, evidencia, estado,
    comentarios_aprobacion, es_prueba, fecha_creacion, sat_data, created_at
)
SELECT 
    id, usuario_id, fecha, categoria, descripcion, monto, metodo_pago,
    clara_tx_id, clara_merchant, clara_card_last4, orden_id, uuid_fiscal,
    rfc_emisor, pdf_factura, xml_factura, evidencia, estado,
    comentarios_aprobacion, es_prueba, fecha_creacion, sat_data, created_at
FROM public.gastos WHERE estado = 'Rechazado'
ON CONFLICT (id) DO NOTHING;
