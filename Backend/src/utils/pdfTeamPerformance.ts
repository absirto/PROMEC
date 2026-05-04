import PDFDocument from 'pdfkit';
import { addHeaderFooter, setTableHeader } from './pdfCommon';

export function generateTeamPerformancePDF(data: any[], companyLogo?: string): Buffer {
  const doc = new PDFDocument({ margin: 40 });
  if (companyLogo) (doc as any).companyLogo = companyLogo;
  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  addHeaderFooter(doc, 'Relatório de Desempenho de Equipes');
  doc.moveDown();

  setTableHeader(doc, ['ID Funcionário', 'Qtd. Serviços'], doc.y);

  data.forEach((item) => {
    doc.fontSize(12).fillColor('#263238').text(item.employeeId.toString(), 60, doc.y, { continued: true });
    doc.text(item._count._all.toString(), 180, doc.y);
    doc.moveDown(0.5);
  });

  doc.end();
  return Buffer.concat(buffers);
}
