-- 0011_update_maquinaria_client_relation.sql
-- Migración para normalizar la relación de la tabla public.maquinaria con public.clientes.
-- Pasa de ligarse por el nombre de texto a ligarse por la clave primaria 'id' del cliente (CardCode/UUID).

BEGIN;

-- 1. Eliminar temporalmente la clave foránea preexistente
ALTER TABLE public.maquinaria DROP CONSTRAINT IF EXISTS maquinaria_cliente_fkey;

-- 2. Actualizar las filas existentes de maquinaria reemplazando el nombre por el ID del cliente correspondiente
UPDATE public.maquinaria m
SET cliente = c.id
FROM public.clientes c
WHERE m.cliente = c.nombre;

-- 3. Volver a enlazar la clave foránea referenciando formalmente a clientes(id) con borrado en cascada
ALTER TABLE public.maquinaria 
  ADD CONSTRAINT maquinaria_cliente_fkey 
  FOREIGN KEY (cliente) 
  REFERENCES public.clientes(id) 
  ON DELETE CASCADE;

COMMIT;
