import PDFDocument from 'pdfkit';
import { addHeaderFooter } from './pdfCommon';

export function generateUsersSummaryPDF(summary: any, companyLogo?: string): Buffer {
  const doc = new PDFDocument({ margin: 40 });
  if (companyLogo) (doc as any).companyLogo = companyLogo;
  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  addHeaderFooter(doc, 'Resumo de Usuários Ativos');
  doc.moveDown(2);

  doc.fontSize(14).fillColor('#1565c0').text(`Total de Usuários: ${summary.total}`);
  doc.fontSize(14).fillColor('#2e7d32').text(`Administradores: ${summary.admins}`);
  doc.fontSize(14).fillColor('#37474f').text(`Usuários Comuns: ${summary.users}`);

  doc.end();
  return Buffer.concat(buffers);
}
