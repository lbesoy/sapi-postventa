const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const cli = JSON.parse(fs.readFileSync('cli_all.json', 'utf8') || '{}'); 
// wait, I don't know the supabase URL and KEY here. Let's extract from supabaseClient.js
