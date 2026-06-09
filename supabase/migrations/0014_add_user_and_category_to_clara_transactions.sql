-- ========================================================
-- MIGRATION 0014: ADD USUARIO, CATEGORIA AND FULL EXCEL COLUMNS TO CLARA_TRANSACTIONS
-- ========================================================

ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS usuario TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS categoria TEXT;

ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS fecha_transaccion TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS estado_cuenta TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS transaccion TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS monto_original NUMERIC(10,2);
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS moneda_original TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS monto_mxn NUMERIC(10,2);
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS tarjeta TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS alias_tarjeta TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS estado_aprobacion TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS nombre_aprobador TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS nota_aprobacion TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS codigo_autorizacion TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS categoria_clara TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS factura_electronica TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS factura_autovinculada TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS archivos_factura TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS anexos TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS archivos_anexo TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS folio_fiscal TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS titular TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS grupos TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS ubicacion TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS etiquetas TEXT;
ALTER TABLE public.clara_transactions ADD COLUMN IF NOT EXISTS descripcion TEXT;
