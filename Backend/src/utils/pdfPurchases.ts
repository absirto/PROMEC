import PDFDocument from 'pdfkit';
import { addPremiumHeader, addPremiumFooter, drawMetricCard, PDF_COLORS, ensurePageSpace, startPremiumTable, addPremiumTableRow } from './pdfCommon';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function generatePurchasesPDF(
  purchaseRequests: any[],
  purchaseHistory: any[],
  filters: { start?: string; end?: string; status?: string; supplierName?: string },
  companyLogo?: string,
  companyInfo?: { companyName?: string; cnpj?: string; phone?: string; contactEmail?: string; address?: string; emitterName?: string }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    if (companyLogo) (doc as any).companyLogo = companyLogo;

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    addPremiumHeader(doc, 'Inteligência de Suprimentos', companyInfo?.companyName);

    const totalRequests = purchaseRequests.length;
    const openRequests = purchaseRequests.filter((request) => request.status !== 'CLOSED').length;
    const totalPurchases = purchaseHistory.length;
    const totalPaid = purchaseHistory.reduce((acc, log) => acc + Number(log.totalPaid || 0), 0);

    // Filtros e Contexto
    doc.fillColor(PDF_COLORS.secondary).fontSize(9).text(`Período: ${filters.start || '-'} a ${filters.end || '-'}  |  Fornecedor: ${filters.supplierName || 'Todos'}`, { align: 'right' });
    doc.moveDown(1);

    // Métricas Executivas
    const cardWidth = 120;
    const spacing = 11;
    const currentY = doc.y;

    drawMetricCard(doc, 40, currentY, cardWidth, 'Solicitações', String(totalRequests), PDF_COLORS.primary);
    drawMetricCard(doc, 40 + (cardWidth + spacing), currentY, cardWidth, 'Em Aberto', String(openRequests), PDF_COLORS.warning);
    drawMetricCard(doc, 40 + (cardWidth + spacing) * 2, currentY, cardWidth, 'Compras', String(totalPurchases), PDF_COLORS.success);
    drawMetricCard(doc, 40 + (cardWidth + spacing) * 3, currentY, cardWidth, 'Total Pago', formatCurrency(totalPaid), PDF_COLORS.info);

    doc.y = currentY + 75;
    doc.moveDown(1);

    // Tabela de Solicitações
    doc.fillColor(PDF_COLORS.primary).fontSize(12).font('Helvetica-Bold').text('Detalhamento de Solicitações de Compra');
    doc.moveDown(0.5);

    const reqCols = [100, 300, 115];
    startPremiumTable(doc, ['Código / Ref', 'Contexto (OS / Descrição)', 'Status Atual'], reqCols);

    purchaseRequests.forEach((req, idx) => {
      ensurePageSpace(doc, 30);
      addPremiumTableRow(
        doc,
        [
          req.code,
          `OS: ${req.serviceOrder?.traceCode || 'Geral'} - ${req.serviceOrder?.description || 'Suprimento direto'}`,
          req.status
        ],
        reqCols,
        idx
      );
    });

    doc.moveDown(2);

    // Tabela de Histórico de Compras
    ensurePageSpace(doc, 60);
    doc.fillColor(PDF_COLORS.primary).fontSize(12).font('Helvetica-Bold').text('Histórico Consolidado de Aquisições');
    doc.moveDown(0.5);

    const histCols = [70, 240, 100, 105];
    startPremiumTable(doc, ['Data', 'Material / Insumo', 'Qtd / Unid', 'Valor Total'], histCols);

    purchaseHistory.forEach((log, idx) => {
      ensurePageSpace(doc, 25);
      addPremiumTableRow(
        doc,
        [
          new Date(log.createdAt).toLocaleDateString('pt-BR'),
          log.material?.name || '-',
          `${Number(log.quantity || 0).toFixed(1)} ${log.material?.unit || ''}`,
          formatCurrency(Number(log.totalPaid || 0))
        ],
        histCols,
        idx
      );
    });

    // Encerramento institucional
    ensurePageSpace(doc, 100);
    doc.moveDown(3);
    doc.moveTo(40, doc.y).lineTo(250, doc.y).strokeColor(PDF_COLORS.muted).stroke();
    doc.moveDown(0.3);
    doc.fillColor(PDF_COLORS.secondary).fontSize(9).text(`Assinatura do Gestor Responsável: ${companyInfo?.emitterName || 'Gerência de Suprimentos'}`, 40);

    addPremiumFooter(doc);

    doc.end();
  });
}