const axios = require('axios');
const fs = require('fs');

async function check() {
  try {
    const res = await axios.get('http://localhost:3000/api/tecnicos');
    console.log("Total: ", res.data.length);
    const bad = res.data.filter(t => t.TipoUsuario && t.TipoUsuario.includes('N/A'));
    console.log("Bad technicians (containing N/A): ", bad);
    
    const all = res.data.map(t => t.TipoUsuario);
    console.log("All TipoUsuario values: ", [...new Set(all)]);
  } catch (e) {
    console.error(e.message);
  }
}
check();
