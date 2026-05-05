import PDFDocument from 'pdfkit';
import { addHeaderFooter, setTableHeader } from './pdfCommon';

export function generateStockMovementsPDF(data: any[], start?: string, end?: string, companyLogo?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    if (companyLogo) (doc as any).companyLogo = companyLogo;
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    addHeaderFooter(doc, 'Relatório de Movimentação de Estoque');
    if (start && end) {
      doc.moveDown().fontSize(12).fillColor('#37474f').text(`Período: ${start} a ${end}`, { align: 'center' });
    }
    doc.moveDown();

    setTableHeader(doc, ['Data', 'Material', 'Quantidade', 'Tipo'], doc.y);

    data.forEach((item) => {
      doc.fontSize(12).fillColor('#263238')
        .text(new Date(item.createdAt).toLocaleDateString(), 60, doc.y, { continued: true })
        .text(item.material?.name || '-', 180, doc.y, { continued: true })
        .text(item.quantity.toString(), 300, doc.y, { continued: true })
        .text(item.type, 420, doc.y);
      doc.moveDown(0.5);
    });

    doc.end();
  });
}
