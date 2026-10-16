-- Migration 0050: Permitir a anon y authenticated consultar y guardar configuraciones en public.config
-- Resuelve el problema donde la tabla config no era accesible para usuarios de la plataforma (rol anon)
-- provocando que los machotes de servicio preventivo oficiales se vaciaran a lista vacía.

DO $$
BEGIN
    -- 1. Permitir lectura pública (SELECT) a la tabla config (kits_servicio, kits_servicio_sandbox, roles, saldos)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'config' AND policyname = 'Permitir lectura publica en config'
    ) THEN
        CREATE POLICY "Permitir lectura publica en config" ON public.config 
        FOR SELECT USING (true);
    END IF;

    -- 2. Permitir inserción y actualización a anon y authenticated
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'config' AND policyname = 'Permitir escritura publica en config'
    ) THEN
        CREATE POLICY "Permitir escritura publica en config" ON public.config 
        FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
