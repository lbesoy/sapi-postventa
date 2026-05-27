-- ========================================================
-- MIGRATION 0006: CONFIGURACIÓN DE STORAGE BUCKET Y POLÍTICAS
-- ========================================================

-- 1. Crear el bucket "evidencias" de forma automatizada si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Asegurar que la seguridad RLS esté activa en la tabla de almacenamiento
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas existentes para evitar errores de duplicación
DROP POLICY IF EXISTS "Permitir subidas a autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subidas a todo el crm" ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura publica" ON storage.objects;

-- 4. Crear política para permitir la subida (INSERT) de fotos/evidencias
CREATE POLICY "Permitir subidas a todo el crm" 
ON storage.objects 
FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'evidencias');

-- 5. Crear política para permitir la visualización y descarga (SELECT) pública de las evidencias
CREATE POLICY "Permitir lectura publica" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'evidencias');
