/**
 * Eurorep SAPI - Definiciones de Tipos y Modelos de Negocio (JSDoc)
 * Archivo: src/types/models.js
 *
 * Proporciona validación estática, intellisense y autocompletado en el IDE.
 */

/**
 * @typedef {Object} RefaccionSeleccionada
 * @property {string} [codigo] - Clave o código de la refacción (SAP)
 * @property {string} [clave] - Clave alternativa
 * @property {string} [marca] - Marca de la refacción
 * @property {string} descripcion - Descripción técnica
 * @property {number} cantidad - Cantidad solicitada
 * @property {string} [estatusPedido] - Estatus ('Por Pedir' | 'En Tránsito / Pedido' | 'Entregado al Técnico')
 */

/**
 * @typedef {Object} Ticket
 * @property {string} id - UUID del ticket
 * @property {string} folio - Folio legible (ej. TKT-26477, TKT-OS-100-A)
 * @property {string} [ordenId] - ID de orden asociada si es ticket hijo
 * @property {string} [ordenFolio] - Folio de la orden asociada
 * @property {string} fecha - Fecha ISO de registro
 * @property {string} [fechaCreacion] - Fecha ISO de creación
 * @property {string|null} [fechaCierre] - Fecha ISO de cierre
 * @property {string} cliente - Nombre o ID del cliente
 * @property {string} [sitio] - Nombre del sitio de obra
 * @property {string} [asunto] - Asunto o descripción breve
 * @property {string} [descripcion] - Detalle del requerimiento
 * @property {string} [categoria] - 'Servicio Técnico' | 'Refacción' | 'Garantía' | 'Preventivo'
 * @property {string} [prioridad] - 'Baja' | 'Media' | 'Alta' | 'Crítica'
 * @property {string} estado - 'Abierto' | 'En Proceso' | 'Refacciones' | 'Cotización' | 'Cerrado'
 * @property {string} [equipo] - Cadena descriptiva de la maquinaria
 * @property {RefaccionSeleccionada[]} [refaccionesSeleccionadas] - Lista de refacciones pedidas
 * @property {string} [creadoPor] - Nombre del usuario creador
 * @property {string} [asignado] - Nombre del técnico o responsable
 * @property {boolean} [esPrueba] - Indicador de registro de pruebas/sandbox
 */

/**
 * @typedef {Object} OrdenServicio
 * @property {string} id - UUID de la orden
 * @property {string} folio - Folio legible (ej. OS-001)
 * @property {string} [soporte] - ID del ticket padre asociado
 * @property {string} cliente - Nombre o ID del cliente
 * @property {string} [ubicacion] - Ubicación o sitio de obra
 * @property {string} [tecnico] - Nombre del técnico responsable
 * @property {string} [supervisor] - Nombre del supervisor
 * @property {string} estado - 'Abierta' | 'En Proceso' | 'Terminada' | 'Cerrada' | 'Firmada'
 * @property {string} [marca] - Marca de la maquinaria
 * @property {string} [modelo] - Modelo de la máquina
 * @property {string} [serie] - Número de serie
 * @property {string} [eco] - Número económico
 * @property {number} [horasTotales] - Total de horas trabajadas
 * @property {number} [kmTotal] - Kilómetros recorridos
 * @property {Array} [dias] - Paneles diarios de avance
 * @property {Array} [evidencias] - Fotos y archivos adjuntos
 * @property {string} [firmaCliente] - Data URI firma del cliente
 * @property {string} [firmaTecnico] - Data URI firma del técnico
 * @property {boolean} [esPrueba] - Indicador de registro de pruebas/sandbox
 */

/**
 * @typedef {Object} Maquinaria
 * @property {string} id - UUID de la máquina
 * @property {string} idInterno - Identificador corto interno (ej. PTZ-001)
 * @property {string} marca - Marca (PUTZMEISTER, SCHWING, etc.)
 * @property {string} modelo - Modelo del equipo
 * @property {string} serie - Número de serie oficial
 * @property {string} [ubicacion] - Ubicación actual o sitio de obra
 * @property {string|null} [sitio_id] - UUID del sitio asociado
 * @property {string} [tipo] - Tipo de equipo (Bomba, Oruga, etc.)
 * @property {number} [horometro] - Horas acumuladas de operación
 * @property {Object} [customData] - Datos adicionales y ficha técnica
 */

/**
 * @typedef {Object} Cliente
 * @property {string} id - UUID del cliente
 * @property {string} nombre - Razón social o nombre comercial
 * @property {string} [rfc] - Registro Federal de Contribuyentes
 * @property {string} [contacto] - Nombre del contacto principal
 * @property {string} [telefono] - Teléfono de contacto
 * @property {string} [email] - Correo electrónico
 * @property {string} [direccion] - Dirección fiscal o principal
 * @property {string} [estatus] - 'Activo' | 'Inactivo'
 * @property {Maquinaria[]} [maquinas] - Flota de maquinaria del cliente
 * @property {Array} [sitios] - Sitios de obra vinculados
 */

/**
 * @typedef {Object} Gasto
 * @property {string} id - UUID del gasto
 * @property {string} fecha - Fecha del gasto (YYYY-MM-DD)
 * @property {number} monto - Monto numérico total
 * @property {string} [moneda] - 'MXN' | 'USD' | 'EUR'
 * @property {string} concepto - Descripción del gasto
 * @property {string} [categoria] - 'Combustible' | 'Hospedaje' | 'Alimentos' | 'Casetas' | 'Vuelos'
 * @property {string} [usuario] - Técnico o colaborador que reporta
 * @property {string} [tarjeta] - Identificador de tarjeta corporativa Clara
 * @property {string} [estatus] - 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Conciliado'
 * @property {string} [comprobanteUrl] - URL o Data URI del comprobante fiscal
 * @property {boolean} [esPrueba] - Indicador de sandbox
 */

export const TiposModelos = {
  version: '1.0.0'
};
