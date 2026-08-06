-- Migration: Add comentarios_internos to tickets
-- Purpose: Adds the comentarios_internos column to store internal comments feed and updates RLS policies

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS comentarios_internos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS creado_por TEXT;

-- Permite a los técnicos editar/actualizar los tickets que tienen asignados
DROP POLICY IF EXISTS "Técnicos pueden editar sus tickets asignados" ON public.tickets;
CREATE POLICY "Técnicos pueden editar sus tickets asignados" ON public.tickets FOR UPDATE TO authenticated USING (
  public.get_my_role() = 'tecnico'
  AND (
    asignado = public.get_my_name()
    OR asignado LIKE '%' || public.get_my_name() || '%'
  )
) WITH CHECK (
  public.get_my_role() = 'tecnico'
  AND (
    asignado = public.get_my_name()
    OR asignado LIKE '%' || public.get_my_name() || '%'
  )
);
