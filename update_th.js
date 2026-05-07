const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const thMap = {
  // Ordenes
  "Folio": "th-ord-id",
  "Cliente": "th-ord-cliente",
  "Ubicación": "th-ord-ubicacion",
  "Modelo": "th-ord-modelo",
  "Técnico": "th-ord-tecnico",
  "Tipo": "th-ord-tipo",
  "Estado": "th-ord-estado",
  "Fecha": "th-ord-fecha",
  // Clientes
  "ID SAP": "th-cli-id",
  "Empresa": "th-cli-nombre",
  "RFC": "th-cli-rfc",
  "Contacto": "th-cli-contacto",
  "Correo": "th-cli-email",
  "Teléfono": "th-cli-telefono",
  "Grupo SAP": "th-cli-grupoSinergia",
  "Saldo SAP": "th-cli-saldoCuenta",
  "Órdenes Abiertas": "th-cli-saldoOrdenes",
  // Maquinaria
  "ID Interno": "th-maq-id",
  "Marca": "th-maq-marca",
  "Serie": "th-maq-serie",
  "Año": "th-maq-anio",
  "Cliente / Ubicación": "th-maq-cliente",
  // Refacciones
  "ItemCode": "th-ref-id",
  "Descripción": "th-ref-nombre",
  "Grupo de Artículo": "th-ref-grupo",
  "Precio": "th-ref-precio",
  "Stock": "th-ref-stock",
  // Sitios
  "Nombre del Sitio": "th-sit-nombre",
  "Código Postal": "th-sit-cp",
  "Ciudad / Estado": "th-sit-ciudad",
  // Tecnicos
  "Nombre del Técnico": "th-tec-nombre",
  "Total Servicios": "th-tec-total",
  "Completados": "th-tec-completados",
  "Siguiente Ticket": "th-tec-siguiente",
  "Último Resuelto": "th-tec-ultimo"
};

for (const [text, id] of Object.entries(thMap)) {
  // Regex to match <th ...>Text <i...></i></th> or <th...>Text</th>
  const regex = new RegExp(`(<th[^>]*>)\\s*${text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*(<i[^>]*><\\/i>)?\\s*<\\/th>`, 'g');
  html = html.replace(regex, (match, p1, p2) => {
    // Inject id if not present
    if (!p1.includes('id=')) {
      p1 = p1.replace('<th', `<th id="${id}"`);
    }
    return `${p1}${text} ${p2 || ''}</th>`;
  });
}

fs.writeFileSync('index.html', html);
console.log('Done TH!');
