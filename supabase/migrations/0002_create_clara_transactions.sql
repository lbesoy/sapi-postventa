-- ========================================================
-- MIGRATION 0002: CREAR TABLA CLARA_TRANSACTIONS
-- ========================================================

CREATE TABLE IF NOT EXISTS public.clara_transactions (
    id TEXT PRIMARY KEY, -- Clara's transaction UUID
    fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    merchant TEXT NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    card_last_4 TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.clara_transactions ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read transactions
CREATE POLICY "Permitir lectura de transacciones Clara a usuarios autenticados" 
ON public.clara_transactions 
FOR SELECT 
TO authenticated 
USING (true);

-- Turn on Realtime for the clara_transactions table
alter publication supabase_realtime add table public.clara_transactions;
