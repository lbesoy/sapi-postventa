const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://mupevytlssqcbhlmzmcp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cGV2eXRsc3NxY2JobG16bWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjE0MzUsImV4cCI6MjA5MzMzNzQzNX0.sdAI9nJluJCP6skq0lfdj8CQvFEyqqV4z6ntbqvQdPY';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    let all = [];
    for(let page=0; page<5; page++){
        const { data } = await sb.from('refacciones').select('id, custom_data').range(page*1000, (page+1)*1000-1);
        if(!data || data.length===0) break;
        all = all.concat(data);
    }
    console.log("Total in Supabase:", all.length);
    const valid = all.filter(x => x.custom_data && x.custom_data.marca && x.custom_data.marca !== 'N/A');
    console.log("Valid marcas in Supabase:", valid.length);
}
test();
