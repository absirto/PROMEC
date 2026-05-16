import PDFDocument from 'pdfkit';
import { addPremiumHeader, addPremiumFooter, startPremiumTable, addPremiumTableRow, PDF_COLORS, ensurePageSpace } from './pdfCommon';

export function generateServiceOrdersPDF(data: any[], start?: string, end?: string, companyLogo?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    if (companyLogo) (doc as any).companyLogo = companyLogo;
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    addPremiumHeader(doc, 'Status Operacional de Ordens de Serviço');
    
    if (start && end) {
      doc.fillColor(PDF_COLORS.secondary).fontSize(10).text(`Período: ${start} a ${end}`, { align: 'right' });
    }
    doc.moveDown(1.5);

    const totalOrders = data.reduce((acc, item) => acc + (item._count._all || 0), 0);

    doc.fillColor(PDF_COLORS.primary).fontSize(12).font('Helvetica-Bold').text('Distribuição por Status');
    doc.moveDown(0.5);

    const columnWidths = [350, 155];
    startPremiumTable(doc, ['Status da Operação', 'Quantidade de OS'], columnWidths);

    data.forEach((item, index) => {
      ensurePageSpace(doc, 25);
      addPremiumTableRow(
        doc, 
        [item.status, item._count._all.toString()], 
        columnWidths, 
        index
      );
    });

    // Total final
    doc.moveDown(1);
    doc.save().moveTo(40, doc.y).lineTo(555, doc.y).strokeColor(PDF_COLORS.primary).lineWidth(1).stroke().restore();
    doc.moveDown(0.5);
    doc.fillColor(PDF_COLORS.primary).fontSize(10).font('Helvetica-Bold').text('TOTAL ACUMULADO NO PERÍODO:', 40, doc.y, { continued: true });
    doc.text(`  ${totalOrders} OS`, { align: 'right' });

    addPremiumFooter(doc);

    doc.end();
  });
}
