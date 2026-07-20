const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// 1. Validation in guardarProgramacionTecnico
const validationTarget = `  if (horaInicio && horasTraslado && entrada) {
    const dEntrada = new Date(\`\${fecha}T\${entrada}\`);
    const minLlegada = horaAMinutos(horaInicio) + (parseFloat(horasTraslado) * 60);
    const dLlegada = new Date(\`\${fechaInicioTraslado || fecha}T00:00\`);
    dLlegada.setMinutes(dLlegada.getMinutes() + minLlegada);

    if (dEntrada < dLlegada) {
      alert("No se puede empezar el servicio antes de la llegada estimada del traslado de ida.");
      return;
    }
  }`;
const validationReplacement = validationTarget + `\n
  if (horaFinRegreso && horasRegreso && salida) {
    const dSalida = new Date(\`\${fecha}T\${salida}\`);
    const minLlegadaRegreso = horaAMinutos(horaFinRegreso);
    const dInicioRegreso = new Date(\`\${fechaFinRegresoDate || fecha}T00:00\`);
    dInicioRegreso.setMinutes(dInicioRegreso.getMinutes() + minLlegadaRegreso);
    if (dInicioRegreso < dSalida) {
      alert("No se puede iniciar el traslado de regreso antes de terminar el servicio.");
      return;
    }
  }`;
appJs = appJs.replace(validationTarget, validationReplacement);

// 2. Add programado fields in guardarNotaBitacora
const bitacoraTarget = `      desviacion: desviacionStr || null,
      fecha_inicio_traslado: bObjRef ? bObjRef.fecha_inicio_traslado : null,`;
const bitacoraReplacement = `      desviacion: desviacionStr || null,
      programadoHorasTraslado: bObjRef ? bObjRef.horas_traslado : null,
      programadoHorasRegreso: bObjRef ? bObjRef.horas_regreso : null,
      fecha_inicio_traslado: bObjRef ? bObjRef.fecha_inicio_traslado : null,`;
appJs = appJs.replace(bitacoraTarget, bitacoraReplacement);

// 3. Update colors for Ida
const colorIdaTarget = `                backgroundColor: '#475569',
                borderColor: '#475569',`;
const colorIdaReplacement = `                backgroundColor: (function() {
                  if (b.realizado === false || (b.nota && b.nota.includes('Programado') && b.realizado !== true)) return '#8b5cf6';
                  if (b.programadoHorasTraslado !== undefined && b.programadoHorasTraslado !== null) {
                    return parseFloat(b.horas_traslado) === parseFloat(b.programadoHorasTraslado) ? '#10b981' : '#3b82f6';
                  }
                  return '#ef4444';
                })(),
                borderColor: (function() {
                  if (b.realizado === false || (b.nota && b.nota.includes('Programado') && b.realizado !== true)) return '#8b5cf6';
                  if (b.programadoHorasTraslado !== undefined && b.programadoHorasTraslado !== null) {
                    return parseFloat(b.horas_traslado) === parseFloat(b.programadoHorasTraslado) ? '#10b981' : '#3b82f6';
                  }
                  return '#ef4444';
                })(),`;
appJs = appJs.replace(colorIdaTarget, colorIdaReplacement);

// 4. Update colors for Regreso
const colorRegresoTarget = `                backgroundColor: '#475569',
                borderColor: '#475569',`;
const colorRegresoReplacement = `                backgroundColor: (function() {
                  if (b.realizado === false || (b.nota && b.nota.includes('Programado') && b.realizado !== true)) return '#8b5cf6';
                  if (b.programadoHorasRegreso !== undefined && b.programadoHorasRegreso !== null) {
                    return parseFloat(b.horas_regreso) === parseFloat(b.programadoHorasRegreso) ? '#10b981' : '#3b82f6';
                  }
                  return '#ef4444';
                })(),
                borderColor: (function() {
                  if (b.realizado === false || (b.nota && b.nota.includes('Programado') && b.realizado !== true)) return '#8b5cf6';
                  if (b.programadoHorasRegreso !== undefined && b.programadoHorasRegreso !== null) {
                    return parseFloat(b.horas_regreso) === parseFloat(b.programadoHorasRegreso) ? '#10b981' : '#3b82f6';
                  }
                  return '#ef4444';
                })(),`;
// Since the first replace changed Ida, the second replace will find Regreso
appJs = appJs.replace(colorRegresoTarget, colorRegresoReplacement);

fs.writeFileSync('app.js', appJs);
console.log('app.js updated successfully');
