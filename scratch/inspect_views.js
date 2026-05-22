const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

console.log('--- NAV ITEMS ---');
const navItems = doc.querySelectorAll('.nav-item');
navItems.forEach(item => {
  const view = item.getAttribute('data-view');
  const targetId = 'view-' + view;
  const targetEl = doc.getElementById(targetId);
  console.log(`Nav item data-view="${view}" -> Target element #${targetId}: ${targetEl ? 'FOUND' : 'NOT FOUND!'}`);
});

console.log('\n--- ALL ELEMENTS WITH ID STARTING WITH view- ---');
const viewEls = doc.querySelectorAll('[id^="view-"]');
viewEls.forEach(el => {
  console.log(`Element #${el.id}`);
});
process.exit(0);
