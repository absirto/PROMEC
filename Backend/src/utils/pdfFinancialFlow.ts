import PDFDocument from 'pdfkit';
import { addHeaderFooter } from './pdfCommon';

export function generateFinancialFlowPDF(summary: any, start?: string, end?: string, companyLogo?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    if (companyLogo) (doc as any).companyLogo = companyLogo;
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    addHeaderFooter(doc, 'Relatório de Fluxo Financeiro');
    if (start && end) {
      doc.moveDown().fontSize(12).fillColor('#37474f').text(`Período: ${start} a ${end}`, { align: 'center' });
    }
    doc.moveDown(2);

    doc.fontSize(14).fillColor('#2e7d32').text(`Total de Receitas: R$ ${summary.totalIncome?.toFixed(2) ?? '0.00'}`);
    doc.fontSize(14).fillColor('#c62828').text(`Total de Despesas: R$ ${summary.totalExpense?.toFixed(2) ?? '0.00'}`);
    doc.fontSize(14).fillColor('#1565c0').text(`Saldo: R$ ${(summary.balance ?? 0).toFixed(2)}`);

    doc.end();
  });
}
