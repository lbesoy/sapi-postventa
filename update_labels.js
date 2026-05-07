const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<label>(.*?)<\/label>\s*<input type="text" id="(map-[a-z]+-[a-z]+)"/g;

html = html.replace(regex, (match, labelText, inputId) => {
  const lblId = inputId.replace('map-', 'lbl-');
  // Strip " (Ej. ...)" from label if present
  let cleanLabel = labelText.replace(/\s*\(Ej\..*?\)/, '');
  return `<input type="text" id="${lblId}" class="map-label-edit" value="${cleanLabel}" style="font-size:0.85rem; font-weight:600; color:var(--text-muted); background:transparent; border:none; border-bottom:1px dashed var(--border); margin-bottom:0.25rem; width:100%; outline:none;" title="Clic para editar el nombre de la columna en la tabla"/>
            <input type="text" id="${inputId}"`;
});

fs.writeFileSync('index.html', html);
console.log('Done!');
