const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('./index.html', 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

const btn = document.getElementById('nav-preferencias');
if (!btn) { console.log('no nav-preferencias'); process.exit(0); }

console.log('view: ', btn.dataset.view);
const panel = document.getElementById('view-' + btn.dataset.view);
if (!panel) { console.log('no panel'); process.exit(0); }

console.log('Panel innerHTML length: ', panel.innerHTML.length);
console.log('Panel textContent: ', panel.textContent.trim().replace(/\n+/g, ' '));
