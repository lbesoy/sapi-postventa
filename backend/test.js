const { execSync } = require('child_process');
try {
  const output = execSync('node server.js', { encoding: 'utf-8', timeout: 3000 });
  console.log('OUTPUT:', output);
} catch (e) {
  console.error('ERROR:', e.stderr || e.message);
}
