-- Migration: 0034_fix_events_and_horometros_rls.sql
-- Description: Fix calendar events check constraint to include 'Traslado' and recreate RLS policies for maquinaria_horometros to prevent 403/400 sync errors.

-- 1. Actualizar el constraint de tipo en calendario_eventos para incluir 'Traslado'
ALTER TABLE public.calendario_eventos DROP CONSTRAINT IF EXISTS calendario_eventos_tipo_check;
ALTER TABLE public.calendario_eventos ADD CONSTRAINT calendario_eventos_tipo_check CHECK (tipo IN ('Junta', 'Capacitación', 'Vacaciones', 'Descanso', 'Otro', 'Servicio', 'Levantamiento', 'Traslado'));

-- 2. Asegurar que RLS y las políticas de acceso completo para usuarios autenticados existan en la tabla de horómetros
ALTER TABLE public.maquinaria_horometros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.maquinaria_horometros;
CREATE POLICY "Permitir todo a autenticados" ON public.maquinaria_horometros FOR ALL TO authenticated USING (true) WITH CHECK (true);
