-- Migración: Sincronización automática de refacciones de tickets a una tabla relacional
-- Descripción: Crea la tabla ticket_refacciones_detalle y un trigger que analiza el campo JSON en 'notas' de tickets para rellenar la tabla relacional en tiempo real.

-- 1. Crear tabla de detalles de refacciones
CREATE TABLE IF NOT EXISTS public.ticket_refacciones_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    clave TEXT,
    descripcion TEXT,
    cantidad NUMERIC DEFAULT 1,
    marca TEXT,
    estatus_pedido TEXT DEFAULT 'Por Pedir',
    proveedor TEXT,
    paqueteria TEXT,
    guia_pedido TEXT,
    precio NUMERIC,
    fecha_pedido DATE,
    fecha_estimada DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexar por ticket_id para optimizar las consultas y uniones (joins)
CREATE INDEX IF NOT EXISTS idx_ticket_refacciones_detalle_ticket_id ON public.ticket_refacciones_detalle(ticket_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.ticket_refacciones_detalle ENABLE ROW LEVEL SECURITY;

-- Política de RLS para que usuarios autenticados puedan leer y escribir en la tabla
DROP POLICY IF EXISTS "Permitir todo a autenticados" ON public.ticket_refacciones_detalle;
CREATE POLICY "Permitir todo a autenticados" ON public.ticket_refacciones_detalle
    FOR ALL TO authenticated USING (true);

-- 2. Función disparadora (Trigger Function) que parsea las notas y actualiza la tabla relacional
CREATE OR REPLACE FUNCTION public.sync_ticket_refacciones()
RETURNS TRIGGER AS $$
DECLARE
  ref_part TEXT;
  ref_json JSONB;
  item RECORD;
  numeric_price NUMERIC;
  pos INTEGER;
  delim TEXT := '=== REFACCIONES ===';
BEGIN
  -- Buscar delimitador en el campo notas
  IF NEW.notas IS NOT NULL AND NEW.notas LIKE '%' || delim || '%' THEN
    pos := strpos(NEW.notas, delim);
    ref_part := substr(NEW.notas, pos + length(delim));
    
    -- Intentar parsear el contenido a formato JSONB
    BEGIN
      ref_json := ref_part::jsonb;
    EXCEPTION WHEN OTHERS THEN
      ref_json := NULL;
    END;
  ELSE
    ref_json := NULL;
  END IF;

  -- Limpiar los registros de piezas existentes para este ticket
  DELETE FROM public.ticket_refacciones_detalle WHERE ticket_id = NEW.id;

  -- Insertar los registros individuales si el JSON es un arreglo válido
  IF ref_json IS NOT NULL AND jsonb_typeof(ref_json) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_to_recordset(ref_json) AS (
      clave TEXT,
      codigo TEXT,
      descripcion TEXT,
      nombre TEXT,
      cantidad NUMERIC,
      qty NUMERIC,
      marca TEXT,
      estatusPedido TEXT,
      estatus_pedido TEXT,
      proveedor TEXT,
      paqueteria TEXT,
      guiaPedido TEXT,
      guia_pedido TEXT,
      precio TEXT,
      fechaPedido TEXT,
      fecha_pedido TEXT,
      fechaEstimada TEXT,
      fecha_estimada TEXT
    ) LOOP
      -- Castear precio de forma segura a tipo numérico
      BEGIN
        numeric_price := NULL;
        IF item.precio IS NOT NULL AND item.precio != '' THEN
          numeric_price := item.precio::NUMERIC;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        numeric_price := NULL;
      END;

      INSERT INTO public.ticket_refacciones_detalle (
        ticket_id,
        clave,
        descripcion,
        cantidad,
        marca,
        estatus_pedido,
        proveedor,
        paqueteria,
        guia_pedido,
        precio,
        fecha_pedido,
        fecha_estimada
      ) VALUES (
        NEW.id,
        COALESCE(item.clave, item.codigo),
        COALESCE(item.descripcion, item.nombre),
        COALESCE(item.cantidad, item.qty, 1),
        item.marca,
        COALESCE(item.estatusPedido, item.estatus_pedido, 'Por Pedir'),
        item.proveedor,
        item.paqueteria,
        COALESCE(item.guiaPedido, item.guia_pedido),
        numeric_price,
        NULLIF(COALESCE(item.fechaPedido, item.fecha_pedido), '')::DATE,
        NULLIF(COALESCE(item.fechaEstimada, item.fecha_estimada), '')::DATE
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el disparador (Trigger) asociado a la tabla tickets
DROP TRIGGER IF EXISTS trg_sync_ticket_refacciones ON public.tickets;
CREATE TRIGGER trg_sync_ticket_refacciones
AFTER INSERT OR UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.sync_ticket_refacciones();

-- 4. Bloque de migración histórica para sincronizar datos existentes
DO $$
DECLARE
  t RECORD;
  ref_part TEXT;
  ref_json JSONB;
  item RECORD;
  numeric_price NUMERIC;
  pos INTEGER;
  delim TEXT := '=== REFACCIONES ===';
BEGIN
  -- Limpiar tabla para evitar duplicidades durante la migración inicial
  DELETE FROM public.ticket_refacciones_detalle;

  FOR t IN SELECT id, notas FROM public.tickets WHERE notas LIKE '%' || delim || '%' LOOP
    pos := strpos(t.notas, delim);
    ref_part := substr(t.notas, pos + length(delim));
    
    BEGIN
      ref_json := ref_part::jsonb;
    EXCEPTION WHEN OTHERS THEN
      ref_json := NULL;
    END;

    IF ref_json IS NOT NULL AND jsonb_typeof(ref_json) = 'array' THEN
      FOR item IN SELECT * FROM jsonb_to_recordset(ref_json) AS (
        clave TEXT,
        codigo TEXT,
        descripcion TEXT,
        nombre TEXT,
        cantidad NUMERIC,
        qty NUMERIC,
        marca TEXT,
        estatusPedido TEXT,
        estatus_pedido TEXT,
        proveedor TEXT,
        paqueteria TEXT,
        guiaPedido TEXT,
        guia_pedido TEXT,
        precio TEXT,
        fechaPedido TEXT,
        fecha_pedido TEXT,
        fechaEstimada TEXT,
        fecha_estimada TEXT
      ) LOOP
        BEGIN
          numeric_price := NULL;
          IF item.precio IS NOT NULL AND item.precio != '' THEN
            numeric_price := item.precio::NUMERIC;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          numeric_price := NULL;
        END;

        INSERT INTO public.ticket_refacciones_detalle (
          ticket_id,
          clave,
          descripcion,
          cantidad,
          marca,
          estatus_pedido,
          proveedor,
          paqueteria,
          guia_pedido,
          precio,
          fecha_pedido,
          fecha_estimada
        ) VALUES (
          t.id,
          COALESCE(item.clave, item.codigo),
          COALESCE(item.descripcion, item.nombre),
          COALESCE(item.cantidad, item.qty, 1),
          item.marca,
          COALESCE(item.estatusPedido, item.estatus_pedido, 'Por Pedir'),
          item.proveedor,
          item.paqueteria,
          COALESCE(item.guiaPedido, item.guia_pedido),
          numeric_price,
          NULLIF(COALESCE(item.fechaPedido, item.fecha_pedido), '')::DATE,
          NULLIF(COALESCE(item.fechaEstimada, item.fecha_estimada), '')::DATE
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;
