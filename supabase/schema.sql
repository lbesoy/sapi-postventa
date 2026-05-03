-- ==========================================
-- EUROREP CRM - SUPABASE SCHEMA INITIALIZATION
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE: usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL, -- Inicialmente guardamos el pin para facilitar migración, luego pasamos a Auth Real
    rol TEXT NOT NULL DEFAULT 'tecnico',
    activo BOOLEAN DEFAULT false,
    empresa TEXT, -- Para usuarios con rol "empresa"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLE: clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    rfc TEXT,
    email TEXT,
    telefono TEXT,
    id_fiscal TEXT,
    sitios JSONB DEFAULT '[]'::jsonb,
    maquinas JSONB DEFAULT '[]'::jsonb,
    supervisores_asignados JSONB DEFAULT '[]'::jsonb, -- Array de UUIDs
    tecnicos_asignados JSONB DEFAULT '[]'::jsonb, -- Array de UUIDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLE: ordenes (Tickets de Servicio)
CREATE TABLE IF NOT EXISTS public.ordenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    evidencia_base64 TEXT, -- Opcional, idealmente en Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. RLS (Row Level Security) - Deshabilitado temporalmente para pruebas rápidas
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes DISABLE ROW LEVEL SECURITY;

-- Insertar un SuperAdmin por defecto
INSERT INTO public.usuarios (nombre, email, pin, rol, activo)
VALUES ('Administrador Master', 'admin@eurorep.com.mx', '1234', 'superadmin', true)
ON CONFLICT (email) DO NOTHING;
