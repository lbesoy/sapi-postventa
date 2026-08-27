-- Supabase Migration: Add 'cliente-consultor' Role

DROP POLICY IF EXISTS "Clientes y Empresas read own client" ON public.clientes;
DROP POLICY IF EXISTS "Clientes y Empresas read own maquinaria" ON public.maquinaria;
DROP POLICY IF EXISTS "Clientes y Empresas read own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Clientes y Empresas read own ordenes" ON public.ordenes;

CREATE POLICY "Clientes y Empresas read own client" ON public.clientes FOR SELECT TO authenticated USING (
  public.get_my_role() IN ('empresa', 'cliente', 'cliente-consultor')
  AND (
    LOWER(nombre) = LOWER(public.get_my_empresa())
    OR id = public.get_my_empresa()
    OR id IN (SELECT cliente_id FROM public.cliente_usuarios WHERE usuario_id = auth.uid())
  )
);

CREATE POLICY "Clientes y Empresas read own maquinaria" ON public.maquinaria FOR SELECT TO authenticated USING (
  public.get_my_role() IN ('empresa', 'cliente', 'cliente-consultor')
  AND (
    LOWER(cliente) IN (
      SELECT LOWER(id) FROM public.clientes WHERE LOWER(nombre) = LOWER(public.get_my_empresa()) OR id = public.get_my_empresa() OR id IN (SELECT cliente_id FROM public.cliente_usuarios WHERE usuario_id = auth.uid())
    )
  )
);

CREATE POLICY "Clientes y Empresas read own tickets" ON public.tickets FOR SELECT TO authenticated USING (
  public.get_my_role() IN ('empresa', 'cliente', 'cliente-consultor')
  AND (
    LOWER(cliente) IN (
      SELECT LOWER(id) FROM public.clientes WHERE LOWER(nombre) = LOWER(public.get_my_empresa()) OR id = public.get_my_empresa() OR id IN (SELECT cliente_id FROM public.cliente_usuarios WHERE usuario_id = auth.uid())
    )
    OR LOWER(solicitante) = LOWER(public.get_my_name())
  )
);

CREATE POLICY "Clientes y Empresas read own ordenes" ON public.ordenes FOR SELECT TO authenticated USING (
  public.get_my_role() IN ('empresa', 'cliente', 'cliente-consultor')
  AND (
    LOWER(cliente) IN (
      SELECT LOWER(id) FROM public.clientes WHERE LOWER(nombre) = LOWER(public.get_my_empresa()) OR id = public.get_my_empresa() OR id IN (SELECT cliente_id FROM public.cliente_usuarios WHERE usuario_id = auth.uid())
    )
  )
);
