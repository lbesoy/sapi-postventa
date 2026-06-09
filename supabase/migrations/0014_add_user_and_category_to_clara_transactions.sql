-- ========================================================
-- MIGRATION 0014: ADD USUARIO AND CATEGORIA TO CLARA_TRANSACTIONS
-- ========================================================

ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS usuario TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS categoria TEXT;
