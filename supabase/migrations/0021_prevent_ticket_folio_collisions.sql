-- Migration: 0021_prevent_ticket_folio_collisions.sql
-- Description: Prevent duplicate ticket folio generation by using a BEFORE INSERT trigger to auto-resolve collisions and add a UNIQUE constraint.

-- 1. Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.resolve_ticket_folio_collision()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
    year_str TEXT;
    next_num INTEGER;
    existing_count INTEGER;
BEGIN
    -- If folio is null or empty, generate a fallback placeholder
    IF NEW.folio IS NULL OR NEW.folio = '' THEN
        year_str := to_char(COALESCE(NEW.fecha_creacion, NEW.created_at, NOW()) AT TIME ZONE 'UTC', 'YY');
        NEW.folio := 'TKT-' || year_str || '001';
    END IF;

    -- Check if another ticket already exists with the same folio
    SELECT COUNT(*) INTO existing_count 
    FROM public.tickets 
    WHERE folio = NEW.folio AND id <> NEW.id;

    -- If a collision is detected, resolve it automatically
    IF existing_count > 0 THEN
        -- Determine the prefix (e.g. 'TKT-26' or 'TKT-PRUEBA-')
        IF NEW.folio LIKE 'TKT-PRUEBA-%' THEN
            prefix := 'TKT-PRUEBA-';
        ELSIF NEW.folio LIKE 'TKT-%' AND LENGTH(NEW.folio) >= 6 THEN
            prefix := SUBSTRING(NEW.folio FROM 1 FOR 6);
        ELSE
            year_str := to_char(COALESCE(NEW.fecha_creacion, NEW.created_at, NOW()) AT TIME ZONE 'UTC', 'YY');
            prefix := 'TKT-' || year_str;
        END IF;

        -- Obtain the highest consecutive number for that prefix
        SELECT COALESCE(
            MAX(CAST(SUBSTRING(folio FROM LENGTH(prefix) + 1) AS INTEGER)),
            0
        ) INTO next_num
        FROM public.tickets
        WHERE folio LIKE prefix || '%';

        -- Set the new sequential folio number
        NEW.folio := prefix || LPAD((next_num + 1)::TEXT, 3, '0');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop the trigger if it already exists
DROP TRIGGER IF EXISTS trigger_resolve_ticket_folio_collision ON public.tickets;

-- 3. Create the trigger
CREATE TRIGGER trigger_resolve_ticket_folio_collision
    BEFORE INSERT ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.resolve_ticket_folio_collision();

-- 4. Add a unique constraint/index on folio to guarantee database integrity
CREATE UNIQUE INDEX IF NOT EXISTS tickets_folio_unique_idx ON public.tickets (folio);
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_folio_unique;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_folio_unique UNIQUE USING INDEX tickets_folio_unique_idx;
