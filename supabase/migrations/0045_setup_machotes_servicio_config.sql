-- Migration: 0045_setup_machotes_servicio_config.sql
-- Description: Configuración de tabla config para Machotes / Kits de Servicio Preventivo y habilitación de Realtime

-- 1. Asegurar existencia de la tabla public.config
CREATE TABLE IF NOT EXISTS public.config (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS en public.config
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- 3. Crear política para usuarios autenticados si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'config' AND policyname = 'Permitir todo a autenticados'
    ) THEN
        CREATE POLICY "Permitir todo a autenticados" ON public.config 
        FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- 4. Habilitar Realtime para la tabla config
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'config'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.config;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 5. Inicializar registros:
-- Modo Real (Producción): Inicia limpio en 0 ([]) para que el equipo genere los machotes desde cero.
-- Modo Sandbox (Pruebas): Contiene los 36 machotes de ejemplo / catálogo base para pruebas.
INSERT INTO public.config (id, data, updated_at)
VALUES 
    ('kits_servicio', '[]'::jsonb, NOW()),
    ('kits_servicio_sandbox', '[
  {
    "id": "kit-rm120x-250h",
    "nombre": "Kit Preventivo 250h - Rubble Master RM120X / RM120GO!",
    "modelo": "RM120X",
    "marca": "RUBBLE MASTER",
    "intervalo": "250",
    "descripcion": "Servicio preventivo menor: Reemplazo de filtro de aceite motor, filtro combustible primario y separador de agua.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RM-510023",
        "descripcion": "Filtro de Aceite Motor John Deere / Volvo",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RM-510045",
        "descripcion": "Filtro de Combustible Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-510048",
        "descripcion": "Filtro Separador de Agua y Pre-combustible",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-rm120x-500h",
    "nombre": "Kit Preventivo 500h - Rubble Master RM120X / RM120GO!",
    "modelo": "RM120X",
    "marca": "RUBBLE MASTER",
    "intervalo": "500",
    "descripcion": "Servicio preventivo intermedio: Reemplazo completo de filtros de motor, aire primario e hidráulico de retorno.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RM-510023",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RM-510045",
        "descripcion": "Filtro Combustible Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-510046",
        "descripcion": "Filtro Combustible Secundario / Fino",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-510048",
        "descripcion": "Filtro Separador de Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-520110",
        "descripcion": "Filtro de Aire Motor Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RM-530080",
        "descripcion": "Filtro Hidráulico de Retorno",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-rm120x-1000h",
    "nombre": "Kit Preventivo 1000h - Rubble Master RM120X / RM120GO!",
    "modelo": "RM120X",
    "marca": "RUBBLE MASTER",
    "intervalo": "1000",
    "descripcion": "Servicio preventivo mayor / 1000h: Filtración integral de motor, aire de seguridad, hidráulica completa, respiradores y bandas.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RM-510023",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RM-510045",
        "descripcion": "Filtro Combustible Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-510046",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-510048",
        "descripcion": "Filtro Separador de Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-520110",
        "descripcion": "Filtro de Aire Motor Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RM-520111",
        "descripcion": "Filtro de Aire Motor Secundario (Seguridad)",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RM-530080",
        "descripcion": "Filtro Hidráulico de Retorno",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RM-530085",
        "descripcion": "Filtro Hidráulico de Presión Alta",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RM-530090",
        "descripcion": "Respirador / Filtro Aire Tanque Hidráulico",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RM-540200",
        "descripcion": "Juego de Bandas de Transmisión Motor / Rotor",
        "marca": "RUBBLE MASTER",
        "sistema": "Transmisión",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-ms125go-250h",
    "nombre": "Kit Preventivo 250h - Rubble Master MS125GO!",
    "modelo": "MS125GO!",
    "marca": "RUBBLE MASTER",
    "intervalo": "250",
    "descripcion": "Mantenimiento preventivo básico 250h para criba MS125GO! (Motor Deutz / CAT).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RM-MS-023",
        "descripcion": "Filtro de Aceite Motor Deutz / CAT",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-045",
        "descripcion": "Filtro de Combustible en Línea",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-048",
        "descripcion": "Filtro Separador Agua Combustible",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-ms125go-500h",
    "nombre": "Kit Preventivo 500h - Rubble Master MS125GO!",
    "modelo": "MS125GO!",
    "marca": "RUBBLE MASTER",
    "intervalo": "500",
    "descripcion": "Mantenimiento preventivo 500h: Filtros de motor, aire primario e hidráulico de circuito de cribado.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RM-MS-023",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-045",
        "descripcion": "Filtro de Combustible",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-048",
        "descripcion": "Filtro Separador Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-110",
        "descripcion": "Filtro de Aire Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-080",
        "descripcion": "Filtro Hidráulico Criba",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-ms125go-1000h",
    "nombre": "Kit Preventivo 1000h - Rubble Master MS125GO!",
    "modelo": "MS125GO!",
    "marca": "RUBBLE MASTER",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h: Filtración completa de motor y sistema hidráulico de tracción y cribado.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RM-MS-023",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-045",
        "descripcion": "Filtro de Combustible",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-048",
        "descripcion": "Filtro Separador Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-110",
        "descripcion": "Filtro de Aire Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-111",
        "descripcion": "Filtro de Aire Secundario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-080",
        "descripcion": "Filtro Hidráulico Criba",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-085",
        "descripcion": "Filtro Hidráulico Presión",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RM-MS-090",
        "descripcion": "Respirador Tanque Hidráulico",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-rm100go-250h",
    "nombre": "Kit Preventivo 250h - Rubble Master RM100GO! / RM70",
    "modelo": "RM100Go!",
    "marca": "RUBBLE MASTER",
    "intervalo": "250",
    "descripcion": "Servicio preventivo menor 250h para trituradoras RM100 / RM70.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RM-100-023",
        "descripcion": "Filtro de Aceite Motor John Deere",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-045",
        "descripcion": "Filtro de Combustible Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-048",
        "descripcion": "Filtro Separador de Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-rm100go-500h",
    "nombre": "Kit Preventivo 500h - Rubble Master RM100GO! / RM70",
    "modelo": "RM100Go!",
    "marca": "RUBBLE MASTER",
    "intervalo": "500",
    "descripcion": "Servicio preventivo intermedio 500h para trituradoras RM100 / RM70.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RM-100-023",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-045",
        "descripcion": "Filtro Combustible Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-046",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-048",
        "descripcion": "Filtro Separador de Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-110",
        "descripcion": "Filtro de Aire Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-080",
        "descripcion": "Filtro Hidráulico de Retorno",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-rm100go-1000h",
    "nombre": "Kit Preventivo 1000h - Rubble Master RM100GO! / RM70",
    "modelo": "RM100Go!",
    "marca": "RUBBLE MASTER",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h para trituradoras RM100 / RM70.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RM-100-023",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-045",
        "descripcion": "Filtro Combustible Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-046",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-048",
        "descripcion": "Filtro Separador de Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-110",
        "descripcion": "Filtro de Aire Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-111",
        "descripcion": "Filtro de Aire Secundario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-080",
        "descripcion": "Filtro Hidráulico Retorno",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-085",
        "descripcion": "Filtro Hidráulico Presión",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-090",
        "descripcion": "Respirador Tanque Hidráulico",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RM-100-200",
        "descripcion": "Juego de Bandas de Transmisión Rotor",
        "marca": "RUBBLE MASTER",
        "sistema": "Transmisión",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-zr255h-250h",
    "nombre": "Kit Preventivo 250h - Zoomlion ZR255H (Motor Cummins QSL8.9)",
    "modelo": "ZR255H",
    "marca": "ZOOMLION",
    "intervalo": "250",
    "descripcion": "Servicio menor 250h para perforadora / pilotera Zoomlion ZR255H.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "CUM-LF9009",
        "descripcion": "Filtro Aceite Lubricante Motor Cummins QSL8.9",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "CUM-FF5612",
        "descripcion": "Filtro Combustible Primario Fleetguard",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CUM-FS19732",
        "descripcion": "Filtro Separador Agua / Combustible",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-zr255h-500h",
    "nombre": "Kit Preventivo 500h - Zoomlion ZR255H (Motor Cummins QSL8.9)",
    "modelo": "ZR255H",
    "marca": "ZOOMLION",
    "intervalo": "500",
    "descripcion": "Servicio intermedio 500h: Motor Cummins, admisión y filtros de retorno hidráulico.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "CUM-LF9009",
        "descripcion": "Filtro Aceite Motor Cummins QSL8.9",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "CUM-FF5612",
        "descripcion": "Filtro Combustible Primario",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CUM-FF5776",
        "descripcion": "Filtro Combustible Secundario NanoNet",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CUM-FS19732",
        "descripcion": "Filtro Separador Agua",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "ZL-AF2550",
        "descripcion": "Filtro de Aire Motor Primario Donaldson",
        "marca": "ZOOMLION",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "ZL-HYD-500",
        "descripcion": "Filtro Hidráulico Retorno Pilotera ZR255H",
        "marca": "ZOOMLION",
        "sistema": "Hidráulico",
        "cantidad": 2
      }
    ]
  },
  {
    "id": "kit-zr255h-1000h",
    "nombre": "Kit Preventivo 1000h - Zoomlion ZR255H (Servicio Mayor)",
    "modelo": "ZR255H",
    "marca": "ZOOMLION",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h: Filtración integral motor, aire de seguridad, hidráulico retorno, servomando y bandas.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "CUM-LF9009",
        "descripcion": "Filtro Aceite Motor Cummins QSL8.9",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "CUM-FF5612",
        "descripcion": "Filtro Combustible Primario",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CUM-FF5776",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CUM-FS19732",
        "descripcion": "Filtro Separador Agua",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "ZL-AF2550",
        "descripcion": "Filtro Aire Motor Primario",
        "marca": "ZOOMLION",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "ZL-AF2551",
        "descripcion": "Filtro Aire Motor Secundario Seguridad",
        "marca": "ZOOMLION",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "ZL-HYD-500",
        "descripcion": "Filtro Hidráulico Retorno Principal",
        "marca": "ZOOMLION",
        "sistema": "Hidráulico",
        "cantidad": 2
      },
      {
        "codigo": "ZL-HYD-510",
        "descripcion": "Filtro Hidráulico Línea Piloto / Servomando",
        "marca": "ZOOMLION",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "ZL-HYD-520",
        "descripcion": "Respirador Tanque Hidráulico con Desecante",
        "marca": "ZOOMLION",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "ZL-BELT-89",
        "descripcion": "Banda Serpentina Alternador / Ventilador QSL9",
        "marca": "ZOOMLION / CUMMINS",
        "sistema": "Transmisión",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-rmj110x-250h",
    "nombre": "Kit Preventivo 250h - Rubble Master RMJ110X",
    "modelo": "RMJ110X",
    "marca": "RUBBLE MASTER",
    "intervalo": "250",
    "descripcion": "Mantenimiento preventivo menor para triturador de mandíbulas RMJ110X.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RMJ-510023",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-510045",
        "descripcion": "Filtro Combustible Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-510048",
        "descripcion": "Filtro Separador de Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-rmj110x-500h",
    "nombre": "Kit Preventivo 500h - Rubble Master RMJ110X",
    "modelo": "RMJ110X",
    "marca": "RUBBLE MASTER",
    "intervalo": "500",
    "descripcion": "Mantenimiento preventivo 500h para triturador de mandíbulas RMJ110X.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RMJ-510023",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-510045",
        "descripcion": "Filtro Combustible Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-510046",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-510048",
        "descripcion": "Filtro Separador de Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-520110",
        "descripcion": "Filtro de Aire Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-530080",
        "descripcion": "Filtro Hidráulico Retorno",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-rmj110x-1000h",
    "nombre": "Kit Preventivo 1000h - Rubble Master RMJ110X",
    "modelo": "RMJ110X",
    "marca": "RUBBLE MASTER",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h para triturador de mandíbulas RMJ110X.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "RMJ-510023",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "RUBBLE MASTER",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-510045",
        "descripcion": "Filtro Combustible Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-510046",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-510048",
        "descripcion": "Filtro Separador de Agua",
        "marca": "RUBBLE MASTER",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-520110",
        "descripcion": "Filtro Aire Primario",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-520111",
        "descripcion": "Filtro Aire Secundario Seguridad",
        "marca": "RUBBLE MASTER",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-530080",
        "descripcion": "Filtro Hidráulico Retorno",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-530085",
        "descripcion": "Filtro Hidráulico Presión",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-530090",
        "descripcion": "Respirador Tanque Hidráulico",
        "marca": "RUBBLE MASTER",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "RMJ-540200",
        "descripcion": "Juego de Bandas de Transmisión Volante",
        "marca": "RUBBLE MASTER",
        "sistema": "Transmisión",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-fiori-db460-250h",
    "nombre": "Kit Preventivo 250h - Fiori DB 460 CBV",
    "modelo": "DB 460 CBV",
    "marca": "FIORI",
    "intervalo": "250",
    "descripcion": "Mantenimiento preventivo básico 250h para autohormigonera Fiori DB 460 CBV (Motor Perkins).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "FIO-2654403",
        "descripcion": "Filtro de Aceite Motor Perkins",
        "marca": "FIORI",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "FIO-26560201",
        "descripcion": "Filtro Combustible Primario",
        "marca": "FIORI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FIO-26560143",
        "descripcion": "Filtro Separador de Agua Pre-filtro",
        "marca": "FIORI",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-fiori-db460-500h",
    "nombre": "Kit Preventivo 500h - Fiori DB 460 CBV",
    "modelo": "DB 460 CBV",
    "marca": "FIORI",
    "intervalo": "500",
    "descripcion": "Mantenimiento 500h: Filtración de motor, aire primario e hidráulico de circuito cerrado/abierto.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "FIO-2654403",
        "descripcion": "Filtro de Aceite Motor Perkins",
        "marca": "FIORI",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "FIO-26560201",
        "descripcion": "Filtro Combustible Primario",
        "marca": "FIORI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FIO-26560143",
        "descripcion": "Filtro Separador de Agua",
        "marca": "FIORI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FIO-443401",
        "descripcion": "Filtro de Aire Motor Primario",
        "marca": "FIORI",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "FIO-705201",
        "descripcion": "Filtro Hidráulico de Retorno Tambor",
        "marca": "FIORI",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-fiori-db460-1000h",
    "nombre": "Kit Preventivo 1000h - Fiori DB 460 CBV",
    "modelo": "DB 460 CBV",
    "marca": "FIORI",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h: Reemplazo integral de filtración de motor, aire, transmisión hidrostática e hidráulica.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "FIO-2654403",
        "descripcion": "Filtro de Aceite Motor Perkins",
        "marca": "FIORI",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "FIO-26560201",
        "descripcion": "Filtro Combustible Primario",
        "marca": "FIORI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FIO-26560143",
        "descripcion": "Filtro Separador de Agua",
        "marca": "FIORI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FIO-443401",
        "descripcion": "Filtro de Aire Motor Primario",
        "marca": "FIORI",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "FIO-443402",
        "descripcion": "Filtro de Aire Motor de Seguridad",
        "marca": "FIORI",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "FIO-705201",
        "descripcion": "Filtro Hidráulico de Retorno",
        "marca": "FIORI",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "FIO-705205",
        "descripcion": "Filtro Hidrostático de Alta Presión",
        "marca": "FIORI",
        "sistema": "Transmisión",
        "cantidad": 1
      },
      {
        "codigo": "FIO-801220",
        "descripcion": "Respirador Tanque Hidráulico",
        "marca": "FIORI",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-casagrande-b125-250h",
    "nombre": "Kit Preventivo 250h - Casagrande B125 XP",
    "modelo": "B125 XP",
    "marca": "CASA GRANDE",
    "intervalo": "250",
    "descripcion": "Servicio preventivo básico 250h para perforadora Casagrande B125 XP (Motor Cummins QSB6.7).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "CG-LF3970",
        "descripcion": "Filtro Aceite Motor Cummins QSB6.7",
        "marca": "CASA GRANDE",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "CG-FF5488",
        "descripcion": "Filtro Combustible Primario",
        "marca": "CASA GRANDE",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CG-FS19732",
        "descripcion": "Filtro Separador de Agua",
        "marca": "CASA GRANDE",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-casagrande-b125-500h",
    "nombre": "Kit Preventivo 500h - Casagrande B125 XP",
    "modelo": "B125 XP",
    "marca": "CASA GRANDE",
    "intervalo": "500",
    "descripcion": "Servicio preventivo 500h para perforadora Casagrande B125 XP.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "CG-LF3970",
        "descripcion": "Filtro Aceite Motor Cummins",
        "marca": "CASA GRANDE",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "CG-FF5488",
        "descripcion": "Filtro Combustible Primario",
        "marca": "CASA GRANDE",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CG-FF5612",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "CASA GRANDE",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CG-FS19732",
        "descripcion": "Filtro Separador de Agua",
        "marca": "CASA GRANDE",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CG-AF25292",
        "descripcion": "Filtro Aire Motor Primario",
        "marca": "CASA GRANDE",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "CG-HYD-125",
        "descripcion": "Filtro Hidráulico de Retorno",
        "marca": "CASA GRANDE",
        "sistema": "Hidráulico",
        "cantidad": 2
      }
    ]
  },
  {
    "id": "kit-casagrande-b125-1000h",
    "nombre": "Kit Preventivo 1000h - Casagrande B125 XP",
    "modelo": "B125 XP",
    "marca": "CASA GRANDE",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h para perforadora Casagrande B125 XP (Filtración integral).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "CG-LF3970",
        "descripcion": "Filtro Aceite Motor Cummins",
        "marca": "CASA GRANDE",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "CG-FF5488",
        "descripcion": "Filtro Combustible Primario",
        "marca": "CASA GRANDE",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CG-FF5612",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "CASA GRANDE",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CG-FS19732",
        "descripcion": "Filtro Separador de Agua",
        "marca": "CASA GRANDE",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CG-AF25292",
        "descripcion": "Filtro Aire Primario",
        "marca": "CASA GRANDE",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "CG-AF25293",
        "descripcion": "Filtro Aire Secundario Seguridad",
        "marca": "CASA GRANDE",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "CG-HYD-125",
        "descripcion": "Filtro Hidráulico de Retorno",
        "marca": "CASA GRANDE",
        "sistema": "Hidráulico",
        "cantidad": 2
      },
      {
        "codigo": "CG-HYD-130",
        "descripcion": "Filtro Servomando / Piloto",
        "marca": "CASA GRANDE",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "CG-HYD-140",
        "descripcion": "Respirador Tanque Hidráulico",
        "marca": "CASA GRANDE",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-hyundai-hx220l-250h",
    "nombre": "Kit Preventivo 250h - Hyundai HX220L",
    "modelo": "HX220L",
    "marca": "HYUNDAI",
    "intervalo": "250",
    "descripcion": "Servicio menor 250h para excavadora Hyundai HX220L (Motor Cummins QSB6.7).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "HY-11N6-90510",
        "descripcion": "Filtro de Aceite Motor Cummins",
        "marca": "HYUNDAI",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "HY-11E1-70120",
        "descripcion": "Filtro de Combustible Primario",
        "marca": "HYUNDAI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "HY-11N6-90520",
        "descripcion": "Filtro Separador de Agua",
        "marca": "HYUNDAI",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-hyundai-hx220l-500h",
    "nombre": "Kit Preventivo 500h - Hyundai HX220L",
    "modelo": "HX220L",
    "marca": "HYUNDAI",
    "intervalo": "500",
    "descripcion": "Servicio 500h: Motor, combustible, aire e hidráulico de retorno para Hyundai HX220L.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "HY-11N6-90510",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "HYUNDAI",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "HY-11E1-70120",
        "descripcion": "Filtro Combustible Primario",
        "marca": "HYUNDAI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "HY-11E1-70130",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "HYUNDAI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "HY-11N6-90520",
        "descripcion": "Filtro Separador de Agua",
        "marca": "HYUNDAI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "HY-11NA-90110",
        "descripcion": "Filtro de Aire Primario",
        "marca": "HYUNDAI",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "HY-31N8-01360",
        "descripcion": "Filtro Hidráulico de Retorno",
        "marca": "HYUNDAI",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-hyundai-hx220l-1000h",
    "nombre": "Kit Preventivo 1000h - Hyundai HX220L",
    "modelo": "HX220L",
    "marca": "HYUNDAI",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h para excavadora Hyundai HX220L (Filtración completa y drenaje piloto).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "HY-11N6-90510",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "HYUNDAI",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "HY-11E1-70120",
        "descripcion": "Filtro Combustible Primario",
        "marca": "HYUNDAI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "HY-11E1-70130",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "HYUNDAI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "HY-11N6-90520",
        "descripcion": "Filtro Separador Agua",
        "marca": "HYUNDAI",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "HY-11NA-90110",
        "descripcion": "Filtro Aire Primario",
        "marca": "HYUNDAI",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "HY-11NA-90120",
        "descripcion": "Filtro Aire Secundario Seguridad",
        "marca": "HYUNDAI",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "HY-31N8-01360",
        "descripcion": "Filtro Hidráulico Retorno",
        "marca": "HYUNDAI",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "HY-31N8-01370",
        "descripcion": "Filtro Hidráulico Línea Piloto",
        "marca": "HYUNDAI",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "HY-31N8-01380",
        "descripcion": "Respirador Tanque Hidráulico",
        "marca": "HYUNDAI",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-cifa-k45h-250h",
    "nombre": "Kit Preventivo 250h - CIFA K45H / K38L",
    "modelo": "K45H",
    "marca": "CIFA",
    "intervalo": "250",
    "descripcion": "Servicio básico preventivo 250h para bomba de concreto CIFA (Motor y bombeo).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "CIF-102931",
        "descripcion": "Filtro Aceite Motor Camión / Bomba",
        "marca": "CIFA",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "CIF-102945",
        "descripcion": "Filtro Combustible Primario",
        "marca": "CIFA",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CIF-102948",
        "descripcion": "Filtro Separador de Agua",
        "marca": "CIFA",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-cifa-k45h-500h",
    "nombre": "Kit Preventivo 500h - CIFA K45H / K38L",
    "modelo": "K45H",
    "marca": "CIFA",
    "intervalo": "500",
    "descripcion": "Servicio 500h: Filtración de motor, aire y retorno del circuito hidráulico de bombeo.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "CIF-102931",
        "descripcion": "Filtro Aceite Motor",
        "marca": "CIFA",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "CIF-102945",
        "descripcion": "Filtro Combustible Primario",
        "marca": "CIFA",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CIF-102946",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "CIFA",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CIF-102948",
        "descripcion": "Filtro Separador de Agua",
        "marca": "CIFA",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CIF-220110",
        "descripcion": "Filtro Aire Motor Primario",
        "marca": "CIFA",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "CIF-330080",
        "descripcion": "Filtro Hidráulico Retorno Circuito Bombeo",
        "marca": "CIFA",
        "sistema": "Hidráulico",
        "cantidad": 2
      }
    ]
  },
  {
    "id": "kit-cifa-k45h-1000h",
    "nombre": "Kit Preventivo 1000h - CIFA K45H / K38L",
    "modelo": "K45H",
    "marca": "CIFA",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h: Filtración completa de motor, aire de seguridad, hidráulica cerrada y acumuladores de nitrógeno.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "CIF-102931",
        "descripcion": "Filtro Aceite Motor",
        "marca": "CIFA",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "CIF-102945",
        "descripcion": "Filtro Combustible Primario",
        "marca": "CIFA",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CIF-102946",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "CIFA",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CIF-102948",
        "descripcion": "Filtro Separador de Agua",
        "marca": "CIFA",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "CIF-220110",
        "descripcion": "Filtro Aire Motor Primario",
        "marca": "CIFA",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "CIF-220111",
        "descripcion": "Filtro Aire Secundario Seguridad",
        "marca": "CIFA",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "CIF-330080",
        "descripcion": "Filtro Hidráulico Retorno Bombeo",
        "marca": "CIFA",
        "sistema": "Hidráulico",
        "cantidad": 2
      },
      {
        "codigo": "CIF-330085",
        "descripcion": "Filtro Hidráulico Alta Presión Circuito Cerrado",
        "marca": "CIFA",
        "sistema": "Hidráulico",
        "cantidad": 2
      },
      {
        "codigo": "CIF-330090",
        "descripcion": "Respirador Tanque Hidráulico con Desecante",
        "marca": "CIFA",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-simem-eagle2500-250h",
    "nombre": "Kit Preventivo 250h - Simem EAGLE 2500 / MEB 2000",
    "modelo": "EAGLE 2500",
    "marca": "SIMEM",
    "intervalo": "250",
    "descripcion": "Mantenimiento preventivo básico 250h: Deshumidificación neumática y lubricación de compuertas.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "SIM-FL-01",
        "descripcion": "Filtro Regulador de Aire Comprimido Neumática",
        "marca": "SIMEM",
        "sistema": "Neumático",
        "cantidad": 1
      },
      {
        "codigo": "SIM-LUB-01",
        "descripcion": "Cartucho Aceite Lubricador de Línea Neumática",
        "marca": "SIMEM",
        "sistema": "Neumático",
        "cantidad": 1
      },
      {
        "codigo": "SIM-HYD-01",
        "descripcion": "Filtro Aceite Unidad Hidráulica Compuerta Descarga",
        "marca": "SIMEM",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-simem-eagle2500-500h",
    "nombre": "Kit Preventivo 500h - Simem EAGLE 2500 / MEB 2000",
    "modelo": "EAGLE 2500",
    "marca": "SIMEM",
    "intervalo": "500",
    "descripcion": "Mantenimiento preventivo 500h: Filtración de aire comprimido, mangas de despresurización y aceite reductor.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "SIM-FL-01",
        "descripcion": "Filtro Regulador Aire Comprimido",
        "marca": "SIMEM",
        "sistema": "Neumático",
        "cantidad": 1
      },
      {
        "codigo": "SIM-FL-02",
        "descripcion": "Filtro Coalescente Desoleador Neumática",
        "marca": "SIMEM",
        "sistema": "Neumático",
        "cantidad": 1
      },
      {
        "codigo": "SIM-MAN-10",
        "descripcion": "Juego de Filtros Manga Despresurización Mezcladora",
        "marca": "SIMEM",
        "sistema": "Filtración Mezcla",
        "cantidad": 1
      },
      {
        "codigo": "SIM-HYD-01",
        "descripcion": "Filtro Aceite Hidráulica Compuerta Descarga",
        "marca": "SIMEM",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "SIM-OIL-RED",
        "descripcion": "Aceite Sintético Reductor Mezclador Planetario",
        "marca": "SIMEM",
        "sistema": "Transmisión",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-simem-eagle2500-1000h",
    "nombre": "Kit Preventivo 1000h - Simem EAGLE 2500 / MEB 2000",
    "modelo": "EAGLE 2500",
    "marca": "SIMEM",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h: Filtración integral de compresor, filtros de aire de silos y reductores planetarios.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "SIM-FL-01",
        "descripcion": "Filtro Regulador Aire Comprimido",
        "marca": "SIMEM",
        "sistema": "Neumático",
        "cantidad": 1
      },
      {
        "codigo": "SIM-FL-02",
        "descripcion": "Filtro Coalescente Desoleador",
        "marca": "SIMEM",
        "sistema": "Neumático",
        "cantidad": 1
      },
      {
        "codigo": "SIM-SILO-01",
        "descripcion": "Cartucho Filtro Desempolvador Silo de Cemento",
        "marca": "SIMEM",
        "sistema": "Filtración Silo",
        "cantidad": 2
      },
      {
        "codigo": "SIM-MAN-10",
        "descripcion": "Juego de Mangas Filtro Mezcladora",
        "marca": "SIMEM",
        "sistema": "Filtración Mezcla",
        "cantidad": 1
      },
      {
        "codigo": "SIM-HYD-01",
        "descripcion": "Filtro Aceite Unidad Hidráulica",
        "marca": "SIMEM",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "SIM-HYD-02",
        "descripcion": "Respirador Tanque Hidráulico Compuerta",
        "marca": "SIMEM",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-cummins-qsb67-250h",
    "nombre": "Kit Preventivo 250h - Motor Cummins QSB6.7 / QSL9",
    "modelo": "QSB6.7",
    "marca": "CUMMINS",
    "intervalo": "250",
    "descripcion": "Servicio preventivo básico 250h para motores Cummins industriales (Fleetguard).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "LF3970",
        "descripcion": "Filtro de Aceite Lubricante Motor Cummins Fleetguard LF3970",
        "marca": "CUMMINS",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "FF5488",
        "descripcion": "Filtro de Combustible Primario Fleetguard FF5488",
        "marca": "CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FS19732",
        "descripcion": "Filtro Separador de Agua / Combustible Fleetguard FS19732",
        "marca": "CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-cummins-qsb67-500h",
    "nombre": "Kit Preventivo 500h - Motor Cummins QSB6.7 / QSL9",
    "modelo": "QSB6.7",
    "marca": "CUMMINS",
    "intervalo": "500",
    "descripcion": "Servicio intermedio 500h: Filtración completa de lubricación, combustible NanoNet y aire.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "LF3970",
        "descripcion": "Filtro de Aceite Lubricante Cummins LF3970",
        "marca": "CUMMINS",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "FF5488",
        "descripcion": "Filtro Combustible Primario FF5488",
        "marca": "CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FF5612",
        "descripcion": "Filtro Combustible Secundario NanoNet FF5612",
        "marca": "CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FS19732",
        "descripcion": "Filtro Separador de Agua FS19732",
        "marca": "CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "AF25292",
        "descripcion": "Filtro de Aire Motor Primario Fleetguard AF25292",
        "marca": "CUMMINS",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-cummins-qsb67-1000h",
    "nombre": "Kit Preventivo 1000h - Motor Cummins QSB6.7 / QSL9",
    "modelo": "QSB6.7",
    "marca": "CUMMINS",
    "intervalo": "1000",
    "descripcion": "Servicio mayor 1000h: Filtración integral de motor Cummins, aire de seguridad, refrigerante y bandas.",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "LF3970",
        "descripcion": "Filtro Aceite Lubricante Cummins LF3970",
        "marca": "CUMMINS",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "FF5488",
        "descripcion": "Filtro Combustible Primario FF5488",
        "marca": "CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FF5612",
        "descripcion": "Filtro Combustible Secundario NanoNet FF5612",
        "marca": "CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "FS19732",
        "descripcion": "Filtro Separador de Agua FS19732",
        "marca": "CUMMINS",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "AF25292",
        "descripcion": "Filtro Aire Motor Primario AF25292",
        "marca": "CUMMINS",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "AF25293",
        "descripcion": "Filtro Aire Motor Secundario Seguridad AF25293",
        "marca": "CUMMINS",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "WF2071",
        "descripcion": "Filtro de Agua / Refrigerante Cummins con Aditivo DCA4",
        "marca": "CUMMINS",
        "sistema": "Refrigeración",
        "cantidad": 1
      },
      {
        "codigo": "CUM-3974456",
        "descripcion": "Banda Serpentina de Accesorios Motor Cummins QSB6.7",
        "marca": "CUMMINS",
        "sistema": "Transmisión",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-universal-250h",
    "nombre": "Kit Preventivo Universal 250h (Multimarca)",
    "modelo": "Universal",
    "marca": "UNIVERSAL",
    "intervalo": "250",
    "descripcion": "Kit estándar universal para servicio preventivo de 250 horas (Aceite motor y combustible).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "UNI-FIL-01",
        "descripcion": "Filtro de Aceite Motor Universal",
        "marca": "UNIVERSAL",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-02",
        "descripcion": "Filtro de Combustible Primario Universal",
        "marca": "UNIVERSAL",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-03",
        "descripcion": "Filtro Separador de Agua Universal",
        "marca": "UNIVERSAL",
        "sistema": "Combustible",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-universal-500h",
    "nombre": "Kit Preventivo Universal 500h (Multimarca)",
    "modelo": "Universal",
    "marca": "UNIVERSAL",
    "intervalo": "500",
    "descripcion": "Kit estándar universal para servicio preventivo de 500 horas (Motor, combustible, aire e hidráulico).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "UNI-FIL-01",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "UNIVERSAL",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-02",
        "descripcion": "Filtro de Combustible Primario",
        "marca": "UNIVERSAL",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-04",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "UNIVERSAL",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-03",
        "descripcion": "Filtro Separador de Agua",
        "marca": "UNIVERSAL",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-05",
        "descripcion": "Filtro de Aire Motor Primario",
        "marca": "UNIVERSAL",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-06",
        "descripcion": "Filtro Hidráulico de Retorno",
        "marca": "UNIVERSAL",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  },
  {
    "id": "kit-universal-1000h",
    "nombre": "Kit Preventivo Universal 1000h (Multimarca)",
    "modelo": "Universal",
    "marca": "UNIVERSAL",
    "intervalo": "1000",
    "descripcion": "Kit estándar universal para servicio preventivo mayor de 1000 horas (Filtración completa de todos los sistemas).",
    "esOficial": true,
    "piezas": [
      {
        "codigo": "UNI-FIL-01",
        "descripcion": "Filtro de Aceite Motor",
        "marca": "UNIVERSAL",
        "sistema": "Motor",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-02",
        "descripcion": "Filtro Combustible Primario",
        "marca": "UNIVERSAL",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-04",
        "descripcion": "Filtro Combustible Secundario",
        "marca": "UNIVERSAL",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-03",
        "descripcion": "Filtro Separador de Agua",
        "marca": "UNIVERSAL",
        "sistema": "Combustible",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-05",
        "descripcion": "Filtro Aire Motor Primario",
        "marca": "UNIVERSAL",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-07",
        "descripcion": "Filtro Aire Motor Secundario Seguridad",
        "marca": "UNIVERSAL",
        "sistema": "Aire / Admisión",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-06",
        "descripcion": "Filtro Hidráulico Retorno",
        "marca": "UNIVERSAL",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-08",
        "descripcion": "Filtro Hidráulico Alta Presión",
        "marca": "UNIVERSAL",
        "sistema": "Hidráulico",
        "cantidad": 1
      },
      {
        "codigo": "UNI-FIL-09",
        "descripcion": "Respirador / Filtro Aire Tanque Hidráulico",
        "marca": "UNIVERSAL",
        "sistema": "Hidráulico",
        "cantidad": 1
      }
    ]
  }
]'::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET 
    data = EXCLUDED.data,
    updated_at = NOW();
