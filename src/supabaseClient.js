/**
 * Cliente de Conexión Supabase - Eurorep / SAPI
 * Módulo ES híbrido (npm package + browser CDN fallback) con retrocompatibilidad window
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';

// Inicialización resiliente
let client = null;
if (typeof window !== 'undefined' && window.supabaseClient) {
  client = window.supabaseClient;
} else {
  try {
    client = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
      console.warn('[SupabaseClient] No se pudo inicializar cliente Supabase:', err);
    }
  }
}

export const supabaseClient = client;

// Exposición global para que app.js, supabaseSync.js y cliente.js no sufran alteraciones
if (typeof window !== 'undefined') {
  window.supabaseClient = client;
}

export default supabaseClient;
