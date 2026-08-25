-- Migration: Add paper closure fields to public.ordenes table
-- Purpose: Support closing service orders via scanned PDF with reason/justification

ALTER TABLE public.ordenes 
ADD COLUMN IF NOT EXISTS cierre_papel_pdf TEXT,
ADD COLUMN IF NOT EXISTS cierre_papel_motivo TEXT,
ADD COLUMN IF NOT EXISTS cierre_papel_usuario TEXT,
ADD COLUMN IF NOT EXISTS cierre_papel_fecha TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.ordenes.cierre_papel_pdf IS 'URL of the uploaded scanned PDF for physical closure';
COMMENT ON COLUMN public.ordenes.cierre_papel_motivo IS 'Justification for closing the order physically on paper instead of digitally';
COMMENT ON COLUMN public.ordenes.cierre_papel_usuario IS 'Name or email of the superadmin/admin/supervisor who closed this order';
COMMENT ON COLUMN public.ordenes.cierre_papel_fecha IS 'Timestamp when the order was closed via physical paper format';
