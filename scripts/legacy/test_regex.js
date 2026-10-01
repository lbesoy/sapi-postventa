const text = "001 FILTRO DE ACEITE MOTOR P/CRIBA RM MSC5700 Y MSC10500 1 H87 0 ARZ 391.33 16.00 391.33 Item Code: 7W2326N Fecha de Entrega 15/06/2026 Clave SAT 40161504 002 FILTRO DE COMBUSTIBLE CRIBA RM MSC10500 2 H87 0 ARZ 703.99 16.00 1,407.98 Item Code: 3608960N";
const regex = /\b(\d{3})\s+(.*?)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{1,5})\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{1,5})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\b/g;
let match;
while ((match = regex.exec(text)) !== null) {
  console.log(match.slice(1));
}
