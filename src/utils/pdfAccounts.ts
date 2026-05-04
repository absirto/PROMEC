import PDFDocument from 'pdfkit';
import { addHeaderFooter, setTableHeader } from './pdfCommon';

export function generateAccountsPDF(data: any[], status?: string, companyLogo?: string): Buffer {
  const doc = new PDFDocument({ margin: 40 });
  if (companyLogo) (doc as any).companyLogo = companyLogo;
  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  addHeaderFooter(doc, 'Relatório de Contas a Receber/Pagar');
  if (status) {
    doc.moveDown().fontSize(12).fillColor('#37474f').text(`Tipo: ${status}`, { align: 'center' });
  }
  doc.moveDown();

  setTableHeader(doc, ['Data', 'Descrição', 'Valor', 'Status'], doc.y);

  data.forEach((item) => {
    doc.fontSize(12).fillColor('#263238')
      .text(new Date(item.date).toLocaleDateString(), 60, doc.y, { continued: true })
      .text(item.description || '-', 180, doc.y, { continued: true })
      .text(`R$ ${item.amount.toFixed(2)}`, 300, doc.y, { continued: true })
      .text(item.type, 420, doc.y);
    doc.moveDown(0.5);
  });

  doc.end();
  return Buffer.concat(buffers);
}
