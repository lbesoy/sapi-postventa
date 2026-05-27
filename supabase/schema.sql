-- ==========================================
-- EUROREP CRM - SUPABASE SCHEMA INITIALIZATION
-- ==========================================

-- 1. DROP EXISTING TABLES IF MIGRATION FAILED DUE TO UUID TYPE
DROP TABLE IF EXISTS public.clientes;
DROP TABLE IF EXISTS public.ordenes;

-- 3. TABLE: clientes
CREATE TABLE public.clientes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    rfc TEXT,
    email TEXT,
    telefono TEXT,
    id_fiscal TEXT,
    sitios JSONB DEFAULT '[]'::jsonb,
    maquinas JSONB DEFAULT '[]'::jsonb,
    supervisores_asignados JSONB DEFAULT '[]'::jsonb,
    tecnicos_asignados JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLE: ordenes (Tickets de Servicio)
CREATE TABLE public.ordenes (
    id TEXT PRIMARY KEY,
    folio TEXT NOT NULL,
    cliente TEXT NOT NULL,
    ubicacion TEXT,
    tecnico TEXT,
    modelo TEXT,
    tipo TEXT NOT NULL DEFAULT 'Servicio',
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_inicio TIMESTAMP WITH TIME ZONE,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    duracion_minutos INTEGER,
    notas TEXT,
    evidencia_base64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLE: tickets (Soporte)
CREATE TABLE public.tickets (
    id TEXT PRIMARY KEY,
    folio TEXT NOT NULL,
    fecha TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    canal TEXT,
    contacto TEXT,
    asunto TEXT,
    cliente TEXT,
    sitio TEXT,
    solicitante TEXT,
    area TEXT,
    categoria TEXT,
    prioridad TEXT,
    asignado TEXT,
    descripcion TEXT,
    equipo TEXT,
    notas TEXT,
    estado TEXT,
    cotizacion_sap TEXT,
    cot_aceptada TEXT,
    motivo_rechazo TEXT,
    pedido_sap TEXT,
    tecnicos_asignados JSONB DEFAULT '[]'::jsonb,
    pdf_pedido TEXT,
    pdf_cotizacion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABLE: sitios
CREATE TABLE public.sitios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    cliente TEXT,
    direccion TEXT,
    cp TEXT,
    ciudad TEXT,
    estado TEXT,
    custom_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABLE: maquinaria
CREATE TABLE public.maquinaria (
    id TEXT PRIMARY KEY,
    serie TEXT,
    marca TEXT,
    modelo TEXT,
    anio TEXT,
    cliente TEXT,
    id_interno TEXT,
    descripcion TEXT,
    custom_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TABLE: refacciones
CREATE TABLE public.refacciones (
    id TEXT PRIMARY KEY,
    codigo TEXT,
    descripcion TEXT,
    precio NUMERIC,
    moneda TEXT,
    stock INTEGER,
    custom_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. TABLE: config
CREATE TABLE public.config (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. TABLE: roles
CREATE TABLE public.roles (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. RLS (Row Level Security) - Habilitado por defecto para máxima seguridad
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sitios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 12. Políticas de seguridad para permitir operaciones exclusivamente a usuarios autenticados
CREATE POLICY "Permitir todo a autenticados" ON public.sitios FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.refacciones FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.config FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.roles FOR ALL TO authenticated USING (true);
