import PDFDocument from 'pdfkit';

/**
 * Cores do Sistema ProMEC Premium
 */
export const PDF_COLORS = {
  primary: '#0f172a',    // Slate 900
  secondary: '#64748b',  // Slate 500
  muted: '#94a3b8',      // Slate 400
  success: '#10b981',    // Emerald 500
  danger: '#ef4444',     // Red 500
  warning: '#f59e0b',    // Amber 500
  info: '#3b82f6',       // Blue 500
  bg: '#f8fafc',         // Slate 50
  border: '#e2e8f0',     // Slate 200
  white: '#ffffff',
  text: '#1e293b'        // Slate 800
};

/**
 * Desenha um placeholder elegante para o logo
 */
function drawLogoPlaceholder(doc: any, x: number) {
  doc.save().circle(x + 22, 45, 20).fill(PDF_COLORS.primary).restore();
  doc.fillColor('white').fontSize(12).font('Helvetica-Bold').text('PM', x + 13, 40);
}

/**
 * Adiciona cabeçalho premium com logotipo e barra estilizada
 */
export function addPremiumHeader(doc: any, title: string, subtitle?: string) {
  const logoWidth = 45;
  const leftMargin = 40;
  
  // Renderiza Logo ou Placeholder
  if (doc.companyLogo) {
    try {
      const logo = doc.companyLogo;
      if (logo.startsWith('data:image/')) {
        const base64Data = logo.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        doc.image(buffer, leftMargin, 25, { width: logoWidth });
      } else {
        doc.image(logo, leftMargin, 25, { width: logoWidth });
      }
    } catch (e) {
      drawLogoPlaceholder(doc, leftMargin);
    }
  } else {
    drawLogoPlaceholder(doc, leftMargin);
  }

  // Título e Empresa
  doc.fillColor(PDF_COLORS.primary).fontSize(20).font('Helvetica-Bold').text(title, 100, 32, { align: 'left' });
  if (subtitle) {
    doc.fillColor(PDF_COLORS.secondary).fontSize(9).font('Helvetica').text(subtitle, 100, 54);
  } else {
    doc.fillColor(PDF_COLORS.secondary).fontSize(9).font('Helvetica').text('Relatório Executivo ProMEC Intelligence', 100, 54);
  }

  // Barra de separação
  doc.moveTo(40, 75).lineTo(555, 75).strokeColor(PDF_COLORS.border).lineWidth(1).stroke();
  
  doc.moveDown(2.5);
  doc.font('Helvetica').fillColor(PDF_COLORS.text);
}

/**
 * Adiciona rodapé premium com paginação
 */
export function addPremiumFooter(doc: any) {
  const range = doc.bufferedPageRange();
  const generatedAt = new Date().toLocaleString('pt-BR');

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    
    // Linha superior do rodapé
    doc.moveTo(40, doc.page.height - 50).lineTo(555, doc.page.height - 50).strokeColor(PDF_COLORS.border).lineWidth(0.5).stroke();
    
    doc.fillColor(PDF_COLORS.muted).fontSize(8).font('Helvetica').text(
      `Relatório Confidencial ProMEC  —  Gerado em: ${generatedAt}`,
      40,
      doc.page.height - 40,
      { align: 'left', width: 400 }
    );
    
    doc.text(
      `Página ${i + 1} de ${range.count}`,
      doc.page.width - 140,
      doc.page.height - 40,
      { align: 'right', width: 100 }
    );
  }
}

/**
 * Desenha um card de métrica (Bento Style)
 */
export function drawMetricCard(doc: any, x: number, y: number, width: number, label: string, value: string, color: string = PDF_COLORS.primary) {
  const height = 60;
  
  doc.save();
  // Sombra suave e fundo
  doc.roundedRect(x, y, width, height, 10).fillAndStroke(PDF_COLORS.bg, PDF_COLORS.border);
  
  // Barra lateral de cor
  doc.roundedRect(x, y, 6, height, { topLeft: 10, bottomLeft: 10 }).fill(color);
  
  // Texto
  doc.fillColor(PDF_COLORS.secondary).fontSize(8).font('Helvetica').text(label.toUpperCase(), x + 15, y + 15);
  doc.fillColor(PDF_COLORS.primary).fontSize(16).font('Helvetica-Bold').text(value, x + 15, y + 28);
  
  doc.restore();
}

/**
 * Inicia uma tabela premium
 */
export function startPremiumTable(doc: any, headers: string[], columnWidths: number[]) {
  const startY = doc.y;
  const tableWidth = 515;
  const x = 40;
  
  // Cabeçalho da tabela
  doc.save();
  doc.roundedRect(x, startY, tableWidth, 24, 4).fill(PDF_COLORS.primary);
  doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
  
  let currentX = x + 10;
  headers.forEach((header, i) => {
    doc.text(header, currentX, startY + 8, { width: columnWidths[i], align: i > 0 ? 'right' : 'left' });
    currentX += columnWidths[i];
  });
  
  doc.restore();
  doc.y = startY + 28;
  doc.font('Helvetica');
}

/**
 * Adiciona uma linha à tabela premium
 */
export function addPremiumTableRow(doc: any, data: string[], columnWidths: number[], rowIndex: number) {
  const x = 40;
  const tableWidth = 515;
  const rowHeight = 22;
  const currentY = doc.y;

  // Zebra striping
  if (rowIndex % 2 !== 0) {
    doc.save().rect(x, currentY, tableWidth, rowHeight).fill(PDF_COLORS.bg).restore();
  }
  
  doc.fillColor(PDF_COLORS.text).fontSize(9);
  let currentX = x + 10;
  data.forEach((val, i) => {
    doc.text(val, currentX, currentY + 6, { width: columnWidths[i], align: i > 0 ? 'right' : 'left' });
    currentX += columnWidths[i];
  });
  
  doc.moveTo(x, currentY + rowHeight).lineTo(x + tableWidth, currentY + rowHeight).strokeColor(PDF_COLORS.border).lineWidth(0.5).stroke();
  
  doc.y = currentY + rowHeight;
}

/**
 * Garante que haja espaço na página
 */
export function ensurePageSpace(doc: any, neededHeight: number = 40) {
  if (doc.y + neededHeight > doc.page.height - 100) {
    doc.addPage();
  }
}
