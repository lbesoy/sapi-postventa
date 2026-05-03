console.log('HELLO WORLD');
const http = require('http');
http.createServer((req, res) => res.end('OK')).listen(3000, () => console.log('LISTENING 3000'));
