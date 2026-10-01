/**
 * Módulo de Kits de Servicio Preventivo y Machotes de Mantenimiento - Eurorep / SAPI
 * Cubre intervalos de 250h, 500h, 1000h, catálogo maestro, modales y exportación.
 */
// =========================================================================
// MÓDULO DE KITS DE SERVICIO PREVENTIVO POR MAQUINARIA (250h, 500h, 1000h)
// =========================================================================

const KITS_PRECARGADOS_DEFAULT = [
  // --- RUBBLE MASTER RM120X / RM120GO! ---
  {
    id: 'kit-rm120x-250h',
    nombre: 'Kit Preventivo 250h - Rubble Master RM120X / RM120GO!',
    modelo: 'RM120X',
    marca: 'RUBBLE MASTER',
    intervalo: '250',
    descripcion: 'Servicio preventivo menor: Reemplazo de filtro de aceite motor, filtro combustible primario y separador de agua.',
    esOficial: true,
    piezas: [
      { codigo: 'RM-510023', descripcion: 'Filtro de Aceite Motor John Deere / Volvo', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RM-510045', descripcion: 'Filtro de Combustible Primario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-510048', descripcion: 'Filtro Separador de Agua y Pre-combustible', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-rm120x-500h',
    nombre: 'Kit Preventivo 500h - Rubble Master RM120X / RM120GO!',
    modelo: 'RM120X',
    marca: 'RUBBLE MASTER',
    intervalo: '500',
    descripcion: 'Servicio preventivo intermedio: Reemplazo completo de filtros de motor, aire primario e hidráulico de retorno.',
    esOficial: true,
    piezas: [
      { codigo: 'RM-510023', descripcion: 'Filtro de Aceite Motor', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RM-510045', descripcion: 'Filtro Combustible Primario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-510046', descripcion: 'Filtro Combustible Secundario / Fino', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-510048', descripcion: 'Filtro Separador de Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-520110', descripcion: 'Filtro de Aire Motor Primario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RM-530080', descripcion: 'Filtro Hidráulico de Retorno', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },
  {
    id: 'kit-rm120x-1000h',
    nombre: 'Kit Preventivo 1000h - Rubble Master RM120X / RM120GO!',
    modelo: 'RM120X',
    marca: 'RUBBLE MASTER',
    intervalo: '1000',
    descripcion: 'Servicio preventivo mayor / 1000h: Filtración integral de motor, aire de seguridad, hidráulica completa, respiradores y bandas.',
    esOficial: true,
    piezas: [
      { codigo: 'RM-510023', descripcion: 'Filtro de Aceite Motor', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RM-510045', descripcion: 'Filtro Combustible Primario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-510046', descripcion: 'Filtro Combustible Secundario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-510048', descripcion: 'Filtro Separador de Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-520110', descripcion: 'Filtro de Aire Motor Primario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RM-520111', descripcion: 'Filtro de Aire Motor Secundario (Seguridad)', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RM-530080', descripcion: 'Filtro Hidráulico de Retorno', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RM-530085', descripcion: 'Filtro Hidráulico de Presión Alta', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RM-530090', descripcion: 'Respirador / Filtro Aire Tanque Hidráulico', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RM-540200', descripcion: 'Juego de Bandas de Transmisión Motor / Rotor', marca: 'RUBBLE MASTER', sistema: 'Transmisión', cantidad: 1 }
    ]
  },

  // --- RUBBLE MASTER MS125GO! (CRIBA) ---
  {
    id: 'kit-ms125go-250h',
    nombre: 'Kit Preventivo 250h - Rubble Master MS125GO!',
    modelo: 'MS125GO!',
    marca: 'RUBBLE MASTER',
    intervalo: '250',
    descripcion: 'Mantenimiento preventivo básico 250h para criba MS125GO! (Motor Deutz / CAT).',
    esOficial: true,
    piezas: [
      { codigo: 'RM-MS-023', descripcion: 'Filtro de Aceite Motor Deutz / CAT', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RM-MS-045', descripcion: 'Filtro de Combustible en Línea', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-MS-048', descripcion: 'Filtro Separador Agua Combustible', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-ms125go-500h',
    nombre: 'Kit Preventivo 500h - Rubble Master MS125GO!',
    modelo: 'MS125GO!',
    marca: 'RUBBLE MASTER',
    intervalo: '500',
    descripcion: 'Mantenimiento preventivo 500h: Filtros de motor, aire primario e hidráulico de circuito de cribado.',
    esOficial: true,
    piezas: [
      { codigo: 'RM-MS-023', descripcion: 'Filtro de Aceite Motor', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RM-MS-045', descripcion: 'Filtro de Combustible', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-MS-048', descripcion: 'Filtro Separador Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-MS-110', descripcion: 'Filtro de Aire Primario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RM-MS-080', descripcion: 'Filtro Hidráulico Criba', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },
  {
    id: 'kit-ms125go-1000h',
    nombre: 'Kit Preventivo 1000h - Rubble Master MS125GO!',
    modelo: 'MS125GO!',
    marca: 'RUBBLE MASTER',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h: Filtración completa de motor y sistema hidráulico de tracción y cribado.',
    esOficial: true,
    piezas: [
      { codigo: 'RM-MS-023', descripcion: 'Filtro de Aceite Motor', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RM-MS-045', descripcion: 'Filtro de Combustible', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-MS-048', descripcion: 'Filtro Separador Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-MS-110', descripcion: 'Filtro de Aire Primario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RM-MS-111', descripcion: 'Filtro de Aire Secundario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RM-MS-080', descripcion: 'Filtro Hidráulico Criba', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RM-MS-085', descripcion: 'Filtro Hidráulico Presión', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RM-MS-090', descripcion: 'Respirador Tanque Hidráulico', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },

  // --- RUBBLE MASTER RM100GO! / RM70 ---
  {
    id: 'kit-rm100go-250h',
    nombre: 'Kit Preventivo 250h - Rubble Master RM100GO! / RM70',
    modelo: 'RM100Go!',
    marca: 'RUBBLE MASTER',
    intervalo: '250',
    descripcion: 'Servicio preventivo menor 250h para trituradoras RM100 / RM70.',
    esOficial: true,
    piezas: [
      { codigo: 'RM-100-023', descripcion: 'Filtro de Aceite Motor John Deere', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RM-100-045', descripcion: 'Filtro de Combustible Primario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-100-048', descripcion: 'Filtro Separador de Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-rm100go-500h',
    nombre: 'Kit Preventivo 500h - Rubble Master RM100GO! / RM70',
    modelo: 'RM100Go!',
    marca: 'RUBBLE MASTER',
    intervalo: '500',
    descripcion: 'Servicio preventivo intermedio 500h para trituradoras RM100 / RM70.',
    esOficial: true,
    piezas: [
      { codigo: 'RM-100-023', descripcion: 'Filtro de Aceite Motor', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RM-100-045', descripcion: 'Filtro Combustible Primario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-100-046', descripcion: 'Filtro Combustible Secundario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-100-048', descripcion: 'Filtro Separador de Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-100-110', descripcion: 'Filtro de Aire Primario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RM-100-080', descripcion: 'Filtro Hidráulico de Retorno', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },
  {
    id: 'kit-rm100go-1000h',
    nombre: 'Kit Preventivo 1000h - Rubble Master RM100GO! / RM70',
    modelo: 'RM100Go!',
    marca: 'RUBBLE MASTER',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h para trituradoras RM100 / RM70.',
    esOficial: true,
    piezas: [
      { codigo: 'RM-100-023', descripcion: 'Filtro de Aceite Motor', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RM-100-045', descripcion: 'Filtro Combustible Primario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-100-046', descripcion: 'Filtro Combustible Secundario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-100-048', descripcion: 'Filtro Separador de Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RM-100-110', descripcion: 'Filtro de Aire Primario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RM-100-111', descripcion: 'Filtro de Aire Secundario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RM-100-080', descripcion: 'Filtro Hidráulico Retorno', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RM-100-085', descripcion: 'Filtro Hidráulico Presión', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RM-100-090', descripcion: 'Respirador Tanque Hidráulico', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RM-100-200', descripcion: 'Juego de Bandas de Transmisión Rotor', marca: 'RUBBLE MASTER', sistema: 'Transmisión', cantidad: 1 }
    ]
  },

  // --- ZOOMLION ZR255H (PILOTERA CIMENTACIÓN) ---
  {
    id: 'kit-zr255h-250h',
    nombre: 'Kit Preventivo 250h - Zoomlion ZR255H (Motor Cummins QSL8.9)',
    modelo: 'ZR255H',
    marca: 'ZOOMLION',
    intervalo: '250',
    descripcion: 'Servicio menor 250h para perforadora / pilotera Zoomlion ZR255H.',
    esOficial: true,
    piezas: [
      { codigo: 'CUM-LF9009', descripcion: 'Filtro Aceite Lubricante Motor Cummins QSL8.9', marca: 'ZOOMLION / CUMMINS', sistema: 'Motor', cantidad: 1 },
      { codigo: 'CUM-FF5612', descripcion: 'Filtro Combustible Primario Fleetguard', marca: 'ZOOMLION / CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CUM-FS19732', descripcion: 'Filtro Separador Agua / Combustible', marca: 'ZOOMLION / CUMMINS', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-zr255h-500h',
    nombre: 'Kit Preventivo 500h - Zoomlion ZR255H (Motor Cummins QSL8.9)',
    modelo: 'ZR255H',
    marca: 'ZOOMLION',
    intervalo: '500',
    descripcion: 'Servicio intermedio 500h: Motor Cummins, admisión y filtros de retorno hidráulico.',
    esOficial: true,
    piezas: [
      { codigo: 'CUM-LF9009', descripcion: 'Filtro Aceite Motor Cummins QSL8.9', marca: 'ZOOMLION / CUMMINS', sistema: 'Motor', cantidad: 1 },
      { codigo: 'CUM-FF5612', descripcion: 'Filtro Combustible Primario', marca: 'ZOOMLION / CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CUM-FF5776', descripcion: 'Filtro Combustible Secundario NanoNet', marca: 'ZOOMLION / CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CUM-FS19732', descripcion: 'Filtro Separador Agua', marca: 'ZOOMLION / CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'ZL-AF2550', descripcion: 'Filtro de Aire Motor Primario Donaldson', marca: 'ZOOMLION', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'ZL-HYD-500', descripcion: 'Filtro Hidráulico Retorno Pilotera ZR255H', marca: 'ZOOMLION', sistema: 'Hidráulico', cantidad: 2 }
    ]
  },
  {
    id: 'kit-zr255h-1000h',
    nombre: 'Kit Preventivo 1000h - Zoomlion ZR255H (Servicio Mayor)',
    modelo: 'ZR255H',
    marca: 'ZOOMLION',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h: Filtración integral motor, aire de seguridad, hidráulico retorno, servomando y bandas.',
    esOficial: true,
    piezas: [
      { codigo: 'CUM-LF9009', descripcion: 'Filtro Aceite Motor Cummins QSL8.9', marca: 'ZOOMLION / CUMMINS', sistema: 'Motor', cantidad: 1 },
      { codigo: 'CUM-FF5612', descripcion: 'Filtro Combustible Primario', marca: 'ZOOMLION / CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CUM-FF5776', descripcion: 'Filtro Combustible Secundario', marca: 'ZOOMLION / CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CUM-FS19732', descripcion: 'Filtro Separador Agua', marca: 'ZOOMLION / CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'ZL-AF2550', descripcion: 'Filtro Aire Motor Primario', marca: 'ZOOMLION', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'ZL-AF2551', descripcion: 'Filtro Aire Motor Secundario Seguridad', marca: 'ZOOMLION', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'ZL-HYD-500', descripcion: 'Filtro Hidráulico Retorno Principal', marca: 'ZOOMLION', sistema: 'Hidráulico', cantidad: 2 },
      { codigo: 'ZL-HYD-510', descripcion: 'Filtro Hidráulico Línea Piloto / Servomando', marca: 'ZOOMLION', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'ZL-HYD-520', descripcion: 'Respirador Tanque Hidráulico con Desecante', marca: 'ZOOMLION', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'ZL-BELT-89', descripcion: 'Banda Serpentina Alternador / Ventilador QSL9', marca: 'ZOOMLION / CUMMINS', sistema: 'Transmisión', cantidad: 1 }
    ]
  },

  // --- RUBBLE MASTER RMJ110X (TRITURADORA MANDÍBULAS) ---
  {
    id: 'kit-rmj110x-250h',
    nombre: 'Kit Preventivo 250h - Rubble Master RMJ110X',
    modelo: 'RMJ110X',
    marca: 'RUBBLE MASTER',
    intervalo: '250',
    descripcion: 'Mantenimiento preventivo menor para triturador de mandíbulas RMJ110X.',
    esOficial: true,
    piezas: [
      { codigo: 'RMJ-510023', descripcion: 'Filtro de Aceite Motor', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RMJ-510045', descripcion: 'Filtro Combustible Primario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RMJ-510048', descripcion: 'Filtro Separador de Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-rmj110x-500h',
    nombre: 'Kit Preventivo 500h - Rubble Master RMJ110X',
    modelo: 'RMJ110X',
    marca: 'RUBBLE MASTER',
    intervalo: '500',
    descripcion: 'Mantenimiento preventivo 500h para triturador de mandíbulas RMJ110X.',
    esOficial: true,
    piezas: [
      { codigo: 'RMJ-510023', descripcion: 'Filtro de Aceite Motor', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RMJ-510045', descripcion: 'Filtro Combustible Primario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RMJ-510046', descripcion: 'Filtro Combustible Secundario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RMJ-510048', descripcion: 'Filtro Separador de Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RMJ-520110', descripcion: 'Filtro de Aire Primario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RMJ-530080', descripcion: 'Filtro Hidráulico Retorno', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },
  {
    id: 'kit-rmj110x-1000h',
    nombre: 'Kit Preventivo 1000h - Rubble Master RMJ110X',
    modelo: 'RMJ110X',
    marca: 'RUBBLE MASTER',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h para triturador de mandíbulas RMJ110X.',
    esOficial: true,
    piezas: [
      { codigo: 'RMJ-510023', descripcion: 'Filtro de Aceite Motor', marca: 'RUBBLE MASTER', sistema: 'Motor', cantidad: 1 },
      { codigo: 'RMJ-510045', descripcion: 'Filtro Combustible Primario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RMJ-510046', descripcion: 'Filtro Combustible Secundario', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RMJ-510048', descripcion: 'Filtro Separador de Agua', marca: 'RUBBLE MASTER', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'RMJ-520110', descripcion: 'Filtro Aire Primario', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RMJ-520111', descripcion: 'Filtro Aire Secundario Seguridad', marca: 'RUBBLE MASTER', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'RMJ-530080', descripcion: 'Filtro Hidráulico Retorno', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RMJ-530085', descripcion: 'Filtro Hidráulico Presión', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RMJ-530090', descripcion: 'Respirador Tanque Hidráulico', marca: 'RUBBLE MASTER', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'RMJ-540200', descripcion: 'Juego de Bandas de Transmisión Volante', marca: 'RUBBLE MASTER', sistema: 'Transmisión', cantidad: 1 }
    ]
  },

  // --- FIORI (AUTOHORMIGONERAS) ---
  {
    id: 'kit-fiori-db460-250h',
    nombre: 'Kit Preventivo 250h - Fiori DB 460 CBV',
    modelo: 'DB 460 CBV',
    marca: 'FIORI',
    intervalo: '250',
    descripcion: 'Mantenimiento preventivo básico 250h para autohormigonera Fiori DB 460 CBV (Motor Perkins).',
    esOficial: true,
    piezas: [
      { codigo: 'FIO-2654403', descripcion: 'Filtro de Aceite Motor Perkins', marca: 'FIORI', sistema: 'Motor', cantidad: 1 },
      { codigo: 'FIO-26560201', descripcion: 'Filtro Combustible Primario', marca: 'FIORI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FIO-26560143', descripcion: 'Filtro Separador de Agua Pre-filtro', marca: 'FIORI', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-fiori-db460-500h',
    nombre: 'Kit Preventivo 500h - Fiori DB 460 CBV',
    modelo: 'DB 460 CBV',
    marca: 'FIORI',
    intervalo: '500',
    descripcion: 'Mantenimiento 500h: Filtración de motor, aire primario e hidráulico de circuito cerrado/abierto.',
    esOficial: true,
    piezas: [
      { codigo: 'FIO-2654403', descripcion: 'Filtro de Aceite Motor Perkins', marca: 'FIORI', sistema: 'Motor', cantidad: 1 },
      { codigo: 'FIO-26560201', descripcion: 'Filtro Combustible Primario', marca: 'FIORI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FIO-26560143', descripcion: 'Filtro Separador de Agua', marca: 'FIORI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FIO-443401', descripcion: 'Filtro de Aire Motor Primario', marca: 'FIORI', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'FIO-705201', descripcion: 'Filtro Hidráulico de Retorno Tambor', marca: 'FIORI', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },
  {
    id: 'kit-fiori-db460-1000h',
    nombre: 'Kit Preventivo 1000h - Fiori DB 460 CBV',
    modelo: 'DB 460 CBV',
    marca: 'FIORI',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h: Reemplazo integral de filtración de motor, aire, transmisión hidrostática e hidráulica.',
    esOficial: true,
    piezas: [
      { codigo: 'FIO-2654403', descripcion: 'Filtro de Aceite Motor Perkins', marca: 'FIORI', sistema: 'Motor', cantidad: 1 },
      { codigo: 'FIO-26560201', descripcion: 'Filtro Combustible Primario', marca: 'FIORI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FIO-26560143', descripcion: 'Filtro Separador de Agua', marca: 'FIORI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FIO-443401', descripcion: 'Filtro de Aire Motor Primario', marca: 'FIORI', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'FIO-443402', descripcion: 'Filtro de Aire Motor de Seguridad', marca: 'FIORI', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'FIO-705201', descripcion: 'Filtro Hidráulico de Retorno', marca: 'FIORI', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'FIO-705205', descripcion: 'Filtro Hidrostático de Alta Presión', marca: 'FIORI', sistema: 'Transmisión', cantidad: 1 },
      { codigo: 'FIO-801220', descripcion: 'Respirador Tanque Hidráulico', marca: 'FIORI', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },

  // --- CASA GRANDE (PERFORADORAS / PILOTERAS) ---
  {
    id: 'kit-casagrande-b125-250h',
    nombre: 'Kit Preventivo 250h - Casagrande B125 XP',
    modelo: 'B125 XP',
    marca: 'CASA GRANDE',
    intervalo: '250',
    descripcion: 'Servicio preventivo básico 250h para perforadora Casagrande B125 XP (Motor Cummins QSB6.7).',
    esOficial: true,
    piezas: [
      { codigo: 'CG-LF3970', descripcion: 'Filtro Aceite Motor Cummins QSB6.7', marca: 'CASA GRANDE', sistema: 'Motor', cantidad: 1 },
      { codigo: 'CG-FF5488', descripcion: 'Filtro Combustible Primario', marca: 'CASA GRANDE', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CG-FS19732', descripcion: 'Filtro Separador de Agua', marca: 'CASA GRANDE', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-casagrande-b125-500h',
    nombre: 'Kit Preventivo 500h - Casagrande B125 XP',
    modelo: 'B125 XP',
    marca: 'CASA GRANDE',
    intervalo: '500',
    descripcion: 'Servicio preventivo 500h para perforadora Casagrande B125 XP.',
    esOficial: true,
    piezas: [
      { codigo: 'CG-LF3970', descripcion: 'Filtro Aceite Motor Cummins', marca: 'CASA GRANDE', sistema: 'Motor', cantidad: 1 },
      { codigo: 'CG-FF5488', descripcion: 'Filtro Combustible Primario', marca: 'CASA GRANDE', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CG-FF5612', descripcion: 'Filtro Combustible Secundario', marca: 'CASA GRANDE', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CG-FS19732', descripcion: 'Filtro Separador de Agua', marca: 'CASA GRANDE', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CG-AF25292', descripcion: 'Filtro Aire Motor Primario', marca: 'CASA GRANDE', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'CG-HYD-125', descripcion: 'Filtro Hidráulico de Retorno', marca: 'CASA GRANDE', sistema: 'Hidráulico', cantidad: 2 }
    ]
  },
  {
    id: 'kit-casagrande-b125-1000h',
    nombre: 'Kit Preventivo 1000h - Casagrande B125 XP',
    modelo: 'B125 XP',
    marca: 'CASA GRANDE',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h para perforadora Casagrande B125 XP (Filtración integral).',
    esOficial: true,
    piezas: [
      { codigo: 'CG-LF3970', descripcion: 'Filtro Aceite Motor Cummins', marca: 'CASA GRANDE', sistema: 'Motor', cantidad: 1 },
      { codigo: 'CG-FF5488', descripcion: 'Filtro Combustible Primario', marca: 'CASA GRANDE', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CG-FF5612', descripcion: 'Filtro Combustible Secundario', marca: 'CASA GRANDE', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CG-FS19732', descripcion: 'Filtro Separador de Agua', marca: 'CASA GRANDE', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CG-AF25292', descripcion: 'Filtro Aire Primario', marca: 'CASA GRANDE', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'CG-AF25293', descripcion: 'Filtro Aire Secundario Seguridad', marca: 'CASA GRANDE', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'CG-HYD-125', descripcion: 'Filtro Hidráulico de Retorno', marca: 'CASA GRANDE', sistema: 'Hidráulico', cantidad: 2 },
      { codigo: 'CG-HYD-130', descripcion: 'Filtro Servomando / Piloto', marca: 'CASA GRANDE', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'CG-HYD-140', descripcion: 'Respirador Tanque Hidráulico', marca: 'CASA GRANDE', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },

  // --- HYUNDAI (EXCAVADORAS) ---
  {
    id: 'kit-hyundai-hx220l-250h',
    nombre: 'Kit Preventivo 250h - Hyundai HX220L',
    modelo: 'HX220L',
    marca: 'HYUNDAI',
    intervalo: '250',
    descripcion: 'Servicio menor 250h para excavadora Hyundai HX220L (Motor Cummins QSB6.7).',
    esOficial: true,
    piezas: [
      { codigo: 'HY-11N6-90510', descripcion: 'Filtro de Aceite Motor Cummins', marca: 'HYUNDAI', sistema: 'Motor', cantidad: 1 },
      { codigo: 'HY-11E1-70120', descripcion: 'Filtro de Combustible Primario', marca: 'HYUNDAI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'HY-11N6-90520', descripcion: 'Filtro Separador de Agua', marca: 'HYUNDAI', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-hyundai-hx220l-500h',
    nombre: 'Kit Preventivo 500h - Hyundai HX220L',
    modelo: 'HX220L',
    marca: 'HYUNDAI',
    intervalo: '500',
    descripcion: 'Servicio 500h: Motor, combustible, aire e hidráulico de retorno para Hyundai HX220L.',
    esOficial: true,
    piezas: [
      { codigo: 'HY-11N6-90510', descripcion: 'Filtro de Aceite Motor', marca: 'HYUNDAI', sistema: 'Motor', cantidad: 1 },
      { codigo: 'HY-11E1-70120', descripcion: 'Filtro Combustible Primario', marca: 'HYUNDAI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'HY-11E1-70130', descripcion: 'Filtro Combustible Secundario', marca: 'HYUNDAI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'HY-11N6-90520', descripcion: 'Filtro Separador de Agua', marca: 'HYUNDAI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'HY-11NA-90110', descripcion: 'Filtro de Aire Primario', marca: 'HYUNDAI', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'HY-31N8-01360', descripcion: 'Filtro Hidráulico de Retorno', marca: 'HYUNDAI', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },
  {
    id: 'kit-hyundai-hx220l-1000h',
    nombre: 'Kit Preventivo 1000h - Hyundai HX220L',
    modelo: 'HX220L',
    marca: 'HYUNDAI',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h para excavadora Hyundai HX220L (Filtración completa y drenaje piloto).',
    esOficial: true,
    piezas: [
      { codigo: 'HY-11N6-90510', descripcion: 'Filtro de Aceite Motor', marca: 'HYUNDAI', sistema: 'Motor', cantidad: 1 },
      { codigo: 'HY-11E1-70120', descripcion: 'Filtro Combustible Primario', marca: 'HYUNDAI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'HY-11E1-70130', descripcion: 'Filtro Combustible Secundario', marca: 'HYUNDAI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'HY-11N6-90520', descripcion: 'Filtro Separador Agua', marca: 'HYUNDAI', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'HY-11NA-90110', descripcion: 'Filtro Aire Primario', marca: 'HYUNDAI', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'HY-11NA-90120', descripcion: 'Filtro Aire Secundario Seguridad', marca: 'HYUNDAI', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'HY-31N8-01360', descripcion: 'Filtro Hidráulico Retorno', marca: 'HYUNDAI', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'HY-31N8-01370', descripcion: 'Filtro Hidráulico Línea Piloto', marca: 'HYUNDAI', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'HY-31N8-01380', descripcion: 'Respirador Tanque Hidráulico', marca: 'HYUNDAI', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },

  // --- CIFA (BOMBAS DE CONCRETO) ---
  {
    id: 'kit-cifa-k45h-250h',
    nombre: 'Kit Preventivo 250h - CIFA K45H / K38L',
    modelo: 'K45H',
    marca: 'CIFA',
    intervalo: '250',
    descripcion: 'Servicio básico preventivo 250h para bomba de concreto CIFA (Motor y bombeo).',
    esOficial: true,
    piezas: [
      { codigo: 'CIF-102931', descripcion: 'Filtro Aceite Motor Camión / Bomba', marca: 'CIFA', sistema: 'Motor', cantidad: 1 },
      { codigo: 'CIF-102945', descripcion: 'Filtro Combustible Primario', marca: 'CIFA', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CIF-102948', descripcion: 'Filtro Separador de Agua', marca: 'CIFA', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-cifa-k45h-500h',
    nombre: 'Kit Preventivo 500h - CIFA K45H / K38L',
    modelo: 'K45H',
    marca: 'CIFA',
    intervalo: '500',
    descripcion: 'Servicio 500h: Filtración de motor, aire y retorno del circuito hidráulico de bombeo.',
    esOficial: true,
    piezas: [
      { codigo: 'CIF-102931', descripcion: 'Filtro Aceite Motor', marca: 'CIFA', sistema: 'Motor', cantidad: 1 },
      { codigo: 'CIF-102945', descripcion: 'Filtro Combustible Primario', marca: 'CIFA', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CIF-102946', descripcion: 'Filtro Combustible Secundario', marca: 'CIFA', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CIF-102948', descripcion: 'Filtro Separador de Agua', marca: 'CIFA', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CIF-220110', descripcion: 'Filtro Aire Motor Primario', marca: 'CIFA', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'CIF-330080', descripcion: 'Filtro Hidráulico Retorno Circuito Bombeo', marca: 'CIFA', sistema: 'Hidráulico', cantidad: 2 }
    ]
  },
  {
    id: 'kit-cifa-k45h-1000h',
    nombre: 'Kit Preventivo 1000h - CIFA K45H / K38L',
    modelo: 'K45H',
    marca: 'CIFA',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h: Filtración completa de motor, aire de seguridad, hidráulica cerrada y acumuladores de nitrógeno.',
    esOficial: true,
    piezas: [
      { codigo: 'CIF-102931', descripcion: 'Filtro Aceite Motor', marca: 'CIFA', sistema: 'Motor', cantidad: 1 },
      { codigo: 'CIF-102945', descripcion: 'Filtro Combustible Primario', marca: 'CIFA', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CIF-102946', descripcion: 'Filtro Combustible Secundario', marca: 'CIFA', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CIF-102948', descripcion: 'Filtro Separador de Agua', marca: 'CIFA', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'CIF-220110', descripcion: 'Filtro Aire Motor Primario', marca: 'CIFA', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'CIF-220111', descripcion: 'Filtro Aire Secundario Seguridad', marca: 'CIFA', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'CIF-330080', descripcion: 'Filtro Hidráulico Retorno Bombeo', marca: 'CIFA', sistema: 'Hidráulico', cantidad: 2 },
      { codigo: 'CIF-330085', descripcion: 'Filtro Hidráulico Alta Presión Circuito Cerrado', marca: 'CIFA', sistema: 'Hidráulico', cantidad: 2 },
      { codigo: 'CIF-330090', descripcion: 'Respirador Tanque Hidráulico con Desecante', marca: 'CIFA', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },

  // --- SIMEM (PLANTAS DE CONCRETO) ---
  {
    id: 'kit-simem-eagle2500-250h',
    nombre: 'Kit Preventivo 250h - Simem EAGLE 2500 / MEB 2000',
    modelo: 'EAGLE 2500',
    marca: 'SIMEM',
    intervalo: '250',
    descripcion: 'Mantenimiento preventivo básico 250h: Deshumidificación neumática y lubricación de compuertas.',
    esOficial: true,
    piezas: [
      { codigo: 'SIM-FL-01', descripcion: 'Filtro Regulador de Aire Comprimido Neumática', marca: 'SIMEM', sistema: 'Neumático', cantidad: 1 },
      { codigo: 'SIM-LUB-01', descripcion: 'Cartucho Aceite Lubricador de Línea Neumática', marca: 'SIMEM', sistema: 'Neumático', cantidad: 1 },
      { codigo: 'SIM-HYD-01', descripcion: 'Filtro Aceite Unidad Hidráulica Compuerta Descarga', marca: 'SIMEM', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },
  {
    id: 'kit-simem-eagle2500-500h',
    nombre: 'Kit Preventivo 500h - Simem EAGLE 2500 / MEB 2000',
    modelo: 'EAGLE 2500',
    marca: 'SIMEM',
    intervalo: '500',
    descripcion: 'Mantenimiento preventivo 500h: Filtración de aire comprimido, mangas de despresurización y aceite reductor.',
    esOficial: true,
    piezas: [
      { codigo: 'SIM-FL-01', descripcion: 'Filtro Regulador Aire Comprimido', marca: 'SIMEM', sistema: 'Neumático', cantidad: 1 },
      { codigo: 'SIM-FL-02', descripcion: 'Filtro Coalescente Desoleador Neumática', marca: 'SIMEM', sistema: 'Neumático', cantidad: 1 },
      { codigo: 'SIM-MAN-10', descripcion: 'Juego de Filtros Manga Despresurización Mezcladora', marca: 'SIMEM', sistema: 'Filtración Mezcla', cantidad: 1 },
      { codigo: 'SIM-HYD-01', descripcion: 'Filtro Aceite Hidráulica Compuerta Descarga', marca: 'SIMEM', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'SIM-OIL-RED', descripcion: 'Aceite Sintético Reductor Mezclador Planetario', marca: 'SIMEM', sistema: 'Transmisión', cantidad: 1 }
    ]
  },
  {
    id: 'kit-simem-eagle2500-1000h',
    nombre: 'Kit Preventivo 1000h - Simem EAGLE 2500 / MEB 2000',
    modelo: 'EAGLE 2500',
    marca: 'SIMEM',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h: Filtración integral de compresor, filtros de aire de silos y reductores planetarios.',
    esOficial: true,
    piezas: [
      { codigo: 'SIM-FL-01', descripcion: 'Filtro Regulador Aire Comprimido', marca: 'SIMEM', sistema: 'Neumático', cantidad: 1 },
      { codigo: 'SIM-FL-02', descripcion: 'Filtro Coalescente Desoleador', marca: 'SIMEM', sistema: 'Neumático', cantidad: 1 },
      { codigo: 'SIM-SILO-01', descripcion: 'Cartucho Filtro Desempolvador Silo de Cemento', marca: 'SIMEM', sistema: 'Filtración Silo', cantidad: 2 },
      { codigo: 'SIM-MAN-10', descripcion: 'Juego de Mangas Filtro Mezcladora', marca: 'SIMEM', sistema: 'Filtración Mezcla', cantidad: 1 },
      { codigo: 'SIM-HYD-01', descripcion: 'Filtro Aceite Unidad Hidráulica', marca: 'SIMEM', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'SIM-HYD-02', descripcion: 'Respirador Tanque Hidráulico Compuerta', marca: 'SIMEM', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },

  // --- CUMMINS (MOTORES DIÉSEL INDUSTRIALES) ---
  {
    id: 'kit-cummins-qsb67-250h',
    nombre: 'Kit Preventivo 250h - Motor Cummins QSB6.7 / QSL9',
    modelo: 'QSB6.7',
    marca: 'CUMMINS',
    intervalo: '250',
    descripcion: 'Servicio preventivo básico 250h para motores Cummins industriales (Fleetguard).',
    esOficial: true,
    piezas: [
      { codigo: 'LF3970', descripcion: 'Filtro de Aceite Lubricante Motor Cummins Fleetguard LF3970', marca: 'CUMMINS', sistema: 'Motor', cantidad: 1 },
      { codigo: 'FF5488', descripcion: 'Filtro de Combustible Primario Fleetguard FF5488', marca: 'CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FS19732', descripcion: 'Filtro Separador de Agua / Combustible Fleetguard FS19732', marca: 'CUMMINS', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-cummins-qsb67-500h',
    nombre: 'Kit Preventivo 500h - Motor Cummins QSB6.7 / QSL9',
    modelo: 'QSB6.7',
    marca: 'CUMMINS',
    intervalo: '500',
    descripcion: 'Servicio intermedio 500h: Filtración completa de lubricación, combustible NanoNet y aire.',
    esOficial: true,
    piezas: [
      { codigo: 'LF3970', descripcion: 'Filtro de Aceite Lubricante Cummins LF3970', marca: 'CUMMINS', sistema: 'Motor', cantidad: 1 },
      { codigo: 'FF5488', descripcion: 'Filtro Combustible Primario FF5488', marca: 'CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FF5612', descripcion: 'Filtro Combustible Secundario NanoNet FF5612', marca: 'CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FS19732', descripcion: 'Filtro Separador de Agua FS19732', marca: 'CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'AF25292', descripcion: 'Filtro de Aire Motor Primario Fleetguard AF25292', marca: 'CUMMINS', sistema: 'Aire / Admisión', cantidad: 1 }
    ]
  },
  {
    id: 'kit-cummins-qsb67-1000h',
    nombre: 'Kit Preventivo 1000h - Motor Cummins QSB6.7 / QSL9',
    modelo: 'QSB6.7',
    marca: 'CUMMINS',
    intervalo: '1000',
    descripcion: 'Servicio mayor 1000h: Filtración integral de motor Cummins, aire de seguridad, refrigerante y bandas.',
    esOficial: true,
    piezas: [
      { codigo: 'LF3970', descripcion: 'Filtro Aceite Lubricante Cummins LF3970', marca: 'CUMMINS', sistema: 'Motor', cantidad: 1 },
      { codigo: 'FF5488', descripcion: 'Filtro Combustible Primario FF5488', marca: 'CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FF5612', descripcion: 'Filtro Combustible Secundario NanoNet FF5612', marca: 'CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'FS19732', descripcion: 'Filtro Separador de Agua FS19732', marca: 'CUMMINS', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'AF25292', descripcion: 'Filtro Aire Motor Primario AF25292', marca: 'CUMMINS', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'AF25293', descripcion: 'Filtro Aire Motor Secundario Seguridad AF25293', marca: 'CUMMINS', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'WF2071', descripcion: 'Filtro de Agua / Refrigerante Cummins con Aditivo DCA4', marca: 'CUMMINS', sistema: 'Refrigeración', cantidad: 1 },
      { codigo: 'CUM-3974456', descripcion: 'Banda Serpentina de Accesorios Motor Cummins QSB6.7', marca: 'CUMMINS', sistema: 'Transmisión', cantidad: 1 }
    ]
  },

  // --- KIT UNIVERSAL PREVENTIVO ---
  {
    id: 'kit-universal-250h',
    nombre: 'Kit Preventivo Universal 250h (Multimarca)',
    modelo: 'Universal',
    marca: 'UNIVERSAL',
    intervalo: '250',
    descripcion: 'Kit estándar universal para servicio preventivo de 250 horas (Aceite motor y combustible).',
    esOficial: true,
    piezas: [
      { codigo: 'UNI-FIL-01', descripcion: 'Filtro de Aceite Motor Universal', marca: 'UNIVERSAL', sistema: 'Motor', cantidad: 1 },
      { codigo: 'UNI-FIL-02', descripcion: 'Filtro de Combustible Primario Universal', marca: 'UNIVERSAL', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'UNI-FIL-03', descripcion: 'Filtro Separador de Agua Universal', marca: 'UNIVERSAL', sistema: 'Combustible', cantidad: 1 }
    ]
  },
  {
    id: 'kit-universal-500h',
    nombre: 'Kit Preventivo Universal 500h (Multimarca)',
    modelo: 'Universal',
    marca: 'UNIVERSAL',
    intervalo: '500',
    descripcion: 'Kit estándar universal para servicio preventivo de 500 horas (Motor, combustible, aire e hidráulico).',
    esOficial: true,
    piezas: [
      { codigo: 'UNI-FIL-01', descripcion: 'Filtro de Aceite Motor', marca: 'UNIVERSAL', sistema: 'Motor', cantidad: 1 },
      { codigo: 'UNI-FIL-02', descripcion: 'Filtro de Combustible Primario', marca: 'UNIVERSAL', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'UNI-FIL-04', descripcion: 'Filtro Combustible Secundario', marca: 'UNIVERSAL', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'UNI-FIL-03', descripcion: 'Filtro Separador de Agua', marca: 'UNIVERSAL', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'UNI-FIL-05', descripcion: 'Filtro de Aire Motor Primario', marca: 'UNIVERSAL', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'UNI-FIL-06', descripcion: 'Filtro Hidráulico de Retorno', marca: 'UNIVERSAL', sistema: 'Hidráulico', cantidad: 1 }
    ]
  },
  {
    id: 'kit-universal-1000h',
    nombre: 'Kit Preventivo Universal 1000h (Multimarca)',
    modelo: 'Universal',
    marca: 'UNIVERSAL',
    intervalo: '1000',
    descripcion: 'Kit estándar universal para servicio preventivo mayor de 1000 horas (Filtración completa de todos los sistemas).',
    esOficial: true,
    piezas: [
      { codigo: 'UNI-FIL-01', descripcion: 'Filtro de Aceite Motor', marca: 'UNIVERSAL', sistema: 'Motor', cantidad: 1 },
      { codigo: 'UNI-FIL-02', descripcion: 'Filtro Combustible Primario', marca: 'UNIVERSAL', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'UNI-FIL-04', descripcion: 'Filtro Combustible Secundario', marca: 'UNIVERSAL', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'UNI-FIL-03', descripcion: 'Filtro Separador de Agua', marca: 'UNIVERSAL', sistema: 'Combustible', cantidad: 1 },
      { codigo: 'UNI-FIL-05', descripcion: 'Filtro Aire Motor Primario', marca: 'UNIVERSAL', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'UNI-FIL-07', descripcion: 'Filtro Aire Motor Secundario Seguridad', marca: 'UNIVERSAL', sistema: 'Aire / Admisión', cantidad: 1 },
      { codigo: 'UNI-FIL-06', descripcion: 'Filtro Hidráulico Retorno', marca: 'UNIVERSAL', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'UNI-FIL-08', descripcion: 'Filtro Hidráulico Alta Presión', marca: 'UNIVERSAL', sistema: 'Hidráulico', cantidad: 1 },
      { codigo: 'UNI-FIL-09', descripcion: 'Respirador / Filtro Aire Tanque Hidráulico', marca: 'UNIVERSAL', sistema: 'Hidráulico', cantidad: 1 }
    ]
  }
];

window._currentKitFilterMarca = 'all';
window._currentKitFilterHours = 'all';
window._currentKitFilterModelo = 'all';

window._actualizarSelectModelosKits = function(marcaVal, modeloSeleccionado) {
  const selectMod = document.getElementById('filter-kit-modelo');
  if (!selectMod) return;

  const cat = window.obtenerCatalogoMaquinariaCompleto();
  let optionsHtml = '';

  if (!marcaVal || marcaVal === 'all') {
    optionsHtml = '<option value="all">Todos los Modelos</option>';
    cat.marcas.forEach(m => {
      const mods = cat.modelosPorMarca[m];
      if (mods && mods.length > 0) {
        optionsHtml += `<optgroup label="${m}">`;
        mods.sort().forEach(mod => {
          const isSel = (modeloSeleccionado && mod.toLowerCase() === modeloSeleccionado.toLowerCase());
          optionsHtml += `<option value="${mod}" ${isSel ? 'selected' : ''}>${mod}</option>`;
        });
        optionsHtml += `</optgroup>`;
      }
    });
  } else {
    optionsHtml = `<option value="all">Todos los Modelos (${marcaVal})</option>`;
    const mods = cat.modelosPorMarca[marcaVal] || [];
    mods.sort().forEach(mod => {
      const isSel = (modeloSeleccionado && mod.toLowerCase() === modeloSeleccionado.toLowerCase());
      optionsHtml += `<option value="${mod}" ${isSel ? 'selected' : ''}>${mod}</option>`;
    });
  }

  selectMod.innerHTML = optionsHtml;
  if (modeloSeleccionado && modeloSeleccionado !== 'all') {
    selectMod.value = modeloSeleccionado;
  } else {
    selectMod.value = 'all';
  }
};

window.loadKitsServicio = function() {
  const isTest = typeof isTestModeActive === 'function' && isTestModeActive();
  const storageKey = isTest ? 'sapi_kits_servicio_sandbox' : 'sapi_kits_servicio';

  // Configuración de entorno:
  // - Sandbox: Contiene los 36 machotes de ejemplo / prueba para referencia del equipo
  // - Producción (Real): Inicia en 0 ([]) para que el equipo cree los machotes oficiales desde cero
  if (!localStorage.getItem('sapi_kits_env_swap_sandbox_v4')) {
    localStorage.setItem('sapi_kits_env_swap_sandbox_v4', 'true');
    try {
      // 1. Limpiar producción a lista vacía []
      if (typeof safeSetJSON === 'function') {
        safeSetJSON('sapi_kits_servicio', []);
      } else {
        localStorage.setItem('sapi_kits_servicio', JSON.stringify([]));
      }
      if (typeof window.pushToSupabase === 'function') {
        window.pushToSupabase('kits_servicio', []);
      }

      // 2. Cargar los 36 machotes en Sandbox
      if (typeof safeSetJSON === 'function') {
        safeSetJSON('sapi_kits_servicio_sandbox', KITS_PRECARGADOS_DEFAULT);
      } else {
        localStorage.setItem('sapi_kits_servicio_sandbox', JSON.stringify(KITS_PRECARGADOS_DEFAULT));
      }
      if (typeof window.pushToSupabase === 'function') {
        window.pushToSupabase('kits_servicio_sandbox', KITS_PRECARGADOS_DEFAULT);
      }
    } catch(e) {
      console.warn('[Kits] Error al inicializar partición sandbox/producción:', e);
    }
  }

  try {
    const raw = (typeof safeGetJSON === 'function') 
      ? safeGetJSON(storageKey, null) 
      : JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(raw)) {
      return raw;
    }
  } catch (e) {
    console.warn('[Kits] Error leyendo kits locales:', e);
  }

  // En Sandbox, si aún no hay datos inicializamos con los 36 machotes de prueba
  if (isTest) {
    window.saveKitsServicio(KITS_PRECARGADOS_DEFAULT);
    return [...KITS_PRECARGADOS_DEFAULT];
  }

  // En Modo Real (Producción), si no hay datos se mantiene limpio en 0 ([])
  return [];
};

window.saveKitsServicio = function(kits) {
  const isTest = typeof isTestModeActive === 'function' && isTestModeActive();
  const storageKey = isTest ? 'sapi_kits_servicio_sandbox' : 'sapi_kits_servicio';
  const supabaseConfigId = isTest ? 'kits_servicio_sandbox' : 'kits_servicio';

  try {
    if (typeof safeSetJSON === 'function') {
      safeSetJSON(storageKey, kits);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(kits));
    }
    // Sincronizar con Supabase en la tabla config
    if (typeof window.pushToSupabase === 'function') {
      window.pushToSupabase(supabaseConfigId, kits);
    }
  } catch (e) {
    console.error('[Kits] Error guardando kits:', e);
  }
};

window.restablecerKitsOficiales = async function() {
  const isTest = typeof isTestModeActive === 'function' && isTestModeActive();
  const targetName = isTest ? 'el Sandbox de Pruebas' : 'Produccion Oficial (Supabase)';

  const confirmed = await window.confirmarAccion({
    titulo: 'Restablecer Kits Oficiales de Fabrica',
    mensaje: `Deseas restaurar la lista oficial de kits de servicio preventivo para la flota Eurorep (250h, 500h, 1000h) en ${targetName}?`,
    textoAceptar: 'Restablecer Oficiales',
    textoCancelar: 'Cancelar',
    esPeligroso: false
  });
  if (!confirmed) return;

  window.saveKitsServicio(KITS_PRECARGADOS_DEFAULT);
  mostrarNotificacion(`Kits de servicio preventivo restablecidos con exito en ${targetName}.`, 'success');
  window.filtrarKitsServicio();
};

window.setKitFiltroHoras = function(horas, btnEl) {
  window._currentKitFilterHours = horas || 'all';
  const btns = document.querySelectorAll('.kit-interval-btn');
  btns.forEach(b => {
    b.classList.remove('active');
    b.style.background = 'transparent';
    b.style.color = 'var(--text-secondary)';
  });
  if (btnEl) {
    btnEl.classList.add('active');
    btnEl.style.background = 'var(--bg-hover)';
    btnEl.style.color = 'var(--text-primary)';
  }
  window.filtrarKitsServicio();
};

window.alCambiarFiltroMarcaKits = function() {
  const selectMarca = document.getElementById('filter-kit-marca');
  const marcaVal = selectMarca ? selectMarca.value : 'all';
  window._currentKitFilterMarca = marcaVal;

  window._actualizarSelectModelosKits(marcaVal, 'all');
  window.filtrarKitsServicio();
};

window.abrirModalKitsServicio = function(modeloPreseleccionado) {
  const isAuthorized = currentSession && ['superadmin', 'admin', 'supervisor'].includes(String(currentSession.viewMode || currentSession.rol || currentSession.realRol || '').toLowerCase().trim());
  if (!isAuthorized) {
    if (typeof mostrarNotificacion === 'function') {
      mostrarNotificacion('Solo Superadministradores, Administradores y Supervisores tienen permiso para ver y gestionar Kits de Servicio.', 'error');
    } else {
      alert('Solo Superadministradores, Administradores y Supervisores tienen permiso para ver y gestionar Kits de Servicio.');
    }
    return;
  }

  const modal = document.getElementById('modal-kits-servicio-overlay');
  if (!modal) return;

  // Actualizar indicador de modo en el encabezado del modal
  const modeBadge = document.getElementById('kit-modal-mode-badge');
  const isTest = typeof isTestModeActive === 'function' && isTestModeActive();
  if (modeBadge) {
    if (isTest) {
      modeBadge.textContent = 'Sandbox (Pruebas)';
      modeBadge.style.background = 'rgba(245, 158, 11, 0.12)';
      modeBadge.style.color = '#d97706';
      modeBadge.style.border = '1px solid rgba(245, 158, 11, 0.3)';
    } else {
      modeBadge.textContent = 'Modo Real (Produccion)';
      modeBadge.style.background = 'rgba(16, 185, 129, 0.12)';
      modeBadge.style.color = '#059669';
      modeBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    }
  }

  const cat = window.obtenerCatalogoMaquinariaCompleto();
  
  // Poblar selector de marcas
  const selectMarca = document.getElementById('filter-kit-marca');
  if (selectMarca) {
    let htmlMarcas = '<option value="all">Todas las Marcas</option>';
    cat.marcas.forEach(m => {
      htmlMarcas += `<option value="${m}">${m}</option>`;
    });
    selectMarca.innerHTML = htmlMarcas;
  }

  // Detectar marca si viene modelo preseleccionado
  let marcaPreseleccionada = 'all';
  let modeloMatch = 'all';

  if (modeloPreseleccionado) {
    const rawTarget = modeloPreseleccionado.trim().toLowerCase();
    for (const [m, mods] of Object.entries(cat.modelosPorMarca)) {
      const found = mods.find(mod => mod.toLowerCase() === rawTarget || rawTarget.includes(mod.toLowerCase()) || mod.toLowerCase().includes(rawTarget));
      if (found) {
        marcaPreseleccionada = m;
        modeloMatch = found;
        break;
      }
    }
    if (marcaPreseleccionada === 'all') {
      // Buscar coincidencia parcial directa
      for (const m of cat.marcas) {
        if (rawTarget.includes(m.toLowerCase())) {
          marcaPreseleccionada = m;
          break;
        }
      }
    }
  }

  if (selectMarca) {
    selectMarca.value = marcaPreseleccionada;
  }
  window._currentKitFilterMarca = marcaPreseleccionada;

  // Actualizar selector de modelos
  window._actualizarSelectModelosKits(marcaPreseleccionada, modeloMatch !== 'all' ? modeloMatch : 'all');
  window._currentKitFilterModelo = modeloMatch;

  // Resetear filtro de horas a 'all'
  window._currentKitFilterHours = 'all';
  const btns = document.querySelectorAll('.kit-interval-btn');
  btns.forEach((b, i) => {
    if (i === 0) {
      b.classList.add('active');
      b.style.background = 'var(--bg-hover)';
      b.style.color = 'var(--text-primary)';
    } else {
      b.classList.remove('active');
      b.style.background = 'transparent';
      b.style.color = 'var(--text-secondary)';
    }
  });

  const searchInp = document.getElementById('search-kit-input');
  if (searchInp) searchInp.value = '';

  modal.style.display = 'flex';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  window.filtrarKitsServicio();

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
};

window.cerrarModalKitsServicio = function(e) {
  if (e && e.target && e.target !== document.getElementById('modal-kits-servicio-overlay') && !e.target.classList.contains('modal-close') && !e.target.closest('.modal-close') && !e.target.closest('button')) {
    return;
  }
  const modal = document.getElementById('modal-kits-servicio-overlay');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
  document.body.style.overflow = '';
};

window.toggleManualMachotes = function(forceState) {
  const panel = document.getElementById('panel-manual-machotes');
  const btn = document.getElementById('btn-toggle-manual-kits');
  if (!panel) return;
  
  const isVisible = panel.style.display !== 'none';
  const nextState = typeof forceState === 'boolean' ? forceState : !isVisible;
  
  panel.style.display = nextState ? 'block' : 'none';
  if (btn) {
    if (nextState) {
      btn.classList.add('active');
      btn.style.background = 'rgba(37,99,235,0.12)';
      btn.style.color = '#2563eb';
      btn.style.borderColor = 'rgba(37,99,235,0.3)';
    } else {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }
  }

  if (nextState && typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
};

window.filtrarKitsServicio = function() {
  const allKits = window.loadKitsServicio();
  const selectMarca = document.getElementById('filter-kit-marca');
  const selectMod = document.getElementById('filter-kit-modelo');
  const marcaVal = selectMarca ? selectMarca.value : 'all';
  const modeloVal = selectMod ? selectMod.value : 'all';
  const hoursVal = window._currentKitFilterHours || 'all';
  const q = (document.getElementById('search-kit-input')?.value || '').toLowerCase().trim();

  // Actualizar indicador de modo si el modal esta visible
  const modeBadge = document.getElementById('kit-modal-mode-badge');
  const isTest = typeof isTestModeActive === 'function' && isTestModeActive();
  if (modeBadge) {
    if (isTest) {
      modeBadge.textContent = 'Sandbox (Pruebas)';
      modeBadge.style.background = 'rgba(245, 158, 11, 0.12)';
      modeBadge.style.color = '#d97706';
      modeBadge.style.border = '1px solid rgba(245, 158, 11, 0.3)';
    } else {
      modeBadge.textContent = 'Modo Real (Produccion)';
      modeBadge.style.background = 'rgba(16, 185, 129, 0.12)';
      modeBadge.style.color = '#059669';
      modeBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    }
  }

  const cat = window.obtenerCatalogoMaquinariaCompleto();
  const normalizarMarca = cat.normalizarMarca || ((m) => (m || 'UNIVERSAL').trim().toUpperCase());

  // Kits filtrados por Marca y Modelo para los contadores de horas
  const kitsParaStats = allKits.filter(k => {
    if (marcaVal !== 'all' && normalizarMarca(k.marca) !== normalizarMarca(marcaVal)) {
      return false;
    }
    if (modeloVal !== 'all') {
      const matchMod = (k.modelo || '').toLowerCase() === modeloVal.toLowerCase();
      const isUniv = (k.modelo === 'Universal' || k.modelo === 'UNIVERSAL / MULTIMARCA');
      if (!matchMod && !isUniv) return false;
    }
    return true;
  });

  const countAll = kitsParaStats.length;
  const count100 = kitsParaStats.filter(k => String(k.intervalo) === '100').length;
  const count250 = kitsParaStats.filter(k => String(k.intervalo) === '250').length;
  const count500 = kitsParaStats.filter(k => String(k.intervalo) === '500').length;
  const count1000 = kitsParaStats.filter(k => String(k.intervalo) === '1000').length;

  const statTotal = document.getElementById('kit-stat-total');
  if (statTotal) statTotal.textContent = countAll;
  const stat100 = document.getElementById('kit-stat-100');
  if (stat100) stat100.textContent = count100;
  const stat250 = document.getElementById('kit-stat-250');
  if (stat250) stat250.textContent = count250;
  const stat500 = document.getElementById('kit-stat-500');
  if (stat500) stat500.textContent = count500;
  const stat1000 = document.getElementById('kit-stat-1000');
  if (stat1000) stat1000.textContent = count1000;

  // Filtrar resultados completos
  const filtrados = allKits.filter(kit => {
    // Filtro marca
    if (marcaVal !== 'all') {
      if (normalizarMarca(kit.marca) !== normalizarMarca(marcaVal)) return false;
    }

    // Filtro modelo
    if (modeloVal !== 'all') {
      const matchMod = (kit.modelo || '').toLowerCase() === modeloVal.toLowerCase();
      const isUniv = (kit.modelo === 'Universal' || kit.modelo === 'UNIVERSAL / MULTIMARCA');
      if (!matchMod && !isUniv) return false;
    }

    // Filtro horas
    if (hoursVal !== 'all') {
      if (String(kit.intervalo) !== String(hoursVal)) return false;
    }

    // Filtro busqueda de texto
    if (q) {
      const matchNom = (kit.nombre || '').toLowerCase().includes(q);
      const matchMod = (kit.modelo || '').toLowerCase().includes(q);
      const matchMarca = (kit.marca || '').toLowerCase().includes(q);
      const matchDesc = (kit.descripcion || '').toLowerCase().includes(q);
      const matchPiezas = (kit.piezas || []).some(p => 
        (p.codigo || '').toLowerCase().includes(q) || 
        (p.clave || '').toLowerCase().includes(q) || 
        (p.descripcion || '').toLowerCase().includes(q) ||
        (p.sistema || '').toLowerCase().includes(q)
      );
      if (!matchNom && !matchMod && !matchMarca && !matchDesc && !matchPiezas) return false;
    }

    return true;
  });

  window.renderKitsServicioCards(filtrados);
};

window.renderKitsServicioCards = function(kits) {
  const container = document.getElementById('kits-servicio-grid');
  if (!container) return;

  if (!kits || kits.length === 0) {
    const isTest = typeof isTestModeActive === 'function' && isTestModeActive();
    const emptyTitle = isTest 
      ? 'No hay machotes en el Sandbox de pruebas' 
      : 'No hay machotes de servicio en Produccion (Supabase)';
    const emptyDesc = isTest
      ? 'No hay machotes de mantenimiento en el Sandbox con los filtros aplicados. Puedes crear un machote nuevo de prueba o consultar el mini manual de ayuda.'
      : 'Aun no se han registrado machotes de servicio preventivo oficiales en Produccion. Puedes crear un nuevo machote oficial, restaurar los estandares de fabrica o revisar el mini manual de uso.';

    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; background: var(--bg-card); border: 1px dashed var(--border); border-radius: 12px; margin: 1rem 0;">
        <div style="background: rgba(37,99,235,0.08); color: #2563eb; width: 56px; height: 56px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
          <i data-lucide="package-search" style="width: 28px; height: 28px;"></i>
        </div>
        <h4 style="font-size: 1.1rem; margin: 0 0 0.5rem 0; color: var(--text-primary); font-weight: 700;">${emptyTitle}</h4>
        <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 520px; margin: 0 auto 1.25rem auto; line-height: 1.5;">
          ${emptyDesc}
        </p>
        <div style="display:flex; justify-content:center; gap:0.6rem; flex-wrap:wrap;">
          <button type="button" class="btn-primary" onclick="window.abrirModalFormularioKit()" style="font-size:0.82rem; padding:0.4rem 1rem; background:#2563eb; border:none; border-radius:6px; color:#fff; cursor:pointer;">
            <i data-lucide="plus" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Nuevo Machote
          </button>
          <button type="button" class="btn-secondary" onclick="window.toggleManualMachotes(true)" style="font-size:0.82rem; padding:0.4rem 1rem; border-radius:6px; cursor:pointer;">
            <i data-lucide="book-open" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Ver Mini Manual
          </button>
          <button type="button" class="btn-secondary" onclick="window.restablecerKitsOficiales()" style="font-size:0.82rem; padding:0.4rem 1rem; border-radius:6px; cursor:pointer;">
            <i data-lucide="rotate-ccw" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i> Restablecer Oficiales
          </button>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Estilos de badge e intervalo por horas
  const getIntervaloMeta = (intervalo) => {
    const intNum = parseInt(intervalo, 10);
    if (intNum === 250) {
      return {
        badgeBg: 'rgba(37, 99, 235, 0.1)',
        badgeColor: '#2563eb',
        badgeBorder: 'rgba(37, 99, 235, 0.25)',
        accentColor: '#2563eb',
        icon: 'zap',
        label: '250 HORAS',
        sublabel: 'Preventivo Menor',
        cardBorder: 'var(--border)'
      };
    } else if (intNum === 500) {
      return {
        badgeBg: 'rgba(217, 119, 6, 0.1)',
        badgeColor: '#d97706',
        badgeBorder: 'rgba(217, 119, 6, 0.25)',
        accentColor: '#d97706',
        icon: 'wrench',
        label: '500 HORAS',
        sublabel: 'Preventivo Intermedio',
        cardBorder: 'var(--border)'
      };
    } else if (intNum === 1000) {
      return {
        badgeBg: 'rgba(124, 58, 237, 0.1)',
        badgeColor: '#7c3aed',
        badgeBorder: 'rgba(124, 58, 237, 0.25)',
        accentColor: '#7c3aed',
        icon: 'settings',
        label: '1000 HORAS',
        sublabel: 'Preventivo Mayor',
        cardBorder: 'var(--border)'
      };
    }
    return {
      badgeBg: 'rgba(16, 185, 129, 0.1)',
      badgeColor: '#059669',
      badgeBorder: 'rgba(16, 185, 129, 0.25)',
      accentColor: '#059669',
      icon: 'layers',
      label: `${intervalo} HORAS`,
      sublabel: 'Servicio Programado',
      cardBorder: 'var(--border)'
    };
  };

  // Agrupar los kits por Marca
  const cat = window.obtenerCatalogoMaquinariaCompleto();
  const normalizarMarca = cat.normalizarMarca || ((m) => (m || 'UNIVERSAL').trim().toUpperCase());

  const grouped = {};
  kits.forEach(kit => {
    const brandName = normalizarMarca(kit.marca);
    if (!grouped[brandName]) grouped[brandName] = [];
    grouped[brandName].push(kit);
  });

  // Orden canonico de marcas oficiales
  const brandPriority = ['RUBBLE MASTER', 'FIORI', 'HYUNDAI', 'CASAGRANDE', 'CIFA', 'SIMEM', 'ZOOMLION', 'CUMMINS', 'UNIVERSAL'];
  const sortedBrands = Object.keys(grouped).sort((a, b) => {
    const idxA = brandPriority.indexOf(a);
    const idxB = brandPriority.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // Generar HTML agrupado por secciones de Marca
  container.innerHTML = sortedBrands.map(brandName => {
    const brandKits = grouped[brandName] || [];
    const logoSrc = getLogoMarca(brandName);

    const brandCardsHtml = brandKits.map(kit => {
      const meta = getIntervaloMeta(kit.intervalo);
      const piezas = kit.piezas || [];
      const totalPiezas = piezas.reduce((acc, p) => acc + (parseInt(p.cantidad, 10) || 1), 0);

      return `
        <div class="kit-card" style="background: var(--bg-card); border: 1px solid var(--border); border-top: 3px solid ${meta.accentColor}; border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          
          <!-- Header de la Tarjeta del Machote -->
          <div style="padding: 1rem 1.25rem 0.85rem 1.25rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.5rem;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <!-- Tag de Modelo de Maquina -->
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="badge" style="background: rgba(37,99,235,0.08); color: #2563eb; border: 1px solid rgba(37,99,235,0.2); font-size: 0.74rem; padding: 2px 8px; border-radius: 6px; font-weight: 700; display:inline-flex; align-items:center; gap:4px;">
                  <i data-lucide="truck" style="width:12px;height:12px;"></i> ${kit.modelo}
                </span>
                <span style="font-size:0.72rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">${kit.marca || brandName}</span>
              </div>

              <!-- Badge de Intervalo (250h, 500h, 1000h) -->
              <span class="badge" style="background:${meta.badgeBg}; color:${meta.badgeColor}; border:1px solid ${meta.badgeBorder}; font-weight:700; font-size:0.72rem; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                <i data-lucide="${meta.icon}" style="width:12px;height:12px;"></i> ${meta.label}
              </span>
            </div>

            <div>
              <h4 style="margin: 0.25rem 0 0 0; font-size: 0.98rem; font-weight: 800; color: var(--text-primary); line-height: 1.35;">${kit.nombre}</h4>
            </div>

          </div>

          <!-- Alcance / Descripcion Tecnica -->
          ${kit.descripcion ? `
            <div style="margin: 0.75rem 1.15rem 0.25rem 1.15rem; padding: 0.55rem 0.75rem; background: var(--bg-hover); border-radius: 8px; border: 1px solid var(--border); display: flex; gap: 0.5rem; align-items: flex-start;">
              <i data-lucide="info" style="width: 14px; height: 14px; color: ${meta.accentColor}; flex-shrink: 0; margin-top: 2px;"></i>
              <div style="font-size: 0.76rem; color: var(--text-secondary); line-height: 1.45;">
                ${kit.descripcion}
              </div>
            </div>
          ` : ''}

          <!-- Header de Refacciones -->
          <div style="padding: 0.75rem 1.15rem 0.35rem 1.15rem; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.69rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
              Refacciones Requeridas
            </span>
            <span style="font-size: 0.69rem; font-weight: 600; color: var(--text-muted); background: var(--bg-secondary); padding: 1px 7px; border-radius: 10px; border: 1px solid var(--border);">
              ${piezas.length} items • ${totalPiezas} pzas
            </span>
          </div>

          <!-- Lista de Refacciones y Consumibles -->
          <div style="padding: 0.15rem 1.15rem 0.75rem 1.15rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; max-height: 230px; overflow-y: auto;">
            ${piezas.map((p) => {
              return `
                <div class="kit-ref-row-item" style="display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; padding: 0.45rem 0.65rem; background: var(--bg-body); border: 1px solid var(--border); border-radius: 7px; font-size: 0.78rem;">
                  
                  <div style="display: flex; align-items: center; gap: 0.55rem; min-width: 0; flex: 1;">
                    <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #2563eb; font-size: 0.74rem; background: rgba(37,99,235,0.07); border: 1px solid rgba(37,99,235,0.18); padding: 2px 6px; border-radius: 5px; flex-shrink: 0;">
                      ${p.codigo || p.clave || 'S/C'}
                    </span>
                    <span style="font-weight: 600; color: var(--text-primary); font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.descripcion}">
                      ${p.descripcion}
                    </span>
                  </div>

                  <div style="display: flex; align-items: center; flex-shrink: 0; margin-left: 0.35rem;">
                    <span style="font-size: 0.78rem; font-weight: 800; color: var(--text-primary); background: var(--bg-secondary); border: 1px solid var(--border); padding: 2px 7px; border-radius: 5px; min-width: 28px; text-align: center;">
                      x${p.cantidad || 1}
                    </span>
                  </div>

                </div>
              `;
            }).join('')}
          </div>

          <!-- Footer y Acciones de la Tarjeta (Solo Machote) -->
          <div style="padding: 0.75rem 1.15rem; background: var(--bg-secondary); border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 0.6rem;">
            <button type="button" class="btn-copiar-kit" onclick="window.copiarKitAlPortapapeles('${kit.id}')" title="Copiar este machote al portapapeles estructurado para WhatsApp o correo" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; font-size: 0.82rem; font-weight: 600; padding: 0.45rem 0.85rem; background: #2563eb; color: #ffffff; border: none; border-radius: 7px; cursor: pointer; box-shadow: 0 2px 6px rgba(37,99,235,0.22);">
              <i data-lucide="copy" style="width: 14px; height: 14px;"></i> Copiar Machote
            </button>

            <div style="display: flex; gap: 0.3rem;">
              <button type="button" class="action-btn" onclick="window.abrirModalFormularioKit('${kit.id}')" title="Editar Machote" style="padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="pencil" style="width: 13px; height: 13px;"></i>
              </button>
              <button type="button" class="action-btn" onclick="window.duplicarKitServicio('${kit.id}')" title="Duplicar Machote" style="padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="copy-plus" style="width: 13px; height: 13px;"></i>
              </button>
              <button type="button" class="action-btn" onclick="window.eliminarKitServicio('${kit.id}')" title="Eliminar Machote" style="padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.06); color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
              </button>
            </div>
          </div>

        </div>
      `;
    }).join('');

    return `
      <!-- SECCION DE MARCA: ${brandName} -->
      <div class="kit-brand-section" style="display:flex; flex-direction:column; gap:0.85rem;">
        
        <!-- Header de la Seccion de Marca -->
        <div class="kit-brand-section-header" style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding: 0.65rem 1rem; background: var(--bg-card); border: 1px solid var(--border); border-left: 4px solid #2563eb; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
          
          <div style="display:flex; align-items:center; gap:0.85rem; flex-wrap:wrap;">
            ${logoSrc ? `
              <div style="background:#ffffff; padding:4px 10px; border-radius:8px; border:1px solid rgba(0,0,0,0.08); display:flex; align-items:center; justify-content:center; height:36px; min-width:64px;">
                <img src="${logoSrc}" alt="${brandName}" style="max-height:26px; max-width:130px; object-fit:contain;" />
              </div>
            ` : `
              <div style="background:rgba(37,99,235,0.1); color:#2563eb; padding:6px 10px; border-radius:8px; font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:6px;">
                <i data-lucide="shield-check" style="width:16px;height:16px;"></i>
              </div>
            `}

            <div>
              <h3 style="margin:0; font-size:1.02rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.2px;">
                ${brandName}
              </h3>
              <div style="font-size:0.74rem; color:var(--text-muted); font-weight:500;">
                ${brandKits.length} machote${brandKits.length === 1 ? '' : 's'} de mantenimiento configurado${brandKits.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="badge" style="background:var(--bg-secondary); border:1px solid var(--border); color:var(--text-secondary); font-size:0.74rem; padding:3px 8px; border-radius:6px; font-weight:600;">
              ${brandKits.length} Machote${brandKits.length === 1 ? '' : 's'}
            </span>
          </div>

        </div>

        <!-- Grid de Tarjetas de esta Marca -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.25rem;">
          ${brandCardsHtml}
        </div>

      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
};

window.copiarKitAlPortapapeles = function(kitId) {
  const kits = window.loadKitsServicio();
  const kit = kits.find(k => k.id === kitId);
  if (!kit) return;

  const lineas = [
    `*MACHOTE DE SERVICIO PREVENTIVO — EUROREP*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*${kit.nombre.toUpperCase()}*`,
    `Equipo / Modelo: ${kit.modelo} | Marca: ${kit.marca || 'N/A'}`,
    `Intervalo: ${kit.intervalo} Horas de Operación`,
    kit.descripcion ? `Alcance Técnico: ${kit.descripcion}` : '',
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*LISTA DE REFACCIONES REQUERIDAS (${(kit.piezas||[]).length} ítems):*`
  ];

  (kit.piezas || []).forEach((p, idx) => {
    lineas.push(`  ${idx + 1}. [${p.codigo || p.clave || 'S/C'}] ${p.descripcion} • Cant: ${p.cantidad || 1}`);
  });

  lineas.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Eurorep Postventa • Machote Técnico de Servicio`
  );

  const textoFinal = lineas.filter(l => l !== null && l !== undefined && l !== '').join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textoFinal).then(() => {
      mostrarNotificacion(`Machote de ${kit.nombre} copiado al portapapeles. Listo para WhatsApp o correo.`, 'success');
    }).catch(() => {
      prompt('Copia el machote de servicio:', textoFinal);
    });
  } else {
    prompt('Copia el machote de servicio:', textoFinal);
  }
};

window.crearTicketDesdeKit = function(kitId) {
  const kits = window.loadKitsServicio();
  const kit = kits.find(k => k.id === kitId);
  if (!kit) return;

  window.cerrarModalKitsServicio();

  const refaccionesMapeadas = (kit.piezas || []).map(p => ({
    clave: p.codigo || p.clave || 'S/C',
    codigo: p.codigo || p.clave || 'S/C',
    nombre: p.descripcion || p.nombre || 'Sin Descripción',
    descripcion: p.descripcion || p.nombre || 'Sin Descripción',
    marca: p.marca || kit.marca || '',
    cantidad: parseInt(p.cantidad, 10) || 1,
    estatusPedido: 'Por Pedir'
  }));

  if (typeof window.abrirTicketPreloaded === 'function') {
    window.abrirTicketPreloaded({
      asunto: `Mantenimiento Preventivo ${kit.intervalo}h - ${kit.modelo}`,
      categoria: 'Refacción',
      prioridad: 'Media',
      area: 'Operaciones',
      descripcion: `Solicitud de refacciones para servicio de mantenimiento preventivo de ${kit.intervalo} horas para equipo modelo ${kit.modelo}.\n${kit.descripcion || ''}`,
      refaccionesSeleccionadas: refaccionesMapeadas
    });
  } else if (typeof abrirTicket === 'function') {
    abrirTicket(null);
    setTimeout(() => {
      const elAsunto = document.getElementById('t-asunto');
      if (elAsunto) elAsunto.value = `Mantenimiento Preventivo ${kit.intervalo}h - ${kit.modelo}`;
      const elCat = document.getElementById('t-categoria');
      if (elCat) elCat.value = 'Refacción';
      const elDesc = document.getElementById('t-descripcion');
      if (elDesc) elDesc.value = `Solicitud de refacciones para servicio de mantenimiento preventivo de ${kit.intervalo} horas para equipo modelo ${kit.modelo}.\n${kit.descripcion || ''}`;
      if (typeof window.inicializarRefaccionesTicket === 'function') {
        window.inicializarRefaccionesTicket(null, refaccionesMapeadas);
      }
    }, 150);
  }

  mostrarNotificacion(`Ticket inicializado con las refacciones del ${kit.nombre}`, 'info');
};

window.exportarKitsAExcel = function() {
  const kits = window.loadKitsServicio();
  if (!kits || kits.length === 0) {
    mostrarNotificacion('No hay kits de servicio para exportar.', 'error');
    return;
  }

  if (typeof XLSX === 'undefined') {
    mostrarNotificacion('La librería de Excel (XLSX) no está disponible.', 'error');
    return;
  }

  const rows = [];
  kits.forEach(kit => {
    (kit.piezas || []).forEach(p => {
      rows.push({
        'ID Kit': kit.id,
        'Nombre del Kit': kit.nombre,
        'Modelo Maquinaria': kit.modelo,
        'Marca Fabricante': kit.marca || '',
        'Intervalo (Horas)': kit.intervalo,
        'Código / Clave SAP': p.codigo || 'S/C',
        'Descripción Refacción': p.descripcion || '',
        'Sistema': p.sistema || 'General',
        'Cantidad Recomendada': p.cantidad || 1,
        'Notas de Servicio': kit.descripcion || ''
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kits de Servicio');

  const fechaStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Kits_Servicio_Preventivo_Eurorep_${fechaStr}.xlsx`);
  mostrarNotificacion('Catálogo de kits exportado a Excel exitosamente.', 'success');
};

// --- GESTIÓN DE KITS EN FORMULARIO DE TICKET (CATEGORÍA SERVICIO TÉCNICO) ---
window._ticketKitSeleccionado = null;

window.detectarMachotesParaMaquina = function(maquinaRawText, kitsList) {
  if (!maquinaRawText || typeof maquinaRawText !== 'string' || !kitsList || kitsList.length === 0) {
    return { sugeridos: [], nombreLimpio: '' };
  }

  // Limpiar texto de la máquina: remover [ID], (SN: ...)
  let clean = maquinaRawText.trim();
  if (clean.startsWith('[') && clean.includes(']')) {
    clean = clean.substring(clean.indexOf(']') + 1).trim();
  }
  if (clean.includes('(SN:')) {
    clean = clean.split('(SN:')[0].trim();
  } else if (clean.includes('(sn:')) {
    clean = clean.split('(sn:')[0].trim();
  }

  const cleanLower = clean.toLowerCase();
  const cleanTokens = cleanLower.split(/[\s\-_/]+/).filter(t => t.length >= 2);

  const matched = [];

  kitsList.forEach(k => {
    const kitModLower = (k.modelo || '').toLowerCase();
    const kitModTokens = kitModLower.split(/[\s\-_/]+/).filter(t => t.length >= 2);
    const kitMarcaLower = (k.marca || '').toLowerCase();

    let score = 0;

    // 1. Coincidencia de Marca
    const marcaMatch = cleanLower.includes(kitMarcaLower) || 
      (kitMarcaLower.includes('casa') && cleanLower.includes('casa')) ||
      (kitMarcaLower.includes('grande') && cleanLower.includes('grande')) ||
      (kitMarcaLower.includes('rubble') && cleanLower.includes('rubble')) ||
      (kitMarcaLower.includes('fiori') && cleanLower.includes('fiori')) ||
      (kitMarcaLower.includes('hyundai') && cleanLower.includes('hyundai')) ||
      (kitMarcaLower.includes('cifa') && cleanLower.includes('cifa')) ||
      (kitMarcaLower.includes('simem') && cleanLower.includes('simem')) ||
      (kitMarcaLower.includes('zoomlion') && cleanLower.includes('zoomlion')) ||
      (kitMarcaLower.includes('cummins') && cleanLower.includes('cummins'));

    // 2. Coincidencia de Modelo (tokens alfanuméricos clave como b125, rm120, rm100, db460, hx220, zr255, k45, etc.)
    const modelTokenMatch = cleanTokens.some(ct => {
      return kitModTokens.some(kt => ct === kt || ct.includes(kt) || kt.includes(ct));
    });

    // 3. Coincidencia directa en texto
    const directModelMatch = (kitModLower && cleanLower.includes(kitModLower)) ||
      (cleanLower && kitModLower.includes(cleanLower)) ||
      cleanTokens.some(ct => kitModLower.includes(ct) && ct.length >= 3);

    if (marcaMatch && (modelTokenMatch || directModelMatch)) {
      score = 10;
    } else if (modelTokenMatch) {
      score = 8;
    } else if (directModelMatch && cleanTokens.some(t => /\d/.test(t))) {
      score = 6;
    }

    if (score > 0) {
      matched.push({ kit: k, score });
    }
  });

  matched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return parseInt(a.kit.intervalo, 10) - parseInt(b.kit.intervalo, 10);
  });

  return {
    sugeridos: matched.map(m => m.kit),
    nombreLimpio: clean || maquinaRawText
  };
};

window.toggleMenuMachotesTicket = function(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const menu = document.getElementById('custom-kit-dropdown-menu');
  const chevron = document.getElementById('custom-kit-chevron');
  const inputSearch = document.getElementById('custom-kit-search-input');
  if (!menu) return;

  const isOpen = menu.style.display === 'block';
  if (isOpen) {
    window.cerrarMenuMachotesTicket();
  } else {
    menu.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    if (inputSearch) {
      inputSearch.value = '';
      setTimeout(() => inputSearch.focus(), 60);
    }
    window.renderCustomMachotesList('');
  }
};

window.cerrarMenuMachotesTicket = function() {
  const menu = document.getElementById('custom-kit-dropdown-menu');
  const chevron = document.getElementById('custom-kit-chevron');
  if (menu) menu.style.display = 'none';
  if (chevron) chevron.style.transform = 'rotate(0deg)';
};

window.filtrarMachotesTicketCustom = function(q) {
  window.renderCustomMachotesList(q);
};

window.seleccionarMachoteTicket = function(kitId) {
  const hiddenInput = document.getElementById('t-kit-servicio-select');
  if (hiddenInput) hiddenInput.value = kitId || '';

  const allKits = window.loadKitsServicio();
  const kitsPool = (allKits && allKits.length > 0) ? allKits : KITS_PRECARGADOS_DEFAULT;
  const kit = kitsPool.find(k => k.id === kitId);

  const triggerContent = document.getElementById('custom-kit-trigger-content');
  const btnLimpiar = document.getElementById('btn-limpiar-kit-ticket');

  if (kit && kitId) {
    const nPzas = (kit.piezas || []).length;
    const pzasTxt = nPzas === 1 ? '1 refacción' : `${nPzas} refacciones`;
    if (triggerContent) {
      triggerContent.innerHTML = `
        <span style="background:#2563eb; color:#fff; font-weight:700; font-size:0.75rem; padding:2px 7px; border-radius:4px; flex-shrink:0;">${kit.intervalo}h</span>
        <strong style="color:var(--text-primary); font-size:0.84rem;">${kit.modelo || kit.nombre}</strong>
        <span style="font-size:0.75rem; color:var(--text-muted);">(${pzasTxt})</span>
      `;
    }
    if (btnLimpiar) btnLimpiar.style.display = 'inline-block';
  } else {
    if (triggerContent) {
      triggerContent.innerHTML = `
        <span style="color:var(--text-muted); font-size:0.85rem;">-- Sin Machote (Servicio Técnico Manual) --</span>
      `;
    }
    if (btnLimpiar) btnLimpiar.style.display = 'none';
  }

  window.alSeleccionarKitEnTicket(kitId || '');
  window.cerrarMenuMachotesTicket();
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.limpiarMachoteTicket = function(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  window.seleccionarMachoteTicket('');
};

window.renderCustomMachotesList = function(filtroTexto = '') {
  const container = document.getElementById('custom-kit-options-list');
  if (!container) return;

  const allKits = window.loadKitsServicio();
  const kitsDisponibles = (allKits && allKits.length > 0) ? allKits : KITS_PRECARGADOS_DEFAULT;

  // Detectar máquinas seleccionadas en el ticket
  const chipsEq = Array.from(document.querySelectorAll('#t-equipos-seleccionados .maquina-chip')).map(el => el.getAttribute('data-value') || el.textContent || '');
  const selectEqVal = document.getElementById('t-equipo')?.value || '';
  const maquinasList = chipsEq.length > 0 ? chipsEq : (selectEqVal ? [selectEqVal] : []);

  let sugeridosKits = [];
  let nombreEquipoDetectado = '';

  for (const maqStr of maquinasList) {
    if (maqStr && maqStr !== 'Otra / No registrada') {
      const res = window.detectarMachotesParaMaquina(maqStr, kitsDisponibles);
      if (res.sugeridos && res.sugeridos.length > 0) {
        sugeridosKits = res.sugeridos;
        nombreEquipoDetectado = res.nombreLimpio;
        break;
      }
    }
  }

  const currentKitId = document.getElementById('t-kit-servicio-select')?.value || '';
  const q = (filtroTexto || '').toLowerCase().trim();

  const matchFilter = (k) => {
    if (!q) return true;
    const matchNom = (k.nombre || '').toLowerCase().includes(q);
    const matchMod = (k.modelo || '').toLowerCase().includes(q);
    const matchMarca = (k.marca || '').toLowerCase().includes(q);
    const matchDesc = (k.descripcion || '').toLowerCase().includes(q);
    const matchHoras = (k.intervalo || '').toLowerCase().includes(q);
    const matchPiezas = (k.piezas || []).some(p => 
      (p.codigo || '').toLowerCase().includes(q) || 
      (p.descripcion || '').toLowerCase().includes(q)
    );
    return matchNom || matchMod || matchMarca || matchDesc || matchHoras || matchPiezas;
  };

  let html = '';

  // 0. Opción Sin Machote
  if (!q || 'sin machote manual servicio'.includes(q)) {
    const isSelected = !currentKitId;
    html += `
      <div class="custom-kit-row ${isSelected ? 'selected' : ''}" onclick="window.seleccionarMachoteTicket('')">
        <div style="display:flex; align-items:center; gap:8px;">
          <i data-lucide="wrench" style="width:14px; height:14px; color:var(--text-muted);"></i>
          <span style="font-size:0.83rem; color:var(--text-secondary); font-weight:${isSelected ? '700' : '500'};">-- Sin Machote (Servicio Manual) --</span>
        </div>
        ${isSelected ? '<i data-lucide="check" style="width:14px; height:14px; color:#2563eb;"></i>' : ''}
      </div>
    `;
  }

  const sugeridosFiltrados = sugeridosKits.filter(matchFilter);
  const sugeridosIds = new Set(sugeridosKits.map(k => k.id));

  // 1. RECOMENDADOS PARA EL EQUIPO SELECCIONADO (HASTA ARRIBA)
  if (sugeridosFiltrados.length > 0) {
    html += `<div class="custom-kit-optgroup-title recommended-title">Recomendados para: ${nombreEquipoDetectado.toUpperCase()}</div>`;
    sugeridosFiltrados.forEach(k => {
      const isSelected = (currentKitId === k.id);
      const nPzas = (k.piezas || []).length;
      const pzasTxt = nPzas === 1 ? '1 refacción' : `${nPzas} refacciones`;
      html += `
        <div class="custom-kit-row recommended-row ${isSelected ? 'selected' : ''}" onclick="window.seleccionarMachoteTicket('${k.id}')">
          <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
            <span style="background:#2563eb; color:#fff; font-weight:700; font-size:0.72rem; padding:2px 7px; border-radius:4px; flex-shrink:0;">${k.intervalo}h</span>
            <div style="display:flex; flex-direction:column; min-width:0;">
              <span style="font-weight:700; font-size:0.84rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${k.modelo || k.nombre}</span>
              <span style="font-size:0.72rem; color:var(--text-secondary); line-height:1.2; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${k.descripcion ? (k.descripcion.length > 55 ? k.descripcion.substring(0, 55) + '...' : k.descripcion) : 'Servicio Preventivo'}</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:8px;">
            <span style="background:var(--bg-body); border:1px solid var(--border); color:var(--text-secondary); font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:600;">
              ${pzasTxt}
            </span>
            ${isSelected ? '<i data-lucide="check" style="width:14px; height:14px; color:#2563eb;"></i>' : ''}
          </div>
        </div>
      `;
    });
  }

  // 2. OTROS MACHOTES AGRUPADOS POR MARCA
  const grouped = {};
  kitsDisponibles.filter(matchFilter).forEach(k => {
    if (sugeridosIds.has(k.id)) return; // No duplicar si ya se mostró en recomendados
    const marca = (k.marca || 'VARIOS').toUpperCase();
    if (!grouped[marca]) grouped[marca] = [];
    grouped[marca].push(k);
  });

  const marcasKeys = Object.keys(grouped).sort();
  marcasKeys.forEach(marca => {
    const labelMarca = sugeridosKits.length > 0 ? `OTRAS MARCAS — ${marca}` : marca;
    html += `<div class="custom-kit-optgroup-title">${labelMarca}</div>`;
    grouped[marca].forEach(k => {
      const isSelected = (currentKitId === k.id);
      const nPzas = (k.piezas || []).length;
      const pzasTxt = nPzas === 1 ? '1 refacción' : `${nPzas} refacciones`;
      html += `
        <div class="custom-kit-row ${isSelected ? 'selected' : ''}" onclick="window.seleccionarMachoteTicket('${k.id}')">
          <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
            <span style="background:rgba(37,99,235,0.12); color:#2563eb; font-weight:700; font-size:0.72rem; padding:2px 7px; border-radius:4px; flex-shrink:0;">${k.intervalo}h</span>
            <div style="display:flex; flex-direction:column; min-width:0;">
              <span style="font-weight:600; font-size:0.83rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${k.modelo || k.nombre}</span>
              <span style="font-size:0.71rem; color:var(--text-muted); line-height:1.2;">${k.marca || 'Universal'}</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:8px;">
            <span style="background:var(--bg-body); border:1px solid var(--border); color:var(--text-secondary); font-size:0.72rem; padding:2px 6px; border-radius:4px;">
              ${pzasTxt}
            </span>
            ${isSelected ? '<i data-lucide="check" style="width:14px; height:14px; color:#2563eb;"></i>' : ''}
          </div>
        </div>
      `;
    });
  });

  if (!html) {
    html = `<div style="text-align:center; padding:1.25rem; color:var(--text-muted); font-size:0.8rem;">No se encontraron machotes con "${filtroTexto}"</div>`;
  }

  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.alCambiarCategoriaTicket = function() {
  const catEl = document.getElementById('t-categoria');
  const groupKit = document.getElementById('group-t-kit-servicio');
  const hiddenKit = document.getElementById('t-kit-servicio-select');
  const previewKit = document.getElementById('t-kit-servicio-preview');
  if (!catEl || !groupKit) return;

  const esServicioTecnico = catEl.value === 'Servicio Técnico';
  groupKit.style.display = esServicioTecnico ? 'block' : 'none';

  if (!esServicioTecnico) {
    if (hiddenKit) hiddenInput = hiddenKit.value = '';
    if (previewKit) {
      previewKit.style.display = 'none';
      previewKit.innerHTML = '';
    }
    window._ticketKitSeleccionado = null;
    window.cerrarMenuMachotesTicket();
    return;
  }

  // Si es servicio técnico, actualizar lista y estado visual del trigger
  const currentVal = hiddenKit ? hiddenKit.value : '';
  if (currentVal) {
    window.seleccionarMachoteTicket(currentVal);
  } else {
    window.renderCustomMachotesList('');
  }
};

// Listener global para cerrar el menú custom al hacer clic fuera
if (!window._machoteMenuListenerAttached) {
  window._machoteMenuListenerAttached = true;
  document.addEventListener('click', function(e) {
    const picker = document.getElementById('custom-kit-picker');
    if (picker && !picker.contains(e.target)) {
      window.cerrarMenuMachotesTicket();
    }
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      window.cerrarMenuMachotesTicket();
    }
  });
}

window.alSeleccionarKitEnTicket = function(kitId) {
  const previewKit = document.getElementById('t-kit-servicio-preview');
  if (!kitId) {
    window._ticketKitSeleccionado = null;
    if (previewKit) {
      previewKit.style.display = 'none';
      previewKit.innerHTML = '';
    }
    return;
  }

  const allKits = window.loadKitsServicio();
  const kitsPool = (allKits && allKits.length > 0) ? allKits : KITS_PRECARGADOS_DEFAULT;
  const kit = kitsPool.find(k => k.id === kitId);
  if (!kit) return;

  window._ticketKitSeleccionado = kit;

  if (previewKit) {
    const piezas = kit.piezas || [];
    const totalPzas = piezas.reduce((sum, p) => sum + (parseInt(p.cantidad, 10) || 1), 0);
    const piezasListHtml = piezas.map(p => `
      <span style="display:inline-flex; align-items:center; gap:3px; background:var(--bg-body); border:1px solid var(--border); padding:2px 6px; border-radius:4px; margin:2px 0;">
        <strong style="color:#2563eb; font-family:monospace;">${p.codigo || p.clave || 'S/C'}</strong> 
        ${p.descripcion} (x${p.cantidad || 1})
      </span>
    `).join(' ');

    previewKit.style.display = 'block';
    previewKit.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.35rem; gap:0.5rem; flex-wrap:wrap;">
        <div>
          <strong style="color:var(--text-primary); font-size:0.84rem;">${kit.nombre}</strong>
          <span style="font-size:0.72rem; color:var(--text-muted); margin-left:6px;">Equipo: ${kit.modelo}</span>
        </div>
        <span style="background:rgba(37,99,235,0.12); color:#2563eb; border:1px solid rgba(37,99,235,0.25); font-weight:700; padding:2px 7px; border-radius:5px; font-size:0.72rem;">
          ${kit.intervalo} HORAS
        </span>
      </div>
      ${kit.descripcion ? `<div style="color:var(--text-secondary); font-size:0.75rem; margin-bottom:0.4rem; line-height:1.4;">${kit.descripcion}</div>` : ''}
      <div style="font-size:0.73rem; color:var(--text-muted); border-top:1px dashed var(--border); padding-top:0.35rem; margin-top:0.35rem;">
        <strong>Refacciones vinculadas (${piezas.length} items • ${totalPzas} pzas):</strong>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
          ${piezasListHtml}
        </div>
      </div>
    `;
  }

  // Sugerir Asunto si está vacío o por defecto
  const elAsunto = document.getElementById('t-asunto');
  if (elAsunto && (!elAsunto.value.trim() || elAsunto.value.includes('Servicio Preventivo') || elAsunto.value.includes('Mantenimiento'))) {
    elAsunto.value = `Servicio Preventivo ${kit.intervalo}h - ${kit.modelo}`;
  }

  // Si la descripción está vacía o es genérica, prellenar con el alcance técnico
  const elDesc = document.getElementById('t-descripcion');
  if (elDesc && (!elDesc.value.trim() || elDesc.value.startsWith('Servicio preventivo'))) {
    const listadoPiezasTxt = (kit.piezas || []).map((p, idx) => `  ${idx+1}. [${p.codigo||p.clave||'S/C'}] ${p.descripcion} (Cant: ${p.cantidad||1})`).join('\n');
    elDesc.value = `Servicio preventivo de ${kit.intervalo} horas para ${kit.modelo}.\nAlcance: ${kit.descripcion || 'Mantenimiento preventivo programado.'}\n\nRefacciones requeridas:\n${listadoPiezasTxt}`;
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.abrirModalKitsDesdeTicket = function() {
  const eqVal = document.getElementById('t-equipo')?.value || '';
  window.abrirModalKitsServicio(eqVal);
};

// --- DETECCIÓN AUTOMÁTICA DE SISTEMA PARA REFACCIONES ---
window.detectarSistemaRefaccion = function(descripcion) {
  const descLower = (descripcion || '').toLowerCase();
  if (descLower.includes('aceite') || descLower.includes('motor') || descLower.includes('lubricante') || descLower.includes('valvula') || descLower.includes('inyector') || descLower.includes('junta') || descLower.includes('piston')) return 'Motor';
  if (descLower.includes('combustible') || descLower.includes('diesel') || descLower.includes('separador') || descLower.includes('gasoil') || descLower.includes('trampa') || descLower.includes('cebador')) return 'Combustible';
  if (descLower.includes('aire') || descLower.includes('admision') || descLower.includes('admis') || descLower.includes('primario') || descLower.includes('secundario') || descLower.includes('seguridad') || descLower.includes('filtro aire')) return 'Aire / Admisión';
  if (descLower.includes('hidraulico') || descLower.includes('hidráulico') || descLower.includes('presion') || descLower.includes('retorno') || descLower.includes('hidrost') || descLower.includes('servomando') || descLower.includes('bomba hidr')) return 'Hidráulico';
  if (descLower.includes('banda') || descLower.includes('correa') || descLower.includes('polea') || descLower.includes('transmision') || descLower.includes('transmisión') || descLower.includes('engrane') || descLower.includes('cadena')) return 'Transmisión';
  if (descLower.includes('electr') || descLower.includes('sensor') || descLower.includes('bateria') || descLower.includes('alternador') || descLower.includes('marcha') || descLower.includes('fusible') || descLower.includes('relevador')) return 'Eléctrico';
  if (descLower.includes('cuchilla') || descLower.includes('diente') || descLower.includes('desgaste') || descLower.includes('martillo') || descLower.includes('blindaje') || descLower.includes('placa') || descLower.includes('malla')) return 'Desgaste / Cuchillas';
  return 'General';
};

// --- AUTOCOMPLETADO Y VINCULACIÓN CON MAQUINARIA ---
window.obtenerCatalogoMaquinariaCompleto = function() {
  const marcasSet = new Set(['RUBBLE MASTER', 'FIORI', 'CASAGRANDE', 'HYUNDAI', 'CIFA', 'SIMEM', 'ZOOMLION', 'CUMMINS', 'UNIVERSAL']);
  
  // Modelos base conocidos por marca
  const modelosPorMarca = {
    'RUBBLE MASTER': ['RM120X', 'RM100GO!', 'RM90GO!', 'RM70GO!', 'RM60', 'RMJ110X', 'MS1200 MAX', 'MS1200', 'MS125GO!'],
    'FIORI': ['DB 460 CBV', 'DB 260', 'DB 180', 'DBX 5000', 'DBX 3500'],
    'CASAGRANDE': ['B125 XP', 'B250 XP', 'B300 XP', 'B360 XP'],
    'HYUNDAI': ['HX220L', 'HX300L', 'HL760-9'],
    'CIFA': ['K45H', 'K38L', 'RY1300'],
    'SIMEM': ['EAGLE 2500', 'MEB 2000'],
    'ZOOMLION': ['ZR255H', 'ZR360H'],
    'CUMMINS': ['QSB6.7', 'QSL9', 'QSX15', 'K38 / QSK38', 'K50 / QSK50'],
    'UNIVERSAL': ['UNIVERSAL / MULTIMARCA']
  };

  const normalizarMarca = (m) => {
    if (!m) return 'UNIVERSAL';
    const up = m.trim().toUpperCase();
    if (up.includes('RUBBLE') || up === 'RBM') return 'RUBBLE MASTER';
    if (up.includes('FIORI') || up === 'FIO') return 'FIORI';
    if (up.includes('CASA') || up.includes('GRANDE') || up === 'CAS') return 'CASAGRANDE';
    if (up.includes('HYUNDAI') || up === 'HYU' || up === 'EVE') return 'HYUNDAI';
    if (up.includes('CIFA') || up === 'CIF') return 'CIFA';
    if (up.includes('SIMEM') || up === 'SIM') return 'SIMEM';
    if (up.includes('ZOOMLION')) return 'ZOOMLION';
    if (up.includes('CUMMINS')) return 'CUMMINS';
    return up;
  };

  // Agregar modelos registrados en maquinariaDb
  if (typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb)) {
    maquinariaDb.forEach(m => {
      const rawMod = (m.modelo || m.descripcion || '').trim();
      const rawMarca = (m.marca || '').trim();
      if (!rawMod || rawMod === 'Sin Modelo' || rawMod === 'N/A') return;
      const marcaNorm = normalizarMarca(rawMarca);
      marcasSet.add(marcaNorm);
      if (!modelosPorMarca[marcaNorm]) modelosPorMarca[marcaNorm] = [];
      if (!modelosPorMarca[marcaNorm].includes(rawMod)) {
        modelosPorMarca[marcaNorm].push(rawMod);
      }
    });
  }

  // Agregar modelos de kits existentes
  const allKits = (typeof window.loadKitsServicio === 'function') ? window.loadKitsServicio() : [];
  allKits.forEach(k => {
    const rawMod = (k.modelo || '').trim();
    const rawMarca = (k.marca || '').trim();
    if (!rawMod) return;
    const marcaNorm = normalizarMarca(rawMarca);
    marcasSet.add(marcaNorm);
    if (!modelosPorMarca[marcaNorm]) modelosPorMarca[marcaNorm] = [];
    if (!modelosPorMarca[marcaNorm].includes(rawMod)) {
      modelosPorMarca[marcaNorm].push(rawMod);
    }
  });

  return {
    marcas: Array.from(marcasSet).sort(),
    modelosPorMarca: modelosPorMarca,
    normalizarMarca: normalizarMarca
  };
};

window.popularSelectMarcasYModelosKit = function(selectedMarca, selectedModelo) {
  const cat = window.obtenerCatalogoMaquinariaCompleto();
  const selectMarca = document.getElementById('kit-form-marca');
  const selectModelo = document.getElementById('kit-form-modelo');

  if (!selectMarca || !selectModelo) return;

  const currentMarca = selectedMarca || selectMarca.value || '';
  const currentModelo = selectedModelo || selectModelo.value || '';

  // 1. Poblar select de Marcas
  let htmlMarcas = '<option value="">-- Seleccionar Marca --</option>';
  cat.marcas.forEach(m => {
    const isSel = (m.toUpperCase() === currentMarca.toUpperCase());
    htmlMarcas += `<option value="${m}" ${isSel ? 'selected' : ''}>${m}</option>`;
  });
  selectMarca.innerHTML = htmlMarcas;

  // 2. Poblar select de Modelos
  let htmlModelos = '<option value="">-- Seleccionar Modelo de Maquinaria --</option>';

  if (currentMarca && cat.modelosPorMarca[currentMarca]) {
    // Filtrado por la marca seleccionada
    const mods = cat.modelosPorMarca[currentMarca].sort();
    mods.forEach(mod => {
      const isSel = (mod.toLowerCase() === currentModelo.toLowerCase());
      htmlModelos += `<option value="${mod}" ${isSel ? 'selected' : ''}>${mod}</option>`;
    });
  } else {
    // Agrupado por marca
    cat.marcas.forEach(m => {
      const mods = cat.modelosPorMarca[m];
      if (mods && mods.length > 0) {
        htmlModelos += `<optgroup label="${m}">`;
        mods.sort().forEach(mod => {
          const isSel = (mod.toLowerCase() === currentModelo.toLowerCase());
          htmlModelos += `<option value="${mod}" ${isSel ? 'selected' : ''}>${mod}</option>`;
        });
        htmlModelos += `</optgroup>`;
      }
    });
  }

  // Si el modelo actual es personalizado y no estaba en la lista, incluirlo
  if (currentModelo && !htmlModelos.includes(`value="${currentModelo}"`)) {
    htmlModelos += `<option value="${currentModelo}" selected>${currentModelo}</option>`;
  }

  selectModelo.innerHTML = htmlModelos;
  if (currentModelo) selectModelo.value = currentModelo;
  if (currentMarca) selectMarca.value = currentMarca;
};

window.alCambiarMarcaKit = function(marcaVal) {
  const selectModelo = document.getElementById('kit-form-modelo');
  const curModelo = selectModelo ? selectModelo.value : '';

  // Re-poblar los modelos filtrados para la marca elegida
  window.popularSelectMarcasYModelosKit(marcaVal, curModelo);

  // Si el modelo actual no pertenece a la nueva marca, sugerir el primer modelo de la marca
  const cat = window.obtenerCatalogoMaquinariaCompleto();
  if (marcaVal && cat.modelosPorMarca[marcaVal] && cat.modelosPorMarca[marcaVal].length > 0) {
    if (!cat.modelosPorMarca[marcaVal].includes(selectModelo.value)) {
      selectModelo.value = cat.modelosPorMarca[marcaVal][0];
      window.alCambiarModeloKit(selectModelo.value);
    }
  }

  // Actualizar filas de refacciones vacías con la nueva marca
  if (marcaVal) {
    const rows = document.querySelectorAll('#ref-kit-list .ref-row');
    rows.forEach(r => {
      const hiddenM = r.querySelector('.ref-marca');
      const hiddenD = r.querySelector('.ref-desc-hidden');
      if (hiddenM && (!hiddenM.value || hiddenM.value === 'UNIVERSAL') && (!hiddenD || !hiddenD.value)) {
        const idComboM = hiddenM.id;
        const idComboD = r.querySelector('.ref-desc-hidden')?.id;
        if (idComboM && idComboD) {
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          let brandCode = marcaVal;
          if (typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb)) {
            const match = refaccionesDb.find(ref => ref.marca && ref.marca.toLowerCase() === marcaVal.toLowerCase());
            if (match) {
              brandCode = match.marca;
            } else {
              for (const [k, v] of Object.entries(MARCAS_RENDER)) {
                if (v.toLowerCase() === marcaVal.toLowerCase() || marcaVal.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(marcaVal.toLowerCase())) {
                  brandCode = k;
                  break;
                }
              }
            }
          }
          hiddenM.value = brandCode;
          const comboSpanMarca = document.getElementById(`${idComboM}-display`);
          if (comboSpanMarca) comboSpanMarca.textContent = MARCAS_RENDER[brandCode.toUpperCase()] || brandCode;
          window.actualizarDescripcionesCombo(idComboM, idComboD);
        }
      }
    });
  }
};

window.alCambiarModeloKit = function(modeloVal) {
  if (!modeloVal) return;
  const modClean = modeloVal.trim();
  const inMarca = document.getElementById('kit-form-marca');
  const cat = window.obtenerCatalogoMaquinariaCompleto();

  // Encontrar a qué marca pertenece este modelo
  let marcaDetectada = '';
  for (const [marca, mods] of Object.entries(cat.modelosPorMarca)) {
    if (mods.some(m => m.toLowerCase() === modClean.toLowerCase())) {
      marcaDetectada = marca;
      break;
    }
  }

  // Si no se encontró en el mapa, buscar en maquinariaDb
  if (!marcaDetectada && typeof maquinariaDb !== 'undefined' && Array.isArray(maquinariaDb)) {
    const match = maquinariaDb.find(m => {
      const mMod = (m.modelo || m.descripcion || '').toLowerCase().trim();
      return mMod === modClean.toLowerCase() || mMod.includes(modClean.toLowerCase()) || modClean.toLowerCase().includes(mMod);
    });
    if (match && match.marca) {
      marcaDetectada = cat.normalizarMarca(match.marca);
    }
  }

  // Inferir marca por prefijos de modelos oficiales si aún no se detectó
  if (!marcaDetectada) {
    const mLower = modClean.toLowerCase();
    if (mLower.startsWith('rm') || mLower.startsWith('ms')) marcaDetectada = 'RUBBLE MASTER';
    else if (mLower.startsWith('db') || mLower.includes('fiori')) marcaDetectada = 'FIORI';
    else if (mLower.startsWith('b1') || mLower.startsWith('b2') || mLower.startsWith('b3') || mLower.includes('casagrande')) marcaDetectada = 'CASAGRANDE';
    else if (mLower.startsWith('hx') || mLower.startsWith('hl') || mLower.includes('hyundai')) marcaDetectada = 'HYUNDAI';
    else if (mLower.startsWith('zr') || mLower.includes('zoomlion')) marcaDetectada = 'ZOOMLION';
    else if (mLower.startsWith('k') || mLower.startsWith('ry') || mLower.includes('cifa')) marcaDetectada = 'CIFA';
    else if (mLower.includes('simem') || mLower.includes('eagle')) marcaDetectada = 'SIMEM';
    else if (mLower.startsWith('qs') || mLower.includes('cummins')) marcaDetectada = 'CUMMINS';
    else marcaDetectada = 'UNIVERSAL';
  }

  if (inMarca && marcaDetectada && inMarca.value !== marcaDetectada) {
    inMarca.value = marcaDetectada;
  }

  // Sugerir nombre automático
  const inNombre = document.getElementById('kit-form-nombre');
  const inIntervalo = document.getElementById('kit-form-intervalo');
  if (inNombre && (!inNombre.value || inNombre.value.startsWith('Machote Preventivo') || inNombre.value.startsWith('Kit Preventivo'))) {
    const horas = inIntervalo ? inIntervalo.value : '250';
    inNombre.value = `Machote Preventivo ${horas}h - ${modeloVal.trim()}`;
  }

  // Actualizar filas de refacciones vacías con la marca detectada
  if (marcaDetectada) {
    const rows = document.querySelectorAll('#ref-kit-list .ref-row');
    rows.forEach(r => {
      const hiddenM = r.querySelector('.ref-marca');
      const hiddenD = r.querySelector('.ref-desc-hidden');
      if (hiddenM && (!hiddenM.value || hiddenM.value === 'UNIVERSAL') && (!hiddenD || !hiddenD.value)) {
        const idComboM = hiddenM.id;
        const idComboD = r.querySelector('.ref-desc-hidden')?.id;
        if (idComboM && idComboD) {
          const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};
          let brandCode = marcaDetectada;
          if (typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb)) {
            const match = refaccionesDb.find(ref => ref.marca && ref.marca.toLowerCase() === marcaDetectada.toLowerCase());
            if (match) {
              brandCode = match.marca;
            } else {
              for (const [k, v] of Object.entries(MARCAS_RENDER)) {
                if (v.toLowerCase() === marcaDetectada.toLowerCase() || marcaDetectada.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(marcaDetectada.toLowerCase())) {
                  brandCode = k;
                  break;
                }
              }
            }
          }
          hiddenM.value = brandCode;
          const comboSpanMarca = document.getElementById(`${idComboM}-display`);
          if (comboSpanMarca) comboSpanMarca.textContent = MARCAS_RENDER[brandCode.toUpperCase()] || brandCode;
          window.actualizarDescripcionesCombo(idComboM, idComboD);
        }
      }
    });
  }
};

window.alCambiarIntervaloKit = function(horasVal) {
  const inNombre = document.getElementById('kit-form-nombre');
  const inModelo = document.getElementById('kit-form-modelo');
  if (inNombre && inModelo && inModelo.value.trim()) {
    const mod = inModelo.value.trim();
    inNombre.value = `Machote Preventivo ${horasVal}h - ${mod}`;
  }
};

window.alEscribirClaveKit = function(inputEl, dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;
  const val = inputEl.value.trim().toLowerCase();
  if (!val) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    return;
  }

  // Cerrar otros dropdowns abiertos
  document.querySelectorAll('.kit-clave-dropdown').forEach(dd => {
    if (dd.id !== dropdownId) dd.style.display = 'none';
  });

  const matches = (typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb))
    ? refaccionesDb.filter(r => {
        const c = (r.codigo || r.idInterno || r.id || '').toLowerCase();
        const d = (r.descripcion || r.nombre || '').toLowerCase();
        return c.includes(val) || d.includes(val);
      }).slice(0, 15)
    : [];

  if (matches.length === 0) {
    dropdown.innerHTML = `<div style="padding: 8px 10px; font-size:0.75rem; color:var(--text-muted); text-align:center;">No se encontró "${inputEl.value}"</div>`;
    dropdown.style.display = 'block';
    return;
  }

  let html = '';
  matches.forEach(m => {
    const clave = m.codigo || m.idInterno || m.id || 'S/C';
    const desc = m.descripcion || m.nombre || '';
    const marca = m.marca || '';
    const sist = m.sistema || '';
    const safeDesc = desc.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeClave = clave.replace(/'/g, "\\'");
    const safeMarca = marca.replace(/'/g, "\\'");
    const safeSist = sist.replace(/'/g, "\\'");

    html += `
      <div class="kit-clave-option" onclick="window.seleccionarRefaccionPorClaveKit('${dropdownId}', '${safeClave}', '${safeDesc}', '${safeMarca}', '${safeSist}')">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
          <span style="font-family: monospace; font-weight: 700; color: #2563eb; font-size:0.79rem;">${clave}</span>
          <span style="font-size: 0.67rem; font-weight: 600; color: var(--text-muted); background: var(--bg-secondary); padding: 1px 5px; border-radius: 4px; border: 1px solid var(--border);">${marca || 'GEN'}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top:2px;" title="${desc}">${desc}</div>
      </div>
    `;
  });

  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
};

window.seleccionarRefaccionPorClaveKit = function(dropdownId, clave, desc, marca, sistema) {
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
  }

  const row = dropdown ? dropdown.closest('.ref-row') : null;
  if (!row) return;

  const inputClave = row.querySelector('.ref-clave');
  if (inputClave) inputClave.value = clave || '';

  const hiddenDesc = row.querySelector('.ref-desc-hidden');
  const comboSpanDesc = row.querySelector('.group-ref-desc .combo-box span');
  if (hiddenDesc) hiddenDesc.value = desc || '';
  if (comboSpanDesc) comboSpanDesc.textContent = desc || 'Descripción...';

  const hiddenMarca = row.querySelector('.ref-marca');
  const comboSpanMarca = row.querySelector('.group-ref-marca .combo-box span');

  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};

  if (hiddenMarca && marca) {
    let brandCode = marca;
    for (const [k, v] of Object.entries(MARCAS_RENDER)) {
      if (v.toLowerCase() === marca.toLowerCase() || marca.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(marca.toLowerCase())) {
        brandCode = k;
        break;
      }
    }
    hiddenMarca.value = brandCode;
    if (comboSpanMarca) comboSpanMarca.textContent = MARCAS_RENDER[brandCode.toUpperCase()] || brandCode;
    if (hiddenDesc) {
      window.actualizarDescripcionesCombo(hiddenMarca.id, hiddenDesc.id);
      hiddenDesc.value = desc;
      if (comboSpanDesc) comboSpanDesc.textContent = desc;
    }
  }

  const hiddenSist = row.querySelector('.ref-sistema');
  if (hiddenSist) {
    hiddenSist.value = sistema || (typeof window.detectarSistemaRefaccion === 'function' ? window.detectarSistemaRefaccion(desc) : 'General');
  }
};

// Cerrar dropdowns de clave al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.group-ref-clave')) {
    document.querySelectorAll('.kit-clave-dropdown').forEach(dd => {
      dd.style.display = 'none';
    });
  }
});

// --- FORMULARIO CREAR / EDITAR MACHOTE ---
window.abrirModalFormularioKit = function(kitId) {
  const modal = document.getElementById('modal-editar-kit-overlay');
  if (!modal) return;

  const inId = document.getElementById('kit-form-id');
  const inNombre = document.getElementById('kit-form-nombre');
  const inIntervalo = document.getElementById('kit-form-intervalo');
  const inDesc = document.getElementById('kit-form-descripcion');
  const titulo = document.getElementById('modal-kit-form-titulo');
  const list = document.getElementById('ref-kit-list');

  if (list) list.innerHTML = '';

  let initialMod = '';
  let initialMarca = '';

  if (kitId) {
    const kits = window.loadKitsServicio();
    const kit = kits.find(k => k.id === kitId);
    if (!kit) return;

    if (titulo) titulo.textContent = `Editar: ${kit.nombre}`;
    if (inId) inId.value = kit.id;
    if (inNombre) inNombre.value = kit.nombre || '';
    if (inIntervalo) inIntervalo.value = kit.intervalo || '250';
    if (inDesc) inDesc.value = kit.descripcion || '';

    initialMod = kit.modelo || '';
    initialMarca = kit.marca || '';

    window.popularSelectMarcasYModelosKit(initialMarca, initialMod);

    (kit.piezas || []).forEach(p => {
      window.agregarFilaPiezaKit(p);
    });
  } else {
    if (titulo) titulo.textContent = 'Nuevo Machote de Servicio Preventivo';
    if (inId) inId.value = '';
    if (inNombre) inNombre.value = '';
    initialMod = window._currentKitFilterModelo !== 'all' ? window._currentKitFilterModelo : '';
    const initialHoras = window._currentKitFilterHours !== 'all' ? window._currentKitFilterHours : '250';
    if (inIntervalo) inIntervalo.value = initialHoras;
    if (inDesc) inDesc.value = '';

    window.popularSelectMarcasYModelosKit('', initialMod);

    if (initialMod) {
      window.alCambiarModeloKit(initialMod);
    }

    // Agregar 2 filas iniciales
    window.agregarFilaPiezaKit();
    window.agregarFilaPiezaKit();
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.cerrarModalFormularioKit = function(e) {
  if (e && e.target) {
    const overlay = document.getElementById('modal-editar-kit-overlay');
    const isOverlay = (e.target === overlay);
    const isCloseBtn = (e.target.classList && e.target.classList.contains('modal-close')) || 
                       (e.target.closest && e.target.closest('.modal-close')) ||
                       (e.target.classList && e.target.classList.contains('btn-cancelar-modal')) ||
                       (e.target.closest && e.target.closest('.btn-cancelar-modal'));
    if (!isOverlay && !isCloseBtn) {
      return;
    }
  }
  const modal = document.getElementById('modal-editar-kit-overlay');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
};

window.agregarFilaPiezaKit = function(piezaData = {}) {
  const list = document.getElementById('ref-kit-list');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'ref-row kit-ref-row';
  row.style.margin = '0';
  row.style.borderBottom = '1px solid var(--border)';
  row.style.padding = '0.35rem 0.2rem';
  row.style.display = 'grid';
  row.style.gridTemplateColumns = '140px 1fr 115px 55px 28px';
  row.style.gap = '0.5rem';
  row.style.alignItems = 'center';

  window.refComboCounter = (window.refComboCounter || 0) + 1;
  const idComboMarca = `ref-kit-marca-${window.refComboCounter}`;
  const idComboDesc = `ref-kit-desc-${window.refComboCounter}`;
  const idDropdownClave = `ref-kit-clave-dd-${window.refComboCounter}`;

  let html = `
    <!-- MARCA COMBO -->
    <div style="position:relative; width:100%; min-width:0;" class="group-ref-marca">
      <div class="combo-box" tabindex="0" id="${idComboMarca}-combo" style="padding: 0.45rem 0.4rem;">
        <span id="${idComboMarca}-display" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 20px); font-size:0.8rem;">Marca...</span>
        <i data-lucide="chevron-down" style="width:14px;height:14px; flex-shrink:0;"></i>
      </div>
      <div class="combo-menu" id="${idComboMarca}-menu" style="width: 250px; z-index: 9999;">
        <div class="combo-search">
          <i data-lucide="search" style="width:14px;height:14px;color:var(--text-muted)"></i>
          <input type="text" id="${idComboMarca}-search" placeholder="Buscar marca..." oninput="filterCombo('${idComboMarca}', this.value)" onclick="event.stopPropagation()">
        </div>
        <div class="combo-options" id="${idComboMarca}-options">
          <!-- Populated by popularSelectMarcas -->
        </div>
      </div>
      <input type="hidden" class="ref-marca" id="${idComboMarca}" />
    </div>

    <!-- DESC COMBO -->
    <div style="position:relative; width:100%; min-width:0;" class="group-ref-desc">
      <div class="combo-box" tabindex="0" id="${idComboDesc}-combo" style="padding: 0.45rem 0.4rem;">
        <span id="${idComboDesc}-display" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 20px); font-size:0.8rem;">Descripción...</span>
        <i data-lucide="chevron-down" style="width:14px;height:14px; flex-shrink:0;"></i>
      </div>
      <div class="combo-menu" id="${idComboDesc}-menu" style="width: 100%; min-width: 300px; z-index: 9999;">
        <div class="combo-search">
          <i data-lucide="search" style="width:14px;height:14px;color:var(--text-muted)"></i>
          <input type="text" id="${idComboDesc}-search" placeholder="Buscar refacción o clave..." oninput="filterCombo('${idComboDesc}', this.value)" onclick="event.stopPropagation()">
        </div>
        <div class="combo-options" id="${idComboDesc}-options">
          <div class="combo-option" style="color:var(--text-muted)">Seleccione una marca primero</div>
        </div>
      </div>
      <input type="hidden" class="ref-desc-hidden ref-desc" id="${idComboDesc}" />
    </div>

    <!-- CLAVE INPUT (BÚSQUEDA Y EDICIÓN DIRECTA) -->
    <div style="position:relative; width:100%;" class="group-ref-clave">
      <input 
        type="text" 
        placeholder="Clave" 
        class="ref-clave kit-row-codigo" 
        value="${piezaData.codigo || ''}" 
        oninput="window.alEscribirClaveKit(this, '${idDropdownClave}')" 
        onfocus="window.alEscribirClaveKit(this, '${idDropdownClave}')" 
        autocomplete="off" 
        style="width:100%; text-align:center; padding: 0.45rem 0.3rem; font-size:0.8rem; font-family:monospace; font-weight:700; color:#2563eb; background:var(--bg-body); border:1px solid var(--border); border-radius:6px; box-sizing:border-box;" 
        title="Escribe la clave para buscar refacción" 
      />
      <div 
        id="${idDropdownClave}" 
        class="kit-clave-dropdown" 
        style="display:none;"
        onclick="event.stopPropagation()"
      ></div>
    </div>

    <input type="hidden" class="ref-sistema kit-row-sistema" value="${piezaData.sistema || ''}" />

    <!-- CANTIDAD -->
    <div style="width:100%; text-align:center;">
      <input type="number" placeholder="Cant." class="ref-cant kit-row-cant" style="width:100%; text-align:center; padding: 0.45rem 0.2rem; font-size:0.85rem; font-weight:700; border:1px solid var(--border); border-radius:6px; background:var(--bg-body); color:var(--text-primary); box-sizing:border-box;" min="1" max="99" value="${piezaData.cantidad || 1}"/>
    </div>

    <!-- BOTÓN ELIMINAR -->
    <div style="text-align:center;">
      <button type="button" class="btn-del-ref" onclick="event.stopPropagation(); this.closest('.ref-row').remove();" title="Eliminar fila" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem; padding:0; display:inline-flex; align-items:center; justify-content:center;">✕</button>
    </div>
  `;

  row.innerHTML = html;
  list.appendChild(row);

  if (window.lucide) window.lucide.createIcons({ root: row });

  // Attach Event Listeners dynamically
  const comboMarca = document.getElementById(`${idComboMarca}-combo`);
  if (comboMarca) {
    comboMarca.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleCombo(idComboMarca);
    });
  }

  const comboDesc = document.getElementById(`${idComboDesc}-combo`);
  if (comboDesc) {
    comboDesc.addEventListener('click', (e) => {
      e.stopPropagation();
      window.toggleCombo(idComboDesc);
    });
  }

  // Prevent menu clicks from bubbling
  const menuMarca = document.getElementById(`${idComboMarca}-menu`);
  if (menuMarca) menuMarca.addEventListener('click', e => e.stopPropagation());

  const menuDesc = document.getElementById(`${idComboDesc}-menu`);
  if (menuDesc) menuDesc.addEventListener('click', e => e.stopPropagation());

  // Popular marcas
  window.popularSelectMarcas(idComboMarca, idComboDesc);

  // Determinar marca inicial (de piezaData o de cabecera del machote)
  let initialMarca = piezaData.marca || '';
  if (!initialMarca) {
    const headerMarca = document.getElementById('kit-form-marca')?.value.trim();
    if (headerMarca) initialMarca = headerMarca;
  }

  const MARCAS_RENDER = {'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING','CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE','OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER','RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL','SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER','KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA','EBS':'EBOSS','RCR':'RUBBLE CRUSHER'};

  if (initialMarca) {
    const hiddenMarca = row.querySelector('.ref-marca');
    const comboSpanMarca = document.getElementById(`${idComboMarca}-display`);

    let brandCode = initialMarca;
    if (typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb)) {
      const match = refaccionesDb.find(r => r.marca && r.marca.toLowerCase() === initialMarca.toLowerCase());
      if (match) {
        brandCode = match.marca;
      } else {
        for (const [k, v] of Object.entries(MARCAS_RENDER)) {
          if (v.toLowerCase() === initialMarca.toLowerCase() || initialMarca.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(initialMarca.toLowerCase())) {
            brandCode = k;
            break;
          }
        }
      }
    }

    if (hiddenMarca) hiddenMarca.value = brandCode;
    if (comboSpanMarca) comboSpanMarca.textContent = MARCAS_RENDER[brandCode.toUpperCase()] || brandCode;

    window.actualizarDescripcionesCombo(idComboMarca, idComboDesc);
  }

  const descVal = piezaData.descripcion || piezaData.nombre || '';
  if (descVal) {
    const hiddenDesc = row.querySelector('.ref-desc-hidden');
    const comboSpanDesc = document.getElementById(`${idComboDesc}-display`);
    if (hiddenDesc) hiddenDesc.value = descVal;
    if (comboSpanDesc) comboSpanDesc.textContent = descVal;

    const comboOptions = document.getElementById(`${idComboDesc}-options`);
    if (comboOptions) {
      let optExists = false;
      comboOptions.querySelectorAll('.combo-option').forEach(opt => {
        if ((opt.dataset.desc || opt.textContent || '').includes(descVal)) optExists = true;
      });
      if (!optExists) {
        const legacyHtml = `<div class="combo-option" data-desc="${descVal}" data-clave="${piezaData.codigo || ''}" onclick="window.seleccionarDescRefaccion(this, '${idComboDesc}', '${piezaData.codigo || ''}', 0)">${descVal} ${piezaData.codigo ? `[${piezaData.codigo}]` : ''}</div>`;
        if (comboOptions.innerHTML.includes('Seleccione una marca')) {
          comboOptions.innerHTML = legacyHtml;
        } else {
          comboOptions.innerHTML += legacyHtml;
        }
      }
    }
  }

  if (piezaData.codigo) {
    const inputClave = row.querySelector('.ref-clave');
    if (inputClave) inputClave.value = piezaData.codigo;
  }

  const inputSist = row.querySelector('.ref-sistema');
  if (inputSist) {
    if (piezaData.sistema) {
      inputSist.value = piezaData.sistema;
    } else if (descVal && typeof window.detectarSistemaRefaccion === 'function') {
      inputSist.value = window.detectarSistemaRefaccion(descVal);
    }
  }
};

window.guardarKitServicio = function() {
  const inId = document.getElementById('kit-form-id');
  const inNombre = document.getElementById('kit-form-nombre');
  const inModelo = document.getElementById('kit-form-modelo');
  const inMarca = document.getElementById('kit-form-marca');
  const inIntervalo = document.getElementById('kit-form-intervalo');
  const inDesc = document.getElementById('kit-form-descripcion');

  const nombre = inNombre?.value.trim();
  const modelo = inModelo?.value.trim();
  const marca = inMarca?.value.trim() || 'UNIVERSAL';
  const intervalo = inIntervalo?.value.trim() || '250';
  const descripcion = inDesc?.value.trim() || '';

  if (!modelo) {
    mostrarNotificacion('El modelo de maquinaria compatible es obligatorio.', 'error');
    return;
  }
  if (!nombre) {
    mostrarNotificacion('El nombre del machote es obligatorio.', 'error');
    return;
  }

  // Recopilar piezas desde las filas de refacciones
  const rows = document.querySelectorAll('#ref-kit-list .ref-row');
  const piezas = [];
  rows.forEach(row => {
    const rowMarca = row.querySelector('.ref-marca')?.value.trim() || marca;
    const desc = row.querySelector('.ref-desc-hidden')?.value.trim() || row.querySelector('.ref-desc')?.value.trim() || '';
    let cod = row.querySelector('.ref-clave')?.value.trim() || '';
    let sist = row.querySelector('.ref-sistema')?.value || '';
    const cant = parseInt(row.querySelector('.ref-cant')?.value, 10) || 1;

    if (desc) {
      if (!cod || cod === 'S/C') {
        if (typeof refaccionesDb !== 'undefined' && Array.isArray(refaccionesDb)) {
          const match = refaccionesDb.find(r => (r.descripcion || '').toLowerCase() === desc.toLowerCase());
          if (match && (match.codigo || match.id)) {
            cod = match.codigo || match.id;
          }
        }
      }
      if (!cod) cod = 'S/C';

      if (!sist && typeof window.detectarSistemaRefaccion === 'function') {
        sist = window.detectarSistemaRefaccion(desc);
      }
      if (!sist) sist = 'General';

      piezas.push({
        codigo: cod,
        descripcion: desc,
        sistema: sist,
        cantidad: cant,
        marca: rowMarca
      });
    }
  });

  if (piezas.length === 0) {
    mostrarNotificacion('Debes agregar al menos una refacción al machote.', 'error');
    return;
  }

  const kits = window.loadKitsServicio();
  const kitId = inId?.value.trim() || `kit-custom-${Date.now()}`;

  const nuevoKit = {
    id: kitId,
    nombre: nombre,
    modelo: modelo,
    marca: marca,
    intervalo: intervalo,
    descripcion: descripcion,
    esOficial: false,
    piezas: piezas
  };

  const existIdx = kits.findIndex(k => k.id === kitId);
  if (existIdx >= 0) {
    kits[existIdx] = nuevoKit;
    mostrarNotificacion(`Machote "${nombre}" actualizado correctamente.`, 'success');
  } else {
    kits.unshift(nuevoKit);
    mostrarNotificacion(`Machote "${nombre}" creado exitosamente.`, 'success');
  }

  window.saveKitsServicio(kits);
  window.cerrarModalFormularioKit();
  window.filtrarKitsServicio();
};

window.eliminarKitServicio = async function(kitId) {
  const kits = window.loadKitsServicio();
  const kit = kits.find(k => k.id === kitId);
  if (!kit) return;

  const confirmed = await window.confirmarAccion({
    titulo: 'Eliminar Kit de Servicio',
    mensaje: `¿Estás seguro de que deseas eliminar el kit "${kit.nombre}"?`,
    textoAceptar: 'Eliminar',
    textoCancelar: 'Cancelar',
    esPeligroso: true
  });
  if (!confirmed) return;

  const filtrados = kits.filter(k => k.id !== kitId);
  window.saveKitsServicio(filtrados);
  mostrarNotificacion(`Kit "${kit.nombre}" eliminado.`, 'success');
  window.filtrarKitsServicio();
};

window.duplicarKitServicio = function(kitId) {
  const kits = window.loadKitsServicio();
  const kit = kits.find(k => k.id === kitId);
  if (!kit) return;

  const clon = JSON.parse(JSON.stringify(kit));
  clon.id = `kit-custom-${Date.now()}`;
  clon.nombre = `${kit.nombre} (Copia)`;
  clon.esOficial = false;

  kits.unshift(clon);
  window.saveKitsServicio(kits);
  mostrarNotificacion(`Kit duplicado como "${clon.nombre}".`, 'success');
  window.filtrarKitsServicio();
};
// Asegurar disponibilidad global del catálogo de kits precargados
if (typeof window !== 'undefined') {
  window.KITS_PRECARGADOS_DEFAULT = KITS_PRECARGADOS_DEFAULT;
}
