-- Migration: Add email threading fields to tickets table
-- Purpose: Support standard email thread header references for automatic client notifications

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS ultimo_email_message_id TEXT,
ADD COLUMN IF NOT EXISTS email_thread_ids TEXT;
