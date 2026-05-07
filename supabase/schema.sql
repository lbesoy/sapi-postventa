-- ==========================================
-- EUROREP CRM - SUPABASE SCHEMA INITIALIZATION
-- ==========================================

-- 1. DROP EXISTING TABLES IF MIGRATION FAILED DUE TO UUID TYPE
DROP TABLE IF EXISTS public.usuarios;
DROP TABLE IF EXISTS public.clientes;
DROP TABLE IF EXISTS public.ordenes;

-- 2. TABLE: usuarios
CREATE TABLE public.usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'tecnico',
    activo BOOLEAN DEFAULT false,
    empresa TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- 6. RLS (Row Level Security) - Deshabilitado temporalmente para pruebas
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;

-- Insertar un SuperAdmin por defecto
INSERT INTO public.usuarios (id, nombre, email, pin, rol, activo)
VALUES ('admin-001', 'Administrador Master', 'admin@eurorep.mx', '1234', 'superadmin', true)
ON CONFLICT (id) DO NOTHING;
