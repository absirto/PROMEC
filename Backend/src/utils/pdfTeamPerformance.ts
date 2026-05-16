import PDFDocument from 'pdfkit';
import { addPremiumHeader, addPremiumFooter, startPremiumTable, addPremiumTableRow, PDF_COLORS, ensurePageSpace } from './pdfCommon';

export function generateTeamPerformancePDF(data: any[], companyLogo?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    if (companyLogo) (doc as any).companyLogo = companyLogo;
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    addPremiumHeader(doc, 'KPI: Desempenho e Produtividade');
    doc.moveDown(1.5);

    doc.fillColor(PDF_COLORS.primary).fontSize(11).font('Helvetica-Bold').text('Produtividade por Colaborador');
    doc.fillColor(PDF_COLORS.secondary).fontSize(9).font('Helvetica').text('Volume de ordens de serviço atendidas no período atual.');
    doc.moveDown(0.5);

    const columnWidths = [120, 395];
    startPremiumTable(doc, ['ID / Código', 'Total de Ordens Atendidas'], columnWidths);

    data.forEach((item, index) => {
      ensurePageSpace(doc, 25);
      addPremiumTableRow(
        doc, 
        [
          `COLAB-${item.employeeId}`, 
          `${item._count._all} Ordens`
        ], 
        columnWidths, 
        index
      );
    });

    // Nota de rodapé técnica
    doc.moveDown(2);
    doc.fillColor(PDF_COLORS.muted).fontSize(8).text('* Os dados refletem os apontamentos técnicos registrados e validados pelo supervisor de área.', { align: 'center' });

    addPremiumFooter(doc);

    doc.end();
  });
}
