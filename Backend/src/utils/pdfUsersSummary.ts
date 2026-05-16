import PDFDocument from 'pdfkit';
import { addPremiumHeader, addPremiumFooter, drawMetricCard, PDF_COLORS } from './pdfCommon';

export function generateUsersSummaryPDF(summary: any, companyLogo?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    if (companyLogo) (doc as any).companyLogo = companyLogo;
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    addPremiumHeader(doc, 'Governança: Resumo de Acessos');
    doc.moveDown(1.5);

    // Cards de Usuários
    const cardWidth = 165;
    const spacing = 10;
    const startX = 40;
    const currentY = doc.y;

    drawMetricCard(doc, startX, currentY, cardWidth, 'Total de Contas', String(summary.total || 0), PDF_COLORS.primary);
    drawMetricCard(doc, startX + cardWidth + spacing, currentY, cardWidth, 'Administradores', String(summary.admins || 0), PDF_COLORS.warning);
    drawMetricCard(doc, startX + (cardWidth + spacing) * 2, currentY, cardWidth, 'Colaboradores', String(summary.users || 0), PDF_COLORS.info);

    doc.y = currentY + 80;

    doc.moveDown(2);
    doc.fillColor(PDF_COLORS.secondary).fontSize(9).text('Este relatório apresenta a distribuição atual de perfis de acesso no sistema ProMEC. Administradores possuem privilégios totais de gestão e configuração.', { align: 'center' });

    addPremiumFooter(doc);

    doc.end();
  });
}
