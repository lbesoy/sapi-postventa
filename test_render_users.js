const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
  getItem: (key) => null,
  setItem: (key, value) => {}
};
global.crypto = { randomUUID: () => 'uuid' };
global.fetch = async () => ({ json: async () => ({}) });
global.lucide = { createIcons: () => {} };

// Mock Supabase Client returning the 21 real users
const realUsers = [
  {"id":"superadmin","nombre":"Super Admin","email":"superadmin@temp.com","pin":"0000","rol":"superadmin","activo":true,"empresa":null},
  {"id":"bdd8419a-5324-43ee-bc4f-405167148d53","nombre":"Arturo Caloca","email":"arturocaloca@eurorep.mx","pin":"0000","rol":"consulta","activo":true,"empresa":null},
  {"id":"965d87d1-0064-4330-840a-5439765eca79","nombre":"Mauricio Andrade","email":"mauricioandrade@tecnico.eurorep.com","pin":"0000","rol":"consulta","activo":true,"empresa":null},
  {"id":"f651994c-a614-47df-9eb4-ccf700431d71","nombre":"Adrian Franco Cruz","email":"adrianfrancocruz@eurorep.mx","pin":"0000","rol":"consulta","activo":true,"empresa":null},
  {"id":"afe93e97-981f-4657-8afc-e1716aebfe62","nombre":"Abraham Reyes Zarate","email":"abrahamreyeszarate@eurorep.mx","pin":"0000","rol":"tecnico","activo":true,"empresa":null},
  {"id":"24faccc4-f456-487f-bad9-ed14432cc5d2","nombre":"Daniel Ramírez Mendoza","email":"danielramírezmendoza@eurorep.mx","pin":"0000","rol":"consulta","activo":true,"empresa":null},
  {"id":"8ab9b3de-a70e-4194-86e7-69b3740f3bfa","nombre":"Francisco Hernandez Patiño","email":"franciscohernandezpatiño@eurorep.mx","pin":"0000","rol":"tecnico","activo":true,"empresa":null},
  {"id":"0af14c8b-740e-4055-bb49-8a7c6f1b888f","nombre":"Hugo Ernesto Luciano Lopez","email":"hugoernestolucianolopez@eurorep.mx","pin":"0000","rol":"tecnico","activo":true,"empresa":null},
  {"id":"a07cd66b-92de-4ddd-b600-a0766369a7fa","nombre":"Ignacio Silvestre Alba","email":"ignaciosilvestrealba@eurorep.mx","pin":"0000","rol":"tecnico","activo":true,"empresa":null},
  {"id":"ddf124ce-83b4-43d5-af1f-2af06de954fc","nombre":"Jose Antonio Miranda","email":"joseantoniomiranda@eurorep.mx","pin":"0000","rol":"tecnico","activo":true,"empresa":null},
  {"id":"b623b781-021e-4e0f-827e-fe9dab17d125","nombre":"Jesus Garduño Gomez","email":"jesusgarduñogomez@eurorep.mx","pin":"0000","rol":"tecnico","activo":true,"empresa":null},
  {"id":"3c72f454-e6d2-436d-a799-fc74b05ecd31","nombre":"Luis Gres Garcia","email":"luisgresgarcia@eurorep.mx","pin":"0000","rol":"supervisor","activo":true,"empresa":null},
  {"id":"b890706c-5168-4bd7-aaa4-c5f8ad2a4322","nombre":"Laura Paz Norberto Sanchez","email":"laurapaznorbertosanchez@eurorep.mx","pin":"0000","rol":"supervisor","activo":true,"empresa":null},
  {"id":"77f9ac94-71e6-43ca-aa04-a4e931426a5a","nombre":"Rodrigo Alonso Narvaez","email":"rodrigoalonsonarvaez@eurorep.mx","pin":"0000","rol":"supervisor","activo":true,"empresa":null},
  {"id":"147d92e9-bb86-4ba5-96b8-8d09c5418c67","nombre":"Roberto Martinez De Jesus","email":"robertomartinezdejesus@eurorep.mx","pin":"0000","rol":"tecnico","activo":true,"empresa":null},
  {"id":"055b3bd2-239e-4e7c-8687-e9fd3137e992","nombre":"Sonia Gutierrez Paniagua","email":"soniagutierrezpaniagua@eurorep.mx","pin":"0000","rol":"consulta","activo":true,"empresa":null},
  {"id":"51c4cada-bde0-4111-b3e4-1aac28feab56","nombre":"Sergio Soria Cervantes","email":"sergiosoriacervantes@eurorep.mx","pin":"0000","rol":"tecnico","activo":true,"empresa":null},
  {"id":"04faac34-509c-4153-b5c1-31b7ef490ebe","nombre":"Victor Santelis Flores","email":"victorsantelisflores@eurorep.mx","pin":"0000","rol":"consulta","activo":true,"empresa":null},
  {"id":"c2ea325a-cbce-46ad-b965-5f24b79447fa","nombre":"Lizeth Rodriguez","email":"admon@eurorep.mx","pin":"0000","rol":"consulta","activo":false,"empresa":null},
  {"id":"0af24151-36dc-40ae-b14e-48ba5cbd5ac9","nombre":"Arturo Caloca","email":"arturo@eurorep.mx","pin":"0000","rol":"consulta","activo":false,"empresa":null},
  {"id":"83d733e6-7e20-448b-b78a-972997a74ed4","nombre":"MAURICIO ANDRADE","email":"mauricio@eurorep.mx","pin":"0000","rol":"consulta","activo":false,"empresa":null}
];

global.window.supabaseClient = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  },
  channel: () => {
    const mockChannel = {
      on: () => mockChannel,
      subscribe: () => {}
    };
    return mockChannel;
  },
  from: (table) => {
    return {
      select: (columns) => {
        return {
          then: (resolve) => {
            resolve({ data: realUsers, error: null });
          }
        };
      }
    };
  }
};

const syncCode = fs.readFileSync('supabaseSync.js', 'utf8');
const code = fs.readFileSync('app.js', 'utf8');

try {
  eval(syncCode);
  eval(code);

  console.log('Running renderUsuariosList()...');
  // We need to execute the async renderUsuariosList
  const promise = renderUsuariosList();
  
  setTimeout(() => {
    const listEl = document.getElementById('usuarios-list');
    console.log('List HTML length:', listEl.innerHTML.length);
    console.log('List HTML content sample:', listEl.innerHTML.substring(0, 500));
    
    // Check count of user rows in HTML
    const rows = listEl.querySelectorAll('.usuario-row-full');
    console.log('Rendered rows count:', rows.length);
    process.exit(0);
  }, 1500);

} catch(e) {
  console.error('CRASH DURING EVAL/RENDER:', e);
}
