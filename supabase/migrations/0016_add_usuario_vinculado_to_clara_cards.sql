-- ========================================================
-- MIGRATION 0016: ADD USUARIO_VINCULADO_ID TO CLARA_CARDS,
-- ENABLE PUBLIC RLS POLICIES ON CLARA_TRANSACTIONS,
-- AND REPAIR EXISTING ENCODING CORRUPTIONS (MOJIBAKE)
-- ========================================================

-- 1. Add usuario_vinculado_id referencing user_roles
ALTER TABLE public.clara_cards 
ADD COLUMN IF NOT EXISTS usuario_vinculado_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL;

-- 2. Enable public RLS policies on clara_transactions so inserts/updates from app work
DROP POLICY IF EXISTS "Permitir lectura de transacciones Clara a usuarios autenticados" ON public.clara_transactions;
DROP POLICY IF EXISTS "Allow public select" ON public.clara_transactions;
DROP POLICY IF EXISTS "Allow public all" ON public.clara_transactions;

CREATE POLICY "Allow public select" ON public.clara_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public all" ON public.clara_transactions FOR ALL USING (true);

-- 3. Repair existing encoding corruptions in clara_cards table
UPDATE public.clara_cards SET
  alias = replace(replace(replace(replace(replace(replace(replace(alias, 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã±', 'ñ'), 'Ãa', 'ía'),
  usuario = replace(replace(replace(replace(replace(replace(replace(usuario, 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã±', 'ñ'), 'Ãa', 'ía'),
  tipo = replace(replace(replace(replace(replace(replace(replace(tipo, 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã±', 'ñ'), 'Ãa', 'ía'),
  donde_comprar = replace(replace(replace(replace(replace(replace(replace(donde_comprar, 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã±', 'ñ'), 'Ãa', 'ía');

UPDATE public.clara_cards SET
  alias = rtrim(replace(alias, 'Â', '')),
  usuario = rtrim(replace(usuario, 'Â', ''));

-- 4. Repair existing encoding corruptions in clara_transactions table
UPDATE public.clara_transactions SET
  merchant = replace(replace(replace(replace(replace(replace(replace(merchant, 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã±', 'ñ'), 'Ãa', 'ía'),
  usuario = replace(replace(replace(replace(replace(replace(replace(usuario, 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã±', 'ñ'), 'Ãa', 'ía'),
  categoria = replace(replace(replace(replace(replace(replace(replace(categoria, 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'), 'Ã±', 'ñ'), 'Ãa', 'ía');
