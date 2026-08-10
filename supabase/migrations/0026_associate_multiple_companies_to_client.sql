-- Migration: Associate multiple companies to client
-- Purpose: Adds the cliente_usuarios table to support linking a user with multiple companies (clientes)

CREATE TABLE IF NOT EXISTS public.cliente_usuarios (
    cliente_id TEXT REFERENCES public.clientes(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (cliente_id, usuario_id)
);

-- Enable RLS
ALTER TABLE public.cliente_usuarios ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.cliente_usuarios;

-- Create policies for authenticated users
CREATE POLICY "Permitir todo a autenticados" ON public.cliente_usuarios FOR ALL TO authenticated USING (true);

-- Migrate existing single company associations from user_roles
INSERT INTO public.cliente_usuarios (usuario_id, cliente_id)
SELECT ur.id, c.id
FROM public.user_roles ur
JOIN public.clientes c ON (LOWER(c.nombre) = LOWER(ur.empresa) OR c.id = ur.empresa)
ON CONFLICT DO NOTHING;
