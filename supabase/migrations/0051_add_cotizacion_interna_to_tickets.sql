-- Migration 0051: Mapeo y persistencia relacional de Cotización Interna y Viáticos Clara en Tickets
-- Descripción:
--   1. Agrega a la tabla public.tickets el campo JSONB cotizacion_interna y columnas directas
--      (cot_linea, cot_tipo_cliente, cot_subtotal, cot_iva, cot_total, cot_moneda, cot_descuento_total,
--       cot_subtotal_lista, cot_total_costo, cot_margen_estimado, clara_combustible, clara_casetas,
--       clara_hospedaje, clara_alimentos, clara_total) para analítica, reportes y dashboards SQL.
--   2. Crea la tabla relacional public.ticket_cotizacion_items para consultar partidas individuales
--      (servicios ZFAC02, viáticos ZFAC10, refacciones y conceptos varios) con sus precios, costos y descuentos.
--   3. Implementa disparadores (triggers) automáticos:
--      a) BEFORE INSERT OR UPDATE: rellena automáticamente las columnas numéricas y de línea desde el JSON cotizacion_interna.
--      b) AFTER INSERT OR UPDATE: sincroniza las partidas en la tabla relacional ticket_cotizacion_items.
--   4. Bloque de migración histórica para extraer cotizaciones internas ya guardadas en el campo 'notas'
--      o en tickets existentes.

-- 1. Agregar columnas a public.tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS cotizacion_interna JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cot_linea TEXT,
ADD COLUMN IF NOT EXISTS cot_tipo_cliente TEXT,
ADD COLUMN IF NOT EXISTS cot_subtotal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cot_iva NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cot_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cot_moneda TEXT DEFAULT 'MXN',
ADD COLUMN IF NOT EXISTS cot_descuento_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cot_subtotal_lista NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cot_total_costo NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cot_margen_estimado NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS clara_combustible NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS clara_casetas NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS clara_hospedaje NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS clara_alimentos NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS clara_total NUMERIC DEFAULT 0;

-- Índices para búsquedas y ordenamientos rápidos
CREATE INDEX IF NOT EXISTS idx_tickets_cot_total ON public.tickets(cot_total);
CREATE INDEX IF NOT EXISTS idx_tickets_cot_linea ON public.tickets(cot_linea);
CREATE INDEX IF NOT EXISTS idx_tickets_clara_total ON public.tickets(clara_total);

-- 2. Crear tabla relacional de conceptos/partidas cotizadas
CREATE TABLE IF NOT EXISTS public.ticket_cotizacion_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    tipo TEXT, -- 'servicio', 'refaccion', 'viaticos'
    codigo TEXT, -- Clave SAP (ej. ZFAC02, ZFAC10, ZFAC05, código refacción)
    unidad TEXT, -- CON, TRI, CIM
    descripcion TEXT, -- Descripción o alcance técnico
    marca TEXT,
    cantidad NUMERIC DEFAULT 1,
    precio_unitario NUMERIC DEFAULT 0,
    descuento NUMERIC DEFAULT 0,
    precio_neto NUMERIC DEFAULT 0,
    subtotal NUMERIC DEFAULT 0,
    costo_unitario NUMERIC DEFAULT 0,
    total_costo NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexar tabla relacional
CREATE INDEX IF NOT EXISTS idx_ticket_cotizacion_items_ticket_id ON public.ticket_cotizacion_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_cotizacion_items_codigo ON public.ticket_cotizacion_items(codigo);
CREATE INDEX IF NOT EXISTS idx_ticket_cotizacion_items_tipo ON public.ticket_cotizacion_items(tipo);

-- Habilitar RLS
ALTER TABLE public.ticket_cotizacion_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a autenticados en ticket_cotizacion_items" ON public.ticket_cotizacion_items;
CREATE POLICY "Permitir todo a autenticados en ticket_cotizacion_items" ON public.ticket_cotizacion_items
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir lectura anon en ticket_cotizacion_items" ON public.ticket_cotizacion_items;
CREATE POLICY "Permitir lectura anon en ticket_cotizacion_items" ON public.ticket_cotizacion_items
    FOR SELECT TO anon USING (true);

-- 3. Disparador BEFORE: Denormalizar valores numéricos a columnas directas de tickets
CREATE OR REPLACE FUNCTION public.before_sync_ticket_cotizacion_cols()
RETURNS TRIGGER AS $$
DECLARE
  cot_json JSONB;
  pos INTEGER;
  delim TEXT := '=== COTIZACION_INTERNA ===';
  cot_part TEXT;
BEGIN
  IF NEW.cotizacion_interna IS NOT NULL AND NEW.cotizacion_interna != '{}'::jsonb THEN
    cot_json := NEW.cotizacion_interna;
  ELSIF NEW.notas IS NOT NULL AND NEW.notas LIKE '%' || delim || '%' THEN
    pos := strpos(NEW.notas, delim);
    cot_part := substr(NEW.notas, pos + length(delim));
    BEGIN
      cot_json := cot_part::jsonb;
      NEW.cotizacion_interna := cot_json;
    EXCEPTION WHEN OTHERS THEN
      cot_json := NULL;
    END;
  ELSE
    cot_json := NULL;
  END IF;

  IF cot_json IS NOT NULL THEN
    IF cot_json ? 'linea' THEN NEW.cot_linea := cot_json->>'linea'; END IF;
    IF cot_json ? 'tipoCliente' THEN NEW.cot_tipo_cliente := cot_json->>'tipoCliente'; END IF;
    IF cot_json ? 'subtotal' THEN NEW.cot_subtotal := (cot_json->>'subtotal')::NUMERIC; END IF;
    IF cot_json ? 'iva' THEN NEW.cot_iva := (cot_json->>'iva')::NUMERIC; END IF;
    IF cot_json ? 'total' THEN 
      NEW.cot_total := (cot_json->>'total')::NUMERIC;
      IF NEW.monto_cotizacion IS NULL OR NEW.monto_cotizacion = 0 THEN
        NEW.monto_cotizacion := NEW.cot_total;
      END IF;
    END IF;
    IF cot_json ? 'moneda' THEN NEW.cot_moneda := COALESCE(cot_json->>'moneda', 'MXN'); END IF;
    IF cot_json ? 'descuentoTotal' THEN NEW.cot_descuento_total := (cot_json->>'descuentoTotal')::NUMERIC; END IF;
    IF cot_json ? 'subtotalLista' THEN NEW.cot_subtotal_lista := (cot_json->>'subtotalLista')::NUMERIC; END IF;
    IF cot_json ? 'totalCosto' THEN NEW.cot_total_costo := (cot_json->>'totalCosto')::NUMERIC; END IF;
    IF cot_json ? 'margenEstimado' THEN NEW.cot_margen_estimado := (cot_json->>'margenEstimado')::NUMERIC; END IF;
    IF cot_json ? 'claraCombustible' THEN NEW.clara_combustible := (cot_json->>'claraCombustible')::NUMERIC; END IF;
    IF cot_json ? 'claraCasetas' THEN NEW.clara_casetas := (cot_json->>'claraCasetas')::NUMERIC; END IF;
    IF cot_json ? 'claraHospedaje' THEN NEW.clara_hospedaje := (cot_json->>'claraHospedaje')::NUMERIC; END IF;
    IF cot_json ? 'claraAlimentos' THEN NEW.clara_alimentos := (cot_json->>'claraAlimentos')::NUMERIC; END IF;
    IF cot_json ? 'claraTotal' THEN NEW.clara_total := (cot_json->>'claraTotal')::NUMERIC; END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_sync_ticket_cotizacion_cols ON public.tickets;
CREATE TRIGGER trg_before_sync_ticket_cotizacion_cols
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.before_sync_ticket_cotizacion_cols();

-- 4. Disparador AFTER: Poblar tabla relacional public.ticket_cotizacion_items
CREATE OR REPLACE FUNCTION public.after_sync_ticket_cotizacion_items()
RETURNS TRIGGER AS $$
DECLARE
  cot_json JSONB;
  items_arr JSONB;
  item RECORD;
  pos INTEGER;
  delim TEXT := '=== COTIZACION_INTERNA ===';
  cot_part TEXT;
BEGIN
  IF NEW.cotizacion_interna IS NOT NULL AND NEW.cotizacion_interna != '{}'::jsonb THEN
    cot_json := NEW.cotizacion_interna;
  ELSIF NEW.notas IS NOT NULL AND NEW.notas LIKE '%' || delim || '%' THEN
    pos := strpos(NEW.notas, delim);
    cot_part := substr(NEW.notas, pos + length(delim));
    BEGIN
      cot_json := cot_part::jsonb;
    EXCEPTION WHEN OTHERS THEN
      cot_json := NULL;
    END;
  ELSE
    cot_json := NULL;
  END IF;

  DELETE FROM public.ticket_cotizacion_items WHERE ticket_id = NEW.id;

  IF cot_json IS NOT NULL AND cot_json ? 'items' AND jsonb_typeof(cot_json->'items') = 'array' THEN
    items_arr := cot_json->'items';
    FOR item IN SELECT * FROM jsonb_to_recordset(items_arr) AS (
      tipo TEXT,
      codigo TEXT,
      unidad TEXT,
      descripcion TEXT,
      marca TEXT,
      cantidad NUMERIC,
      precioUnitario NUMERIC,
      precio_unitario NUMERIC,
      descuento NUMERIC,
      precioNeto NUMERIC,
      precio_neto NUMERIC,
      subtotal NUMERIC,
      costoUnitario NUMERIC,
      costo_unitario NUMERIC,
      totalCosto NUMERIC,
      total_costo NUMERIC
    ) LOOP
      INSERT INTO public.ticket_cotizacion_items (
        ticket_id,
        tipo,
        codigo,
        unidad,
        descripcion,
        marca,
        cantidad,
        precio_unitario,
        descuento,
        precio_neto,
        subtotal,
        costo_unitario,
        total_costo
      ) VALUES (
        NEW.id,
        COALESCE(item.tipo, 'servicio'),
        COALESCE(item.codigo, ''),
        COALESCE(item.unidad, NEW.cot_linea, 'CON'),
        COALESCE(item.descripcion, ''),
        item.marca,
        COALESCE(item.cantidad, 1),
        COALESCE(item.precioUnitario, item.precio_unitario, 0),
        COALESCE(item.descuento, 0),
        COALESCE(item.precioNeto, item.precio_neto, 0),
        COALESCE(item.subtotal, 0),
        COALESCE(item.costoUnitario, item.costo_unitario, 0),
        COALESCE(item.totalCosto, item.total_costo, 0)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_after_sync_ticket_cotizacion_items ON public.tickets;
CREATE TRIGGER trg_after_sync_ticket_cotizacion_items
AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.after_sync_ticket_cotizacion_items();

-- 5. Migración histórica para tickets existentes con cotización en notas o en cotizacion_interna
DO $$
DECLARE
  t RECORD;
  cot_part TEXT;
  cot_json JSONB;
  pos INTEGER;
  delim TEXT := '=== COTIZACION_INTERNA ===';
BEGIN
  FOR t IN SELECT id, notas FROM public.tickets WHERE (cotizacion_interna IS NULL OR cotizacion_interna = '{}'::jsonb) AND notas LIKE '%' || delim || '%' LOOP
    pos := strpos(t.notas, delim);
    cot_part := substr(t.notas, pos + length(delim));
    BEGIN
      cot_json := cot_part::jsonb;
    EXCEPTION WHEN OTHERS THEN
      cot_json := NULL;
    END;

    IF cot_json IS NOT NULL THEN
      UPDATE public.tickets
      SET 
        cotizacion_interna = cot_json,
        cot_linea = COALESCE(cot_linea, cot_json->>'linea'),
        cot_tipo_cliente = COALESCE(cot_tipo_cliente, cot_json->>'tipoCliente'),
        cot_subtotal = COALESCE(cot_subtotal, (cot_json->>'subtotal')::NUMERIC),
        cot_iva = COALESCE(cot_iva, (cot_json->>'iva')::NUMERIC),
        cot_total = COALESCE(cot_total, (cot_json->>'total')::NUMERIC),
        cot_moneda = COALESCE(cot_moneda, cot_json->>'moneda', 'MXN'),
        cot_descuento_total = COALESCE(cot_descuento_total, (cot_json->>'descuentoTotal')::NUMERIC),
        cot_subtotal_lista = COALESCE(cot_subtotal_lista, (cot_json->>'subtotalLista')::NUMERIC),
        cot_total_costo = COALESCE(cot_total_costo, (cot_json->>'totalCosto')::NUMERIC),
        cot_margen_estimado = COALESCE(cot_margen_estimado, (cot_json->>'margenEstimado')::NUMERIC),
        clara_combustible = COALESCE(clara_combustible, (cot_json->>'claraCombustible')::NUMERIC),
        clara_casetas = COALESCE(clara_casetas, (cot_json->>'claraCasetas')::NUMERIC),
        clara_hospedaje = COALESCE(clara_hospedaje, (cot_json->>'claraHospedaje')::NUMERIC),
        clara_alimentos = COALESCE(clara_alimentos, (cot_json->>'claraAlimentos')::NUMERIC),
        clara_total = COALESCE(clara_total, (cot_json->>'claraTotal')::NUMERIC),
        monto_cotizacion = COALESCE(monto_cotizacion, (cot_json->>'total')::NUMERIC)
      WHERE id = t.id;
    END IF;
  END LOOP;
END $$;
