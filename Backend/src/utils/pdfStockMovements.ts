import PDFDocument from 'pdfkit';
import { addPremiumHeader, addPremiumFooter, startPremiumTable, addPremiumTableRow, PDF_COLORS, ensurePageSpace } from './pdfCommon';

export function generateStockMovementsPDF(data: any[], start?: string, end?: string, companyLogo?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    if (companyLogo) (doc as any).companyLogo = companyLogo;
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    addPremiumHeader(doc, 'Auditoria de Movimentação de Estoque');
    
    if (start && end) {
      doc.fillColor(PDF_COLORS.secondary).fontSize(10).text(`Intervalo: ${start} a ${end}`, { align: 'right' });
    }
    doc.moveDown(1.5);

    const columnWidths = [80, 220, 100, 105];
    startPremiumTable(doc, ['Data', 'Material / Insumo', 'Quantidade', 'Operação'], columnWidths);

    data.forEach((item, index) => {
      ensurePageSpace(doc, 25);
      
      const typeLabel = item.type === 'IN' ? 'Entrada (+)' : 'Saída (-)';
      const typeColor = item.type === 'IN' ? PDF_COLORS.success : PDF_COLORS.danger;
      
      const currentY = doc.y;
      addPremiumTableRow(
        doc, 
        [
          new Date(item.createdAt).toLocaleDateString('pt-BR'),
          item.material?.name || '-',
          item.quantity.toString(),
          typeLabel
        ], 
        columnWidths, 
        index
      );
      
      // Sobrescreve a cor da última coluna para dar destaque ao tipo
      doc.save().fillColor(typeColor).fontSize(9).font('Helvetica-Bold')
         .text(typeLabel, 40 + 10 + 80 + 220 + 100, currentY + 6, { width: 105, align: 'right' })
         .restore();
    });

    addPremiumFooter(doc);

    doc.end();
  });
}
