-- =============================================================================
-- Migración 0048: Crear tabla estructurada de Servicios NO Preventivos y Bolsa de Horas
-- Soporte en sitio, correctivos en campo, bitácora diaria multimáquina y conciliación semanal
-- =============================================================================

-- 1. Asegurar columnas de Bolsa de Horas en la tabla de rentas
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rentas') THEN
        ALTER TABLE public.rentas ADD COLUMN IF NOT EXISTS bolsa_horas_total NUMERIC(10, 2) DEFAULT 50.0;
        ALTER TABLE public.rentas ADD COLUMN IF NOT EXISTS bolsa_tarifa_excedente NUMERIC(10, 2) DEFAULT 0.0;
        ALTER TABLE public.rentas ADD COLUMN IF NOT EXISTS bolsa_fecha_inicio DATE;
        ALTER TABLE public.rentas ADD COLUMN IF NOT EXISTS bolsa_notas TEXT;
    END IF;
END $$;

-- 2. Crear tabla de Servicios NO Preventivos
CREATE TABLE IF NOT EXISTS public.servicios_no_preventivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio TEXT NOT NULL UNIQUE,
    renta_id TEXT,
    renta_folio TEXT,
    cliente TEXT NOT NULL,
    sitio TEXT,
    equipo TEXT NOT NULL,
    serie TEXT,
    maquina_id TEXT,
    horometro NUMERIC(10, 2) DEFAULT 0,
    fecha_servicio DATE DEFAULT CURRENT_DATE NOT NULL,
    semana_ano TEXT NOT NULL, -- Formato ISO: YYYY-Www (Ej: 2026-W42)
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    horas_trabajadas NUMERIC(6, 2) DEFAULT 0 NOT NULL,
    tecnico_nombre TEXT NOT NULL,
    tecnico_id TEXT,
    tipo_trabajo TEXT DEFAULT 'Correctivo Mecanico' NOT NULL,
    sistema_afectado TEXT DEFAULT 'General',
    descripcion_falla TEXT NOT NULL,
    descripcion_trabajo TEXT,
    solucion_aplicada TEXT NOT NULL,
    estado_equipo TEXT DEFAULT 'Operativo' NOT NULL,
    refacciones JSONB DEFAULT '[]'::jsonb NOT NULL,
    monto_refacciones NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    evidencias JSONB DEFAULT '[]'::jsonb NOT NULL,
    firma_tecnico TEXT,
    firma_cliente TEXT,
    nombre_recibe TEXT,
    aplica_bolsa_horas BOOLEAN DEFAULT true NOT NULL,
    facturado_semanal BOOLEAN DEFAULT false NOT NULL,
    es_prueba BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Comentarios descriptivos de tabla y columnas
COMMENT ON TABLE public.servicios_no_preventivos IS 'Bitácora y soporte en sitio de técnicos por maquinaria en proyectos de renta con deducción de bolsa de horas';
COMMENT ON COLUMN public.servicios_no_preventivos.folio IS 'Folio único del servicio (ej. SNP-2026-0001 o SNP-PRUEBA-2026-0001)';
COMMENT ON COLUMN public.servicios_no_preventivos.semana_ano IS 'Semana ISO para corte semanal y facturación (ej. 2026-W42)';
COMMENT ON COLUMN public.servicios_no_preventivos.aplica_bolsa_horas IS 'Indica si las horas de la intervención se descuentan del paquete contratado';
COMMENT ON COLUMN public.servicios_no_preventivos.refacciones IS 'Detalle de refacciones e insumos utilizados [{clave, descripcion, cantidad, unidad, costo_unitario, subtotal, pagado_por}]';

-- 4. Índices para alto rendimiento y consultas rápidas
CREATE INDEX IF NOT EXISTS idx_servicios_np_renta_id ON public.servicios_no_preventivos(renta_id);
CREATE INDEX IF NOT EXISTS idx_servicios_np_cliente ON public.servicios_no_preventivos(cliente);
CREATE INDEX IF NOT EXISTS idx_servicios_np_equipo ON public.servicios_no_preventivos(equipo);
CREATE INDEX IF NOT EXISTS idx_servicios_np_fecha ON public.servicios_no_preventivos(fecha_servicio);
CREATE INDEX IF NOT EXISTS idx_servicios_np_semana ON public.servicios_no_preventivos(semana_ano);
CREATE INDEX IF NOT EXISTS idx_servicios_np_tecnico ON public.servicios_no_preventivos(tecnico_nombre);
CREATE INDEX IF NOT EXISTS idx_servicios_np_bolsa ON public.servicios_no_preventivos(aplica_bolsa_horas);

-- 5. Trigger automático para actualizar updated_at
CREATE OR REPLACE FUNCTION public.actualizar_snp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_snp_updated_at ON public.servicios_no_preventivos;
CREATE TRIGGER trg_actualizar_snp_updated_at
BEFORE UPDATE ON public.servicios_no_preventivos
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_snp_updated_at();

-- 6. Habilitar y configurar Row Level Security (RLS)
ALTER TABLE public.servicios_no_preventivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de servicios no preventivos" ON public.servicios_no_preventivos;
CREATE POLICY "Permitir lectura de servicios no preventivos" 
ON public.servicios_no_preventivos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion de servicios no preventivos" ON public.servicios_no_preventivos;
CREATE POLICY "Permitir insercion de servicios no preventivos" 
ON public.servicios_no_preventivos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion de servicios no preventivos" ON public.servicios_no_preventivos;
CREATE POLICY "Permitir actualizacion de servicios no preventivos" 
ON public.servicios_no_preventivos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion de servicios no preventivos" ON public.servicios_no_preventivos;
CREATE POLICY "Permitir eliminacion de servicios no preventivos" 
ON public.servicios_no_preventivos FOR DELETE USING (true);
