-- Migration: Add comentarios_clientes to tickets
-- Purpose: Adds the comentarios_clientes column to store customer support chat messages between client and company

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS comentarios_clientes JSONB DEFAULT '[]'::jsonb;
