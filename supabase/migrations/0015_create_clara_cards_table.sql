-- ========================================================
-- MIGRATION 0015: CREATE CLARA_CARDS TABLE
-- ========================================================

CREATE TABLE IF NOT EXISTS public.clara_cards (
    id TEXT PRIMARY KEY,
    alias TEXT,
    usuario TEXT,
    correo TEXT,
    estado TEXT,
    tipo TEXT,
    tarjeta TEXT,
    limite NUMERIC(12,2) DEFAULT 0,
    saldo_utilizado NUMERIC(12,2) DEFAULT 0,
    ultima_actualizacion TEXT,
    donde_comprar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clara_cards ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous/public select (same as others in client app)
CREATE POLICY "Allow public select" ON public.clara_cards
    FOR SELECT USING (true);

-- Create policy to allow public insert/update/delete
CREATE POLICY "Allow public all" ON public.clara_cards
    FOR ALL USING (true);
