-- ========================================================
-- MIGRATION 0003: CREAR TABLA SAPI_TELEMETRY
-- ========================================================

CREATE TABLE IF NOT EXISTS public.sapi_telemetry (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT
);

-- Disable RLS initially (will be enabled in step 0004)
ALTER TABLE public.sapi_telemetry DISABLE ROW LEVEL SECURITY;
