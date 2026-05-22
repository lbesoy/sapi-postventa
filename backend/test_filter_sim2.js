const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    let allRefacciones = [];
    for(let page=0; page<5; page++){
        const { data } = await sb.from('refacciones').select('*').range(page*1000, (page+1)*1000-1);
        if(!data || data.length===0) break;
        allRefacciones = allRefacciones.concat(data);
    }
    
    console.log("Total from Supabase:", allRefacciones.length);
    
    const MARCAS_RENDER = {
        'ETP':'ESSER TWIN PIPES','BCR':'BCR','PTZ':'PUTZMEISTER','SCH':'SCHWING',
        'CIF':'CIFA','MTM':'MTM','MCN':'MCNELIUS','LON':'LONDON','CAS':'CASAGRANDE',
        'OTM':'OTRAS MARCAS','CNF':'CONFORMS','TFB':'TEUFELBERGER','RBC':'REBEL CRUSHER',
        'RBM':'RUBBLE MASTER','FIO':'FIORI','EVE':'EVERDIGM','POR':'PORTAFILL',
        'SIM':'SIMEM','TUR':'TURBOSOL','MBC':'MB CUCHARAS','DOR':'DORNER',
        'KNK':'KINGKONG','HYU':'HYUNDAI EVERDIGM','HER':'HERRAMIENTA',
        'EBS':'EBOSS','RCR':'RUBBLE CRUSHER'
    };

    let mapped = allRefacciones.map(r => ({
        id: r.id, codigo: r.codigo, descripcion: r.descripcion, precio: r.precio, moneda: r.moneda, stock: r.stock, 
        customData: r.custom_data, marca: r.custom_data?.marca || 'N/A', marcaCodigo: r.custom_data?.marcaCodigo || r.custom_data?.marca || '', 
        grupo: r.custom_data?.grupo || '', origen: r.custom_data?.origen || 'N/A', nombre: r.custom_data?.nombre || r.descripcion,
        ItmsGrpCod: r.custom_data?.ItmsGrpCod || r.custom_data?.grupoCode || null
    }));

    const filtered = mapped.filter(r => {
        const marcaRaw = (r.marca || r.marcaCodigo || '').trim();
        const marcaCode = marcaRaw.toUpperCase();
        const marcaFull = MARCAS_RENDER[marcaCode] || (marcaRaw.length > 4 ? marcaRaw : '');
        if (!marcaFull || marcaFull === 'N/A') return false; 
        return true;
    });

    console.log("Filtered count in frontend logic:", filtered.length);
}
test();
