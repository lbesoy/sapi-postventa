console.log("Starting JSDOM...");
const { JSDOM } = require('jsdom');
const fs = require('fs');
console.log("Reading index.html...");
const html = fs.readFileSync('index.html', 'utf8');
console.log("Creating JSDOM instance...");
const dom = new JSDOM(html, { url: 'http://localhost' });
console.log("JSDOM instance created successfully!");
process.exit(0);
