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
 * @typedef {Object} CotizacionItem
 * @property {string} [id] - ID único del item
 * @property {'servicio'|'refaccion'|'viaticos'} [tipo] - Tipo de concepto
 * @property {string} [codigo] - Clave SAP (ZFAC02, ZFAC10, etc.)
 * @property {'CON'|'TRI'|'CIM'} [unidad] - Unidad de negocio
 * @property {string} descripcion - Descripción o alcance
 * @property {string} [marca] - Marca
 * @property {number} cantidad - Cantidad cotizada
 * @property {number} precioUnitario - Precio unitario de lista
 * @property {number} [descuento] - Porcentaje de descuento (0 a 100)
 * @property {number} [precioNeto] - Precio unitario con descuento aplicado
 * @property {number} [subtotalLista] - Subtotal a precio de lista
 * @property {number} [descuentoMonto] - Monto total descontado
 * @property {number} [subtotal] - Subtotal neto
 * @property {number} [costoUnitario] - Costo unitario para Eurorep
 * @property {number} [totalCosto] - Costo total acumulado
 */

/**
 * @typedef {Object} CotizacionInterna
 * @property {'CON'|'TRI'|'CIM'} linea - Línea de negocio
 * @property {string} tipoCliente - Clasificación comercial del cliente
 * @property {Object} [asistente] - Parámetros del asistente de viáticos y mano de obra
 * @property {CotizacionItem[]} items - Lista de partidas cotizadas
 * @property {boolean} incluirIva - Si aplica IVA o exento
 * @property {number} tasaIva - Tasa de IVA (0.16)
 * @property {number} subtotalLista - Subtotal a precio de lista
 * @property {number} descuentoTotal - Total acumulado de descuentos
 * @property {number} subtotal - Subtotal neto sin IVA
 * @property {number} iva - Importe de IVA calculado
 * @property {number} total - Importe total con IVA
 * @property {string} moneda - 'MXN' | 'USD'
 * @property {number} [totalCosto] - Costo total estimado
 * @property {number} [margenEstimado] - Margen bruto estimado
 * @property {number} [margenPct] - Porcentaje de margen
 * @property {number} [claraCombustible] - Viáticos Clara combustible
 * @property {number} [claraCasetas] - Viáticos Clara casetas
 * @property {number} [claraHospedaje] - Viáticos Clara hospedaje
 * @property {number} [claraAlimentos] - Viáticos Clara alimentos
 * @property {number} [claraTotal] - Total solicitado para tarjeta Clara
 * @property {string} [fechaActualizacion] - Timestamp ISO de última edición
 * @property {string} [modificadoPor] - Usuario editor
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
 * @property {CotizacionInterna} [cotizacionInterna] - Objeto estructurado de cotización interna
 * @property {number} [montoCotizacion] - Monto numérico total cotizado (MXN)
 * @property {string} [cotizacionSAP] - Folio de cotización en SAP Business One
 * @property {string} [pedidoSAP] - Folio de orden de venta/pedido en SAP
 * @property {string} [cotLinea] - Línea ('CON' | 'TRI' | 'CIM')
 * @property {string} [cotTipoCliente] - Tipo de cliente aplicado en cotización
 * @property {number} [cotSubtotal] - Subtotal de cotización
 * @property {number} [cotIva] - IVA de cotización
 * @property {number} [cotTotal] - Total de cotización
 * @property {number} [claraTotal] - Presupuesto total Clara
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
