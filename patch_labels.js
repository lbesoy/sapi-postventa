const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// We need to patch `abrirModalMapeo` to load labels
const loadPattern = `// Cargar Refacciones
  if(mappings.refacciones) {
    document.getElementById('map-ref-id').value = mappings.refacciones.id || 'ItemCode';
    document.getElementById('map-ref-nombre').value = mappings.refacciones.nombre || 'ItemName';
    document.getElementById('map-ref-grupo').value = mappings.refacciones.grupo || 'ItmsGrpNam';
    document.getElementById('map-ref-precio').value = mappings.refacciones.precio || 'Price';
    document.getElementById('map-ref-stock').value = mappings.refacciones.stock || 'OnHand';
  }`;

const loadInject = `
  // Cargar Labels (Si existen)
  const modules = ['clientes', 'maquinaria', 'sitios', 'ordenes', 'tecnicos', 'refacciones'];
  modules.forEach(mod => {
    if (mappings[mod] && mappings[mod].labels) {
      for (const [key, val] of Object.entries(mappings[mod].labels)) {
        const lblInput = document.getElementById('lbl-' + mod + '-' + key);
        if (lblInput) lblInput.value = val;
      }
    }
  });
`;
code = code.replace(loadPattern, loadPattern + '\n' + loadInject);

// We need to patch `guardarMapeoColumnas` to save labels
// We will replace `customCols: getCustomColumnsForModule('clientes')` with `customCols: getCustomColumnsForModule('clientes'), labels: getLabelsForModule('clientes')`
code = code.replace(/customCols: getCustomColumnsForModule\('([a-z]+)'\)/g, "customCols: getCustomColumnsForModule('$1'), labels: getLabelsForModule('$1')");

// Add getLabelsForModule function
const funcInject = `
function getLabelsForModule(mod) {
  const labels = {};
  document.querySelectorAll('input[id^="lbl-' + mod + '-"]').forEach(el => {
    const key = el.id.replace('lbl-' + mod + '-', '');
    labels[key] = el.value.trim();
  });
  return labels;
}

function applyTableHeaders() {
  const mappings = configData.mappings;
  if (!mappings) return;
  
  const modules = ['clientes', 'maquinaria', 'sitios', 'ordenes', 'tecnicos', 'refacciones'];
  modules.forEach(mod => {
    if (mappings[mod] && mappings[mod].labels) {
      for (const [key, val] of Object.entries(mappings[mod].labels)) {
        const th = document.getElementById('th-' + mod + '-' + key);
        if (th && val) {
          // Keep the sort icon if it exists
          const icon = th.querySelector('i');
          th.textContent = val + ' ';
          if (icon) th.appendChild(icon);
        }
      }
    }
  });
}
`;

code = code.replace('function cerrarModalMapeo() {', funcInject + '\nfunction cerrarModalMapeo() {');

// Call applyTableHeaders in cargarConfig
code = code.replace(/renderTecnicosConfig\(\);\n  \}\n\}/g, "renderTecnicosConfig();\n  }\n  applyTableHeaders();\n}");

fs.writeFileSync('app.js', code);
console.log('Patch done!');
