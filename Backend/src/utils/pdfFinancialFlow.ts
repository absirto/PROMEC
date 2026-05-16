import PDFDocument from 'pdfkit';
import { addPremiumHeader, addPremiumFooter, drawMetricCard, PDF_COLORS } from './pdfCommon';

export function generateFinancialFlowPDF(summary: any, start?: string, end?: string, companyLogo?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    if (companyLogo) (doc as any).companyLogo = companyLogo;
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Cabeçalho Premium
    addPremiumHeader(doc, 'Performance Financeira');
    
    if (start && end) {
      doc.fillColor(PDF_COLORS.secondary).fontSize(10).text(`Período de Análise: ${start} até ${end}`, { align: 'right' });
    }
    doc.moveDown(1.5);

    // Dash de Métricas (Cards)
    const cardWidth = 165;
    const spacing = 10;
    const startX = 40;
    const currentY = doc.y;

    const income = summary.totalIncome ?? 0;
    const expense = summary.totalExpense ?? 0;
    const balance = summary.balance ?? 0;

    drawMetricCard(doc, startX, currentY, cardWidth, 'Receitas Brutas', `R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, PDF_COLORS.success);
    drawMetricCard(doc, startX + cardWidth + spacing, currentY, cardWidth, 'Despesas Totais', `R$ ${expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, PDF_COLORS.danger);
    drawMetricCard(doc, startX + (cardWidth + spacing) * 2, currentY, cardWidth, 'Resultado Líquido', `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, balance >= 0 ? PDF_COLORS.info : PDF_COLORS.danger);

    doc.y = currentY + 80;

    // Seção de Observações / Disclaimer
    doc.moveDown(2);
    doc.roundedRect(40, doc.y, 515, 60, 8).fill(PDF_COLORS.bg);
    doc.fillColor(PDF_COLORS.primary).fontSize(10).font('Helvetica-Bold').text('Parecer Executivo:', 55, doc.y + 12);
    doc.fillColor(PDF_COLORS.secondary).fontSize(9).font('Helvetica').text(
      `O saldo atual apresenta um resultado ${balance >= 0 ? 'positivo' : 'deficitário'} baseado nas movimentações de caixa do período selecionado. Este relatório consolida todas as entradas e saídas operacionais registradas no sistema ProMEC.`,
      55, doc.y + 26, { width: 480 }
    );

    // Rodapé com Paginação
    addPremiumFooter(doc);

    doc.end();
  });
}
