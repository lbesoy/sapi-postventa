const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The block to extract
const startMarker = '<!-- Mapeo Refacciones -->';
const startIdx = html.indexOf(startMarker);

// Find the end of this block. It ends right before:
// <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:2rem;">
const endMarker = '<div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:2rem;">';
const endIdx = html.indexOf(endMarker, startIdx);

const block = html.slice(startIdx, endIdx);
html = html.substring(0, startIdx) + html.substring(endIdx);

// Now find where it SHOULD go: right after <div id="custom-columns-tecnicos" ...></div></div>
// Let's just find `mapeo-content-tecnicos` and insert after its closing div
const targetMarker = '<div id="custom-columns-tecnicos" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>\n      </div>';
const targetIdx = html.indexOf(targetMarker);
if(targetIdx !== -1) {
  const insertPos = targetIdx + targetMarker.length;
  html = html.substring(0, insertPos) + '\n\n      ' + block + html.substring(insertPos);
}

fs.writeFileSync('index.html', html);
console.log('Fixed HTML layout');
