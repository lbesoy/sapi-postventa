-- ========================================================
-- MIGRATION 0004: ACTIVACIÓN GLOBAL DE RLS Y POLÍTICAS
-- ========================================================

-- 1. ACTIVAR ROW LEVEL SECURITY (RLS) EN TODAS LAS TABLAS DE EUROREP CRM
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sitios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sapi_telemetry ENABLE ROW LEVEL SECURITY;

-- 2. CREAR POLÍTICAS PARA PERMITIR OPERACIONES EXCLUSIVAMENTE A USUARIOS AUTENTICADOS (CONECTADOS)
CREATE POLICY "Permitir todo a autenticados" ON public.usuarios FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.clientes FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.ordenes FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.tickets FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.sitios FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.maquinaria FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.refacciones FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.config FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.roles FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.gastos FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir todo a autenticados" ON public.sapi_telemetry FOR ALL TO authenticated USING (true);
