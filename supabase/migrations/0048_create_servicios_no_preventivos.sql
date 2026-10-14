-- Migración 0048: Crear tabla de servicios NO preventivos en sitio y bolsa de horas para rentas
CREATE TABLE IF NOT EXISTS public.servicios_no_preventivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio TEXT NOT NULL UNIQUE,
    renta_id TEXT,
    renta_folio TEXT,
    cliente TEXT,
    sitio TEXT,
    equipo TEXT,
    serie TEXT,
    maquina_id TEXT,
    horometro NUMERIC(10, 2) DEFAULT 0,
    fecha_servicio DATE DEFAULT CURRENT_DATE,
    hora_inicio TEXT,
    hora_fin TEXT,
    horas_trabajadas NUMERIC(6, 2) DEFAULT 0,
    tecnico_nombre TEXT,
    tecnico_id TEXT,
    tipo_trabajo TEXT DEFAULT 'Correctivo',
    sistema_afectado TEXT DEFAULT 'General',
    descripcion_trabajo TEXT,
    solucion_aplicada TEXT,
    estado_equipo TEXT DEFAULT 'Operativo',
    refacciones JSONB DEFAULT '[]'::jsonb,
    monto_refacciones NUMERIC(12, 2) DEFAULT 0,
    evidencias JSONB DEFAULT '[]'::jsonb,
    firma_tecnico TEXT,
    firma_cliente TEXT,
    nombre_recibe TEXT,
    semana_ano TEXT,
    facturado_semanal BOOLEAN DEFAULT false,
    aplica_bolsa_horas BOOLEAN DEFAULT true,
    es_prueba BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de consulta rápida para bitácora y bolsa de horas
CREATE INDEX IF NOT EXISTS idx_servicios_np_renta_id ON public.servicios_no_preventivos(renta_id);
CREATE INDEX IF NOT EXISTS idx_servicios_np_cliente ON public.servicios_no_preventivos(cliente);
CREATE INDEX IF NOT EXISTS idx_servicios_np_equipo ON public.servicios_no_preventivos(equipo);
CREATE INDEX IF NOT EXISTS idx_servicios_np_fecha ON public.servicios_no_preventivos(fecha_servicio);
CREATE INDEX IF NOT EXISTS idx_servicios_np_semana ON public.servicios_no_preventivos(semana_ano);
CREATE INDEX IF NOT EXISTS idx_servicios_np_tecnico ON public.servicios_no_preventivos(tecnico_nombre);

-- Habilitar RLS
ALTER TABLE public.servicios_no_preventivos ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad RLS
CREATE POLICY "Permitir lectura de servicios no preventivos" 
ON public.servicios_no_preventivos FOR SELECT USING (true);

CREATE POLICY "Permitir insercion de servicios no preventivos" 
ON public.servicios_no_preventivos FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualizacion de servicios no preventivos" 
ON public.servicios_no_preventivos FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminacion de servicios no preventivos" 
ON public.servicios_no_preventivos FOR DELETE USING (true);
