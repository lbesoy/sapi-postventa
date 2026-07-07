-- Migration: 0022_add_ubicacion_sitio_and_operador_to_ordenes.sql
-- Description: Add columns `ubicacion_sitio` and `operador` to table `public.ordenes` for on-site logging.

ALTER TABLE public.ordenes ADD COLUMN IF NOT EXISTS ubicacion_sitio TEXT;
ALTER TABLE public.ordenes ADD COLUMN IF NOT EXISTS operador TEXT;
