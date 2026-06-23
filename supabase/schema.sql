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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLE: ordenes (Tickets de Servicio)
CREATE TABLE public.ordenes (
    id TEXT PRIMARY KEY,
    folio TEXT NOT NULL UNIQUE,
    cliente TEXT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    sitio_id TEXT REFERENCES public.sitios(id) ON DELETE SET NULL,
    tecnico TEXT REFERENCES public.user_roles(nombre) ON DELETE SET NULL ON UPDATE CASCADE,
    maquinaria_id TEXT REFERENCES public.maquinaria(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL DEFAULT 'Servicio',
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_inicio TIMESTAMP WITH TIME ZONE,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    duracion_minutos INTEGER,
    notas TEXT,
    evidencia_url TEXT,
    evidencias JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLE: tickets (Soporte)
CREATE TABLE public.tickets (
    id TEXT PRIMARY KEY,
    folio TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    canal TEXT,
    contacto TEXT,
    asunto TEXT,
    cliente TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
    sitio TEXT REFERENCES public.sitios(id) ON DELETE CASCADE,
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
    pdf_pedido TEXT,
    pdf_cotizacion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABLE: sitios
CREATE TABLE public.sitios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    cliente TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
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
    anio SMALLINT,
    cliente TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
    sitio_id TEXT REFERENCES public.sitios(id) ON DELETE SET NULL,
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

-- 13. TABLES JUNCTION RELACIONALES INTERMEDIAS
CREATE TABLE IF NOT EXISTS public.cliente_supervisores (
    cliente_id TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (cliente_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.cliente_tecnicos (
    cliente_id TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (cliente_id, usuario_id)
);

ALTER TABLE public.cliente_supervisores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo a autenticados" ON public.cliente_supervisores FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.cliente_tecnicos FOR ALL TO authenticated USING (true);

-- 14. TABLE: orden_bitacora (Bitácora de Avances de Órdenes de Servicio)
CREATE TABLE IF NOT EXISTS public.orden_bitacora (
    id TEXT PRIMARY KEY,
    orden_id TEXT NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    tecnico TEXT REFERENCES public.user_roles(nombre) ON DELETE SET NULL ON UPDATE CASCADE,
    nota TEXT NOT NULL,
    entrada TEXT, -- Formato 'HH:MM'
    salida TEXT,  -- Formato 'HH:MM'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.orden_bitacora ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a autenticados" ON public.orden_bitacora FOR ALL TO authenticated USING (true);

-- 15. TABLE: orden_refacciones (Refacciones Utilizadas en Servicios)
CREATE TABLE IF NOT EXISTS public.orden_refacciones (
    id TEXT PRIMARY KEY,
    orden_id TEXT NOT NULL REFERENCES public.ordenes(id) ON DELETE CASCADE,
    refaccion_id TEXT NOT NULL REFERENCES public.refacciones(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Solicitado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.orden_refacciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a autenticados" ON public.orden_refacciones FOR ALL TO authenticated USING (true);

-- 16. TABLE: maquinaria_horometros (Historial Cronológico de Horómetros)
CREATE TABLE IF NOT EXISTS public.maquinaria_horometros (
    id TEXT PRIMARY KEY,
    maquinaria_id TEXT NOT NULL REFERENCES public.maquinaria(id) ON DELETE CASCADE,
    horometro INTEGER NOT NULL CHECK (horometro >= 0),
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    orden_id TEXT REFERENCES public.ordenes(id) ON DELETE SET NULL,
    usuario_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.maquinaria_horometros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a autenticados" ON public.maquinaria_horometros FOR ALL TO authenticated USING (true);

-- 17. TABLE: orden_firmas (Firmas de Aceptación y Conformidad)
CREATE TABLE IF NOT EXISTS public.orden_firmas (
    orden_id TEXT PRIMARY KEY REFERENCES public.ordenes(id) ON DELETE CASCADE,
    firma_cliente_url TEXT,
    nombre_firmante TEXT,
    puesto_firmante TEXT,
    firma_tecnico_url TEXT,
    fecha_firma TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.orden_firmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a autenticados" ON public.orden_firmas FOR ALL TO authenticated USING (true);

-- 18. TABLE: auditoria_logs (Bitácora de Auditoría del Sistema)
CREATE TABLE IF NOT EXISTS public.auditoria_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
    accion TEXT NOT NULL,
    tabla_afectada TEXT,
    registro_id TEXT,
    detalles JSONB,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a autenticados" ON public.auditoria_logs FOR ALL TO authenticated USING (true);

-- 19. TABLE: calendario_eventos (Actividades y Calendario Administrativo)
CREATE TABLE IF NOT EXISTS public.calendario_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descripcion TEXT,
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    todo_el_dia BOOLEAN DEFAULT false,
    tipo TEXT NOT NULL CHECK (tipo IN ('Junta', 'Capacitación', 'Vacaciones', 'Descanso', 'Otro', 'Servicio')),
    tecnico_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
    tecnico_nombre TEXT,
    creado_por UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
    orden_id TEXT REFERENCES public.ordenes(id) ON DELETE CASCADE,
    color TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir select de eventos a autenticados" ON public.calendario_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins y Supervisores full access eventos" ON public.calendario_eventos FOR ALL TO authenticated USING (
    (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
    (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
);
CREATE POLICY "Tecnicos pueden gestionar sus propios eventos" ON public.calendario_eventos FOR ALL TO authenticated USING (
    tecnico_id = auth.uid()
) WITH CHECK (
    tecnico_id = auth.uid()
);
