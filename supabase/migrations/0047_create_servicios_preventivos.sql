-- Migración 0047: Crear tabla de servicios preventivos para rentas
CREATE TABLE IF NOT EXISTS public.servicios_preventivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio TEXT NOT NULL UNIQUE,
    renta_id TEXT,
    renta_folio TEXT,
    cliente TEXT,
    sitio TEXT,
    equipo TEXT,
    serie TEXT,
    maquina_id TEXT,
    pagado_por TEXT DEFAULT 'cliente',
    justificacion_pago TEXT,
    monto_mano_obra NUMERIC(12, 2) DEFAULT 0,
    monto_refacciones NUMERIC(12, 2) DEFAULT 0,
    monto_total_servicio NUMERIC(12, 2) DEFAULT 0,
    numero_factura_sap TEXT,
    fecha_servicio DATE DEFAULT CURRENT_DATE,
    hora_entrada TEXT,
    hora_salida TEXT,
    horas_trabajadas NUMERIC(6, 2) DEFAULT 0,
    horometro_servicio NUMERIC(10, 2) DEFAULT 0,
    proximo_servicio_horometro NUMERIC(10, 2),
    operador_nombre TEXT,
    operador_id TEXT,
    tipo_operador TEXT DEFAULT 'eurorep',
    supervisor_responsable TEXT,
    tipo_mantenimiento TEXT DEFAULT '250h',
    checklist_actividades JSONB DEFAULT '[]'::jsonb,
    bitacora_notas TEXT,
    estado_equipo TEXT DEFAULT 'Operativo',
    refacciones JSONB DEFAULT '[]'::jsonb,
    evidencias JSONB DEFAULT '[]'::jsonb,
    firma_operador TEXT,
    firma_cliente TEXT,
    nombre_recibe TEXT,
    es_prueba BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_servicios_prev_renta_id ON public.servicios_preventivos(renta_id);
CREATE INDEX IF NOT EXISTS idx_servicios_prev_cliente ON public.servicios_preventivos(cliente);
CREATE INDEX IF NOT EXISTS idx_servicios_prev_fecha ON public.servicios_preventivos(fecha_servicio);
CREATE INDEX IF NOT EXISTS idx_servicios_prev_pagado_por ON public.servicios_preventivos(pagado_por);
CREATE INDEX IF NOT EXISTS idx_servicios_prev_operador ON public.servicios_preventivos(operador_nombre);

-- Habilitar RLS
ALTER TABLE public.servicios_preventivos ENABLE ROW LEVEL SECURITY;

-- Política de lectura para todos los autenticados y anon
CREATE POLICY "Permitir lectura de servicios preventivos" 
ON public.servicios_preventivos FOR SELECT USING (true);

-- Política de inserción para autenticados y anon
CREATE POLICY "Permitir insercion de servicios preventivos" 
ON public.servicios_preventivos FOR INSERT WITH CHECK (true);

-- Política de actualización
CREATE POLICY "Permitir actualizacion de servicios preventivos" 
ON public.servicios_preventivos FOR UPDATE USING (true);

-- Política de eliminación
CREATE POLICY "Permitir eliminacion de servicios preventivos" 
ON public.servicios_preventivos FOR DELETE USING (true);
