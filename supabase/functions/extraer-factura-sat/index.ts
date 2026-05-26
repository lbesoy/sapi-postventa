// Supabase Edge Function (Deno) for Cloud-Based SAT Invoice Extraction
// Deploy via: supabase functions deploy extraer-factura-sat

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple XML helper to find attributes without DOMParser (Deno offline context friendly)
function getXmlAttribute(xmlText: string, tag: string, attr: string): string {
  const tagRegex = new RegExp(`<[^>]*?:?${tag}\\b([^>]*?)>`, "i");
  const tagMatch = xmlText.match(tagRegex);
  if (!tagMatch) return "";
  
  const attrRegex = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`, "i");
  const attrMatch = tagMatch[1].match(attrRegex);
  return attrMatch ? attrMatch[1] : "";
}

function getXmlRetenciones(xmlText: string): { isr: number; iva: number } {
  let isr = 0;
  let iva = 0;
  // Match all <cfdi:Retencion ... /> or <Retencion ... /> tags
  const retRegex = /<[^>]*?:?Retencion\b([^>]*?)\/?>/gi;
  let match;
  while ((match = retRegex.exec(xmlText)) !== null) {
    const attrs = match[1];
    const impRegex = /\bImpuesto\s*=\s*["']([^"']*)["']/i;
    const impMatch = attrs.match(impRegex);
    const imp = impMatch ? impMatch[1] : "";

    const valRegex = /\bImporte\s*=\s*["']([^"']*)["']/i;
    const valMatch = attrs.match(valRegex);
    const val = valMatch ? parseFloat(valMatch[1]) : 0;

    if (imp === "001") isr += val;
    else if (imp === "002") iva += val;
  }
  return { isr, iva };
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, base64 } = await req.json();
    if (!base64 || !type) {
      throw new Error("Missing 'base64' or 'type' in request payload.");
    }

    // Decode base64
    const base64Clean = base64.split(",")[1] || base64;
    const binary = atob(base64Clean);
    
    let xmlText = "";
    if (type === "xml") {
      // Decode binary string to UTF-8
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      xmlText = new TextDecoder("utf-8").decode(bytes);
    }

    const data = {
      versionCfdi: '4.0',
      uuid: '',
      estatus: 'Vigente',
      fechaCancelacion: 'N/A',
      tipoComprobante: 'I - Ingreso',
      fechaEmision: '',
      anoEmision: '',
      mesEmision: '',
      diaEmision: '',
      fechaTimbrado: '',
      serie: 'N/A',
      folio: 'N/A',
      formaPago: '03 - Transferencia electrónica de fondos',
      metodoPago: 'PUE - Pago en una sola exhibición',
      condicionesPago: 'N/A',
      rfcEmisor: '',
      nombreEmisor: '',
      rfcReceptor: 'ERE140718NY8',
      nombreReceptor: 'EUROREP S.A. DE C.V.',
      moneda: 'MXN',
      tipoCambio: '1',
      subtotal: 0,
      descuento: 0,
      total: 0,
      isrRetenido: 0,
      ivaRetenido: 0
    };

    if (type === "xml") {
      // Perform extraction using lightweight XML patterns
      data.versionCfdi = getXmlAttribute(xmlText, "Comprobante", "Version") || "4.0";
      
      const tipo = getXmlAttribute(xmlText, "Comprobante", "TipoDeComprobante");
      const tipoMap: Record<string, string> = {
        'I': 'I - Ingreso',
        'E': 'E - Egreso',
        'T': 'T - Traslado',
        'P': 'P - Pago',
        'N': 'N - Nómina'
      };
      data.tipoComprobante = tipoMap[tipo] || tipo || 'I - Ingreso';

      data.fechaEmision = getXmlAttribute(xmlText, "Comprobante", "Fecha");
      if (data.fechaEmision) {
        const datePart = data.fechaEmision.split("T")[0];
        const parts = datePart.split("-");
        if (parts.length === 3) {
          data.anoEmision = parts[0];
          data.mesEmision = parts[1];
          data.diaEmision = parts[2];
        }
      }

      data.serie = getXmlAttribute(xmlText, "Comprobante", "Serie") || "N/A";
      data.folio = getXmlAttribute(xmlText, "Comprobante", "Folio") || "N/A";

      const fp = getXmlAttribute(xmlText, "Comprobante", "FormaPago");
      const fpMap: Record<string, string> = {
        '01': '01 - Efectivo',
        '02': '02 - Cheque nominativo',
        '03': '03 - Transferencia electrónica de fondos',
        '04': '04 - Tarjeta de crédito',
        '05': '05 - Monedero electrónico',
        '08': '08 - Vales de despensa',
        '12': '12 - Dación en pago',
        '15': '15 - Condonación',
        '17': '17 - Compensación',
        '27': '27 - A satisfacción del acreedor',
        '28': '28 - Tarjeta de débito',
        '29': '29 - Tarjeta de servicios',
        '30': '30 - Aplicación de anticipos',
        '31': '31 - Intermediario pagos',
        '99': '99 - Por definir'
      };
      data.formaPago = fpMap[fp] || fp || 'N/A';

      const mp = getXmlAttribute(xmlText, "Comprobante", "MetodoPago");
      const mpMap: Record<string, string> = {
        'PUE': 'PUE - Pago en una sola exhibición',
        'PPD': 'PPD - Pago en parcialidades o diferido'
      };
      data.metodoPago = mpMap[mp] || mp || 'N/A';

      data.condicionesPago = getXmlAttribute(xmlText, "Comprobante", "CondicionesDePago") || "N/A";
      data.moneda = getXmlAttribute(xmlText, "Comprobante", "Moneda") || "MXN";
      data.tipoCambio = getXmlAttribute(xmlText, "Comprobante", "TipoCambio") || "1";

      data.subtotal = parseFloat(getXmlAttribute(xmlText, "Comprobante", "SubTotal") || "0");
      data.descuento = parseFloat(getXmlAttribute(xmlText, "Comprobante", "Descuento") || "0");
      data.total = parseFloat(getXmlAttribute(xmlText, "Comprobante", "Total") || "0");

      data.rfcEmisor = getXmlAttribute(xmlText, "Emisor", "Rfc").toUpperCase();
      data.nombreEmisor = getXmlAttribute(xmlText, "Emisor", "Nombre");

      data.rfcReceptor = getXmlAttribute(xmlText, "Receptor", "Rfc").toUpperCase();
      data.nombreReceptor = getXmlAttribute(xmlText, "Receptor", "Nombre");

      data.uuid = getXmlAttribute(xmlText, "TimbreFiscalDigital", "UUID").toUpperCase();
      data.fechaTimbrado = getXmlAttribute(xmlText, "TimbreFiscalDigital", "FechaTimbrado");

      const rets = getXmlRetenciones(xmlText);
      data.isrRetenido = rets.isr;
      data.ivaRetenido = rets.iva;

    } else if (type === "pdf") {
      // PDF Cloud Extraction: since PDF binary requires a heavy parser, Deno Edge Function will
      // search for text content patterns using regular expressions on the decoded binary string
      // or run a basic string scanning.
      // Deno binary string scanning:
      let text = "";
      try {
        text = binary.replace(/[^\x20-\x7E\s]/g, " "); // remove non-printable characters
      } catch (err) {
        text = binary;
      }

      // 1. Version CFDI
      const versionRegex = /(?:Versión|Version)\s*(?:CFDI)?\s*:\s*([34]\.[03])/i;
      const versionMatch = text.match(versionRegex);
      if (versionMatch) data.versionCfdi = versionMatch[1];

      // 2. UUID
      const uuidRegex = /\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b/;
      const uuidMatch = text.match(uuidRegex);
      if (uuidMatch) data.uuid = uuidMatch[1].toUpperCase();

      // 3. RFCs (Emisor / Receptor)
      const rfcRegex = /\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/gi;
      const rfcMatches = text.match(rfcRegex) || [];
      const uniqueRfcs = [...new Set(rfcMatches.map(r => r.toUpperCase()))];
      
      const receptorRfc = 'ERE140718NY8';
      const emisorRfc = uniqueRfcs.find(rfc => rfc !== receptorRfc);
      if (emisorRfc) data.rfcEmisor = emisorRfc;
      else if (uniqueRfcs.length > 0) data.rfcEmisor = uniqueRfcs[0];
      
      data.rfcReceptor = receptorRfc;

      // 4. Nombre Emisor
      const emisorNombreRegex = /(?:Emisor|Nombre\s*(?:del)?\s*Emisor|Expedido\s*Por)\s*:\s*([^\n\r]+)/i;
      const emisorNombreMatch = text.match(emisorNombreRegex);
      if (emisorNombreMatch) {
        data.nombreEmisor = emisorNombreMatch[1].trim();
      } else {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('gasolinera del valle')) data.nombreEmisor = 'GASOLINERA DEL VALLE S.A.';
        else if (lowerText.includes('tiendas comerciales')) data.nombreEmisor = 'TIENDAS COMERCIALES S.A.';
        else if (lowerText.includes('office depot')) data.nombreEmisor = 'OFFICE DEPOT DE MEXICO S.A. DE C.V.';
        else if (lowerText.includes('concesionaria metropolitana')) data.nombreEmisor = 'CONCESIONARIA METROPOLITANA S.A.';
        else if (lowerText.includes('uber')) data.nombreEmisor = 'UBER RIDE / UBER MEXICO';
        else if (lowerText.includes('linkedin')) data.nombreEmisor = 'LINKEDIN IRELAND LIMITED';
        else data.nombreEmisor = data.rfcEmisor ? `PROVEEDOR: ${data.rfcEmisor}` : 'N/A';
      }

      // 5. Total
      const totalRegex = /(?:total|neto|pagar|importe|monto|total\s*factura)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
      const totalMatch = text.match(totalRegex);
      if (totalMatch) {
        const cleanNum = totalMatch[1].replace(/,/g, '');
        data.total = parseFloat(cleanNum) || 0;
      }

      // 6. Subtotal
      const subtotalRegex = /(?:subtotal|sub-total|sub\s*total)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
      const subtotalMatch = text.match(subtotalRegex);
      if (subtotalMatch) {
        const cleanNum = subtotalMatch[1].replace(/,/g, '');
        data.subtotal = parseFloat(cleanNum) || 0;
      } else {
        data.subtotal = parseFloat((data.total / 1.16).toFixed(2)) || 0;
      }

      // 7. Descuento
      const descuentoRegex = /(?:descuento|rebaja)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
      const descuentoMatch = text.match(descuentoRegex);
      if (descuentoMatch) {
        const cleanNum = descuentoMatch[1].replace(/,/g, '');
        data.descuento = parseFloat(cleanNum) || 0;
      }

      // 8. Retenciones
      const isrRegex = /(?:retención\s*isr|retencion\s*isr|isr\s*ret|isr\s*retenido)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
      const isrMatch = text.match(isrRegex);
      if (isrMatch) {
        const cleanNum = isrMatch[1].replace(/,/g, '');
        data.isrRetenido = parseFloat(cleanNum) || 0;
      }

      const ivaRetRegex = /(?:retención\s*iva|retencion\s*iva|iva\s*ret|iva\s*retenido)\s*(?::)?\s*(?:\$)?\s*([0-9,]+(?:\.\d{2})?)/i;
      const ivaRetMatch = text.match(ivaRetRegex);
      if (ivaRetMatch) {
        const cleanNum = ivaRetMatch[1].replace(/,/g, '');
        data.ivaRetenido = parseFloat(cleanNum) || 0;
      }

      // 9. Fecha Emision
      const dateRegex = /\b(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})\b/;
      const dateMatch = text.match(dateRegex);
      if (dateMatch) {
        let rawDate = dateMatch[0];
        if (rawDate.includes('/')) {
          const parts = rawDate.split('/');
          if (parts.length === 3) {
            rawDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        data.fechaEmision = rawDate;
        const parts = rawDate.split("-");
        if (parts.length === 3) {
          data.anoEmision = parts[0];
          data.mesEmision = parts[1];
          data.diaEmision = parts[2];
        }
      }

      // 10. Fecha Timbrado
      const timbreDateRegex = /(?:fecha\s*(?:de)?\s*(?:certificación|timbrado))\s*(?::)?\s*([\d\-\/T:\s]+)/i;
      const timbreDateMatch = text.match(timbreDateRegex);
      if (timbreDateMatch) {
        const dateText = timbreDateMatch[1].trim().match(/\b(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})\b/);
        if (dateText) {
          let rawDate = dateText[0];
          if (rawDate.includes('/')) {
            const parts = rawDate.split('/');
            if (parts.length === 3) {
              rawDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          data.fechaTimbrado = rawDate;
        }
      }
      if (!data.fechaTimbrado) data.fechaTimbrado = data.fechaEmision;

      // 11. Serie & Folio
      const serieRegex = /(?:serie)\s*:\s*([A-Za-z0-9\-]+)/i;
      const serieMatch = text.match(serieRegex);
      if (serieMatch) data.serie = serieMatch[1].toUpperCase();
      
      const folioRegex = /(?:folio|factura|invoice\s*no)\s*(?::)?\s*([0-9\-]+)/i;
      const folioMatch = text.match(folioRegex);
      if (folioMatch) data.folio = folioMatch[1];

      // 12. Moneda & Tipo Cambio
      const monedaRegex = /(?:moneda)\s*(?::)?\s*([A-Z]{3})/i;
      const monedaMatch = text.match(monedaRegex);
      if (monedaMatch) data.moneda = monedaMatch[1].toUpperCase();
    }

    return new Response(
      JSON.stringify({ status: "success", data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[Extraer Factura SAT] Error:", err.message);
    return new Response(
      JSON.stringify({ status: "error", error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
