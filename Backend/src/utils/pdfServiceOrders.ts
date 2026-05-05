import PDFDocument from 'pdfkit';
import { addHeaderFooter, setTableHeader } from './pdfCommon';

export function generateServiceOrdersPDF(data: any[], start?: string, end?: string, companyLogo?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    if (companyLogo) (doc as any).companyLogo = companyLogo;
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    addHeaderFooter(doc, 'Relatório de Ordens de Serviço por Status');
    if (start && end) {
      doc.moveDown().fontSize(12).fillColor('#37474f').text(`Período: ${start} a ${end}`, { align: 'center' });
    }
    doc.moveDown();

    setTableHeader(doc, ['Status', 'Quantidade'], doc.y);

    data.forEach((item) => {
      doc.fontSize(12).fillColor('#263238').text(item.status, 60, doc.y, { continued: true });
      doc.text(item._count._all.toString(), 180, doc.y);
      doc.moveDown(0.5);
    });

    doc.end();
  });
}
