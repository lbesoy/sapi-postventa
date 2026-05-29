-- Crear tabla de eventos de calendario
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
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activar Row Level Security
ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura: Todos los usuarios autenticados pueden ver los eventos
CREATE POLICY "Permitir select de eventos a autenticados" 
ON public.calendario_eventos FOR SELECT TO authenticated USING (true);

-- Políticas de escritura para administradores y supervisores
CREATE POLICY "Admins y Supervisores full access eventos" 
ON public.calendario_eventos FOR ALL TO authenticated USING (
    (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
    (SELECT rol FROM public.user_roles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'supervisor')
);

-- Habilitar a los técnicos a registrar o gestionar sus propios eventos (e.g. solicitar vacaciones/descansos)
CREATE POLICY "Tecnicos pueden gestionar sus propios eventos" 
ON public.calendario_eventos FOR ALL TO authenticated USING (
    tecnico_id = auth.uid()
) WITH CHECK (
    tecnico_id = auth.uid()
);
