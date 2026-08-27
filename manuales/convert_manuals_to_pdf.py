import os
import markdown
from xhtml2pdf import pisa

# Directorio de manuales
base_dir = os.path.dirname(os.path.abspath(__file__))
logo_path = os.path.join(base_dir, '..', 'logo_transparent.png')

manuals = [
    {"md": "README.md", "pdf": "README.pdf", "title": "Centro de Ayuda SAPI Postventa"},
    {"md": "manual_cliente.md", "pdf": "manual_cliente.pdf", "title": "Manual del Cliente - SAPI Postventa"},
    {"md": "manual_tecnico.md", "pdf": "manual_tecnico.pdf", "title": "Manual del Técnico de Campo - SAPI Postventa"},
    {"md": "manual_administrador.md", "pdf": "manual_administrador.pdf", "title": "Manual del Administrador - SAPI Postventa"},
    {"md": "manual_gastos.md", "pdf": "manual_gastos.pdf", "title": "Manual de Control de Gastos - SAPI Postventa"},
    {"md": "manual_tecnico_desarrollador.md", "pdf": "manual_tecnico_desarrollador.pdf", "title": "Manual de Referencia Técnica - SAPI Postventa"},
    {"md": "manual_flujo_completo.md", "pdf": "manual_flujo_completo.pdf", "title": "Manual de Flujo Completo del Sistema - SAPI Postventa"},
    {"md": "manual_tickets.md", "pdf": "manual_tickets.pdf", "title": "Manual de Gestión de Tickets - SAPI Postventa"}
]

# Estilos CSS para el PDF con los colores corporativos de Eurorep
css = """
@page {
    size: letter;
    margin: 2cm;
    @frame footer {
        -pdf-frame-content: footerContent;
        bottom: 1.2cm;
        left: 2cm;
        right: 2cm;
        height: 1cm;
    }
}
body {
    font-family: Helvetica, Arial, sans-serif;
    color: #334155;
    font-size: 10pt;
    line-height: 1.6;
}
p {
    margin-bottom: 12px;
}
h2 {
    font-size: 14pt;
    color: #1e293b;
    margin-top: 25px;
    margin-bottom: 12px;
    border-bottom: 1.5px solid #e8820c;
    padding-bottom: 4px;
}
h3 {
    font-size: 11pt;
    color: #e8820c;
    margin-top: 18px;
    margin-bottom: 8px;
}
ul, ol {
    margin-bottom: 15px;
    padding-left: 20px;
}
li {
    margin-bottom: 6px;
}
strong {
    color: #0f172a;
}
a {
    color: #e8820c;
    text-decoration: none;
    font-weight: bold;
}
img {
    display: block;
    margin: 12px auto;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
}
hr {
    border: 0;
    border-top: 1.5px solid #e2e8f0;
    margin: 25px 0;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
}
th, td {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
    text-align: left;
    font-size: 9pt;
}
th {
    background-color: #f8fafc;
    color: #0f172a;
    font-weight: bold;
}
blockquote {
    border-left: 4px solid #94a3b8;
    background-color: #f8fafc;
    padding: 8px 12px;
    margin: 15px 0;
}
"""

def preprocess_markdown(text):
    # Convertir bloques de alerta GitHub a contenedores HTML estilizados
    lines = text.split('\n')
    processed_lines = []
    in_quote = False
    quote_type = None
    quote_lines = []
    
    for line in lines:
        if line.startswith('> [!NOTE]'):
            in_quote = True
            quote_type = 'note'
            continue
        elif line.startswith('> [!IMPORTANT]') or line.startswith('> [!WARNING]') or line.startswith('> [!CAUTION]'):
            in_quote = True
            quote_type = 'important'
            continue
        elif line.startswith('> [!TIP]'):
            in_quote = True
            quote_type = 'tip'
            continue
            
        if in_quote:
            if line.startswith('>'):
                quote_lines.append(line.replace('>', '').strip())
            else:
                # Cierre de bloque
                border_color = "#3b82f6" if quote_type == 'note' else ("#dc2626" if quote_type == 'important' else "#10b981")
                bg_color = "#eff6ff" if quote_type == 'note' else ("#fef2f2" if quote_type == 'important' else "#f0fdf4")
                content = " ".join(quote_lines)
                processed_lines.append(f'<div style="border-left: 4px solid {border_color}; background-color: {bg_color}; padding: 10px 15px; margin: 15px 0; font-size: 9pt; color: #1e293b;">{content}</div>')
                in_quote = False
                quote_lines = []
                processed_lines.append(line)
        else:
            processed_lines.append(line)
            
    if in_quote:
        border_color = "#3b82f6" if quote_type == 'note' else ("#dc2626" if quote_type == 'important' else "#10b981")
        bg_color = "#eff6ff" if quote_type == 'note' else ("#fef2f2" if quote_type == 'important' else "#f0fdf4")
        content = " ".join(quote_lines)
        processed_lines.append(f'<div style="border-left: 4px solid {border_color}; background-color: {bg_color}; padding: 10px 15px; margin: 15px 0; font-size: 9pt; color: #1e293b;">{content}</div>')
        
    return '\n'.join(processed_lines)

for manual in manuals:
    md_path = os.path.join(base_dir, manual["md"])
    pdf_path = os.path.join(base_dir, manual["pdf"])
    
    if not os.path.exists(md_path):
        print(f"File {md_path} does not exist. Skipping.")
        continue
        
    print(f"Converting {manual['md']} to {manual['pdf']}...")
    
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()
        
    # Extraer el título H1 principal de la primera línea para la cabecera estilizada
    first_h1 = ""
    lines = md_text.split('\n')
    if lines and lines[0].startswith('# '):
        first_h1 = lines[0].replace('# ', '').strip()
        md_text = '\n'.join(lines[1:])
    else:
        first_h1 = manual["title"]
        
    # Preprocesar
    md_text = preprocess_markdown(md_text)
    
    # Convertir a HTML
    html_body = markdown.markdown(md_text, extensions=['extra', 'tables'])
    
    # Resolver rutas de imagen relativas a absolutas para xhtml2pdf
    html_body = html_body.replace('src="images/', f'src="{base_dir}/images/')
    
    # Auto-ajustar anchos fijos de imagen para resolver limitaciones de xhtml2pdf en el PDF
    mobile_imgs = ["tecnico_ordenes_lista.jpg", "tecnico_bitacora_modal.jpg", "tecnico_firmas_seccion.jpg", "tecnico_fila_pendiente.jpg", "tecnico_sync_modal.jpg"]
    desktop_imgs = ["dashboard.jpg", "calendario_asignar.jpg", "nuevo_ticket.jpg", "admin_ticket_procesar.jpg", "control_gastos.jpg", "admin_ticket_refacciones.jpg", "admin_ticket_cotizacion.jpg"]
    
    for m_img in mobile_imgs:
        html_body = html_body.replace(f'src="{base_dir}/images/{m_img}"', f'src="{base_dir}/images/{m_img}" style="width: 220px;"')
        
    for d_img in desktop_imgs:
        html_body = html_body.replace(f'src="{base_dir}/images/{d_img}"', f'src="{base_dir}/images/{d_img}" style="width: 480px;"')
    
    # Maquetación con cabecera y logo corporativo de Eurorep
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            {css}
        </style>
    </head>
    <body>
        <div class="header-table-container">
            <table style="width: 100%; border: none; margin: 0 0 15px 0; padding: 0;">
                <tr>
                    <td style="width: 75%; border: none; vertical-align: middle; padding: 0; margin: 0;">
                        <div style="font-size: 18pt; font-weight: bold; color: #1e293b; line-height: 1.2;">{first_h1}</div>
                        <div style="font-size: 9pt; color: #e8820c; font-weight: bold; margin-top: 5px; text-transform: uppercase; letter-spacing: 1px;">SAPI Postventa &mdash; Eurorep CRM</div>
                    </td>
                    <td style="width: 25%; border: none; text-align: right; vertical-align: middle; padding: 0; margin: 0;">
                        <img src="{logo_path}" style="width: 110px; border: none; margin: 0; padding: 0; display: inline;" />
                    </td>
                </tr>
            </table>
        </div>
        <hr style="border: 0; border-top: 2.5px solid #e8820c; margin-top: 0; margin-bottom: 25px; padding: 0;" />
        
        <div class="content-body">
            {html_body}
        </div>
        
        <div id="footerContent" style="text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px;">
            {manual['title']} &mdash; Eurorep CRM
        </div>
    </body>
    </html>
    """
    
    # Generar PDF
    with open(pdf_path, "w+b") as result_file:
        pisa_status = pisa.CreatePDF(
            html_content,
            dest=result_file
        )
        
    if pisa_status.err:
        print(f"❌ Error converting {manual['md']} to PDF")
    else:
        print(f"✅ Successful conversion: {manual['pdf']}")
