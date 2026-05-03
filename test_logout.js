const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('/Users/pablobesoytrigueros/Desktop/Eurorep/index.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });
dom.window.eval(fs.readFileSync('/Users/pablobesoytrigueros/Desktop/Eurorep/app.js', 'utf-8'));
const btn = dom.window.document.querySelector('.logout-btn');
console.log('Button found:', !!btn);
try {
  dom.window.confirm = () => true;
  btn.click();
  console.log('Login screen class:', dom.window.document.getElementById('login-screen').className);
} catch (e) {
  console.error(e);
}
