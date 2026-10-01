const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// Replace --danger with --red
appJs = appJs.replace(/var\(--danger\)/g, 'var(--red)');
// Replace --success with --green
appJs = appJs.replace(/var\(--success\)/g, 'var(--green)');

fs.writeFileSync('app.js', appJs);

console.log('Colors fixed in app.js');
