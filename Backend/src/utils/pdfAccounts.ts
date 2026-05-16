import PDFDocument from 'pdfkit';
import { addPremiumHeader, addPremiumFooter, startPremiumTable, addPremiumTableRow, PDF_COLORS, ensurePageSpace } from './pdfCommon';

export function generateAccountsPDF(data: any[], status?: string, companyLogo?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    if (companyLogo) (doc as any).companyLogo = companyLogo;
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    addPremiumHeader(doc, 'Relatório Consolidado de Contas');
    
    if (status) {
      doc.fillColor(PDF_COLORS.secondary).fontSize(10).text(`Tipo de Lançamento: ${status}`, { align: 'right' });
    }
    doc.moveDown(1.5);

    const columnWidths = [80, 240, 100, 95];
    startPremiumTable(doc, ['Data', 'Descrição / Categoria', 'Valor Consolidado', 'Natureza'], columnWidths);

    data.forEach((item, index) => {
      ensurePageSpace(doc, 25);
      
      const typeLabel = item.type === 'RECEIVABLE' ? 'Receita' : 'Despesa';
      const typeColor = item.type === 'RECEIVABLE' ? PDF_COLORS.success : PDF_COLORS.danger;
      const currentY = doc.y;

      addPremiumTableRow(
        doc, 
        [
          new Date(item.date).toLocaleDateString('pt-BR'),
          item.description || item.category || '-',
          `R$ ${item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          typeLabel
        ], 
        columnWidths, 
        index
      );

      // Destaque de cor para o tipo
      doc.save().fillColor(typeColor).fontSize(9).font('Helvetica-Bold')
         .text(typeLabel, 40 + 10 + 80 + 240 + 100, currentY + 6, { width: 95, align: 'right' })
         .restore();
    });

    addPremiumFooter(doc);

    doc.end();
  });
}
