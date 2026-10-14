-- =============================================================================
-- Migración 0049: Tablas de Plantillas de Correo y Reglas de Automatización SAPI
-- =============================================================================

-- 1. Tabla de Plantillas de Correo (Machotes)
CREATE TABLE IF NOT EXISTS public.sapi_email_templates (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    asunto TEXT NOT NULL,
    cuerpo TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Reglas de Automatización
CREATE TABLE IF NOT EXISTS public.sapi_automation_rules (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    evento TEXT NOT NULL,
    "plantillaId" TEXT,
    destinatario TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.sapi_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sapi_automation_rules ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acceso total (Permitir lectura y escritura tanto anónima como autenticada para SAPI)
DROP POLICY IF EXISTS "Acceso total a autenticados" ON public.sapi_email_templates;
DROP POLICY IF EXISTS "Acceso total a sapi_email_templates" ON public.sapi_email_templates;
CREATE POLICY "Acceso total a sapi_email_templates" ON public.sapi_email_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso total a autenticados" ON public.sapi_automation_rules;
DROP POLICY IF EXISTS "Acceso total a sapi_automation_rules" ON public.sapi_automation_rules;
CREATE POLICY "Acceso total a sapi_automation_rules" ON public.sapi_automation_rules FOR ALL USING (true) WITH CHECK (true);
