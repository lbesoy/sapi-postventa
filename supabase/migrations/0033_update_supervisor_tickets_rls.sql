-- Migration: 0033_update_supervisor_tickets_rls.sql
-- Description: Grant all supervisors full access to all tickets (read, create, update, delete) to match their access levels on other tables (ordenes, clientes, maquinaria) and prevent silent comment save failures.

-- 1. Eliminar políticas restrictivas anteriores de tickets para supervisores
DROP POLICY IF EXISTS "Admins y Laura Paz full access tickets" ON public.tickets;
DROP POLICY IF EXISTS "Supervisores own access tickets" ON public.tickets;

-- 2. Crear nueva política unificada para Administradores y Supervisores con acceso completo
CREATE POLICY "Admins y Supervisores full access tickets" ON public.tickets FOR ALL TO authenticated USING (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
) WITH CHECK (
  public.get_my_role() IN ('superadmin', 'admin', 'supervisor')
);
