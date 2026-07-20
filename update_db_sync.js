const fs = require('fs');

let syncJs = fs.readFileSync('supabaseSync.js', 'utf8');

const targetUpload = `                    horas_traslado: b.horas_traslado || null,
                    hora_fin_regreso: b.hora_fin_regreso || null,
                    horas_regreso: b.horas_regreso || null,
                    tipo: b.tipo || 'Servicio'`;
const replacementUpload = `                    horas_traslado: b.horas_traslado || null,
                    programado_horas_traslado: b.programadoHorasTraslado || null,
                    hora_fin_regreso: b.hora_fin_regreso || null,
                    horas_regreso: b.horas_regreso || null,
                    programado_horas_regreso: b.programadoHorasRegreso || null,
                    tipo: b.tipo || 'Servicio'`;
syncJs = syncJs.replace(targetUpload, replacementUpload);

const targetDownload = `              horas_traslado: b.horas_traslado,
              hora_fin_regreso: b.hora_fin_regreso,
              horas_regreso: b.horas_regreso,
              tipo: b.tipo`;
const replacementDownload = `              horas_traslado: b.horas_traslado,
              programadoHorasTraslado: b.programado_horas_traslado,
              hora_fin_regreso: b.hora_fin_regreso,
              horas_regreso: b.horas_regreso,
              programadoHorasRegreso: b.programado_horas_regreso,
              tipo: b.tipo`;
syncJs = syncJs.replace(targetDownload, replacementDownload);

fs.writeFileSync('supabaseSync.js', syncJs);

let schemaSql = fs.readFileSync('supabase/schema.sql', 'utf8');
const targetSchema = `    horas_traslado NUMERIC,
    hora_fin_regreso TEXT, -- Formato 'HH:MM' (traslado regreso)
    horas_regreso NUMERIC,
    tipo TEXT DEFAULT 'Servicio',`;
const replacementSchema = `    horas_traslado NUMERIC,
    programado_horas_traslado NUMERIC,
    hora_fin_regreso TEXT, -- Formato 'HH:MM' (traslado regreso)
    horas_regreso NUMERIC,
    programado_horas_regreso NUMERIC,
    tipo TEXT DEFAULT 'Servicio',`;
schemaSql = schemaSql.replace(targetSchema, replacementSchema);

fs.writeFileSync('supabase/schema.sql', schemaSql);

console.log('Database sync files updated successfully');
