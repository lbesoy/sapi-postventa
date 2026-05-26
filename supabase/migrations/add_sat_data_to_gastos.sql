-- Migration to add sat_data JSONB column to public.gastos table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS sat_data JSONB;
