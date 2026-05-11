const fetch = require('node-fetch'); // Let's see if we can use native fetch or node-fetch
fetch('https://eurorep-api.onrender.com/api/clientes?queryCode=eurorep_clientes')
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data.slice(0, 2), null, 2)))
  .catch(console.error);
