import PDFDocument from 'pdfkit';
import { addPremiumHeader, addPremiumFooter, PDF_COLORS, ensurePageSpace } from './pdfCommon';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function drawCard(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number,
  label: string, value: string, color: string
) {
  doc.save();
  doc.roundedRect(x, y, w, 52, 8).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.rect(x, y, 5, 52).fill(color);
  doc.fillColor('#64748b').fontSize(8).text(label, x + 12, y + 9, { width: w - 20 });
  doc.fillColor('#0f172a').fontSize(13).text(value, x + 12, y + 24, { width: w - 20 });
  doc.restore();
}

function drawInfoRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fillColor('#64748b').fontSize(9).text(`${label}:`, { continued: true, width: 150 });
  doc.fillColor('#0f172a').fontSize(9).text(`  ${value}`);
  doc.moveDown(0.3);
}

export function generateQuotationPDF(
  quotation: any,
  companyInfo?: {
    companyName?: string;
    cnpj?: string;
    phone?: string;
    address?: string;
    companyLogo?: string;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const buffers: Buffer[] = [];

    // Anexa a logo para o addPremiumHeader usar
    if (companyInfo?.companyLogo) {
      (doc as any).companyLogo = companyInfo.companyLogo;
    }

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const renderHeader = () => {
      addPremiumHeader(doc, 'Cotação de Compras', companyInfo?.companyName);
    };

    doc.on('pageAdded', renderHeader);
    renderHeader();

    // ── Identificação ──
    const supplier =
      quotation.supplierPerson?.legalPerson?.corporateName ||
      quotation.supplierPerson?.naturalPerson?.name ||
      '—';
    const reqCode = quotation.purchaseRequest?.code || `#${quotation.purchaseRequestId || ''}`;
    const osCode  = quotation.purchaseRequest?.serviceOrder?.traceCode || '—';

    doc.fillColor(PDF_COLORS.primary).fontSize(12).font('Helvetica-Bold')
      .text(`Cotação #${quotation.id}  —  ${supplier}`, 40, doc.y);
    doc.font('Helvetica');
    doc.moveDown(0.5);

    drawInfoRow(doc, 'Solicitação', reqCode);
    drawInfoRow(doc, 'Ordem de Serviço', osCode);
    drawInfoRow(doc, 'Status', quotation.status || '—');
    drawInfoRow(doc, 'Validade', formatDate(quotation.validUntil));
    drawInfoRow(doc, 'Pagamento', quotation.paymentTerms || '—');
    const freightParts = [quotation.freightMode, quotation.freightCost ? formatCurrency(Number(quotation.freightCost)) : null].filter(Boolean);
    drawInfoRow(doc, 'Frete', freightParts.length ? freightParts.join(' — ') : '—');
    drawInfoRow(doc, 'Prazo de Entrega', quotation.deliveryLeadTimeDays ? `${quotation.deliveryLeadTimeDays} dias` : '—');
    drawInfoRow(doc, 'Garantia', quotation.warrantyDays ? `${quotation.warrantyDays} dias` : '—');
    if (quotation.notes) drawInfoRow(doc, 'Obs.', String(quotation.notes));

    doc.moveDown(1);

    // ── Cards de totais ──
    const items: any[] = quotation.items || [];
    const totalBruto   = items.reduce((s: number, i: any) => s + Number(i.unitCost || 0) * Number(i.quantity || 0), 0);
    const totalTax     = items.reduce((s: number, i: any) => s + Number(i.ipiValue || 0) + Number(i.icmsValue || 0) + Number(i.stValue || 0), 0);
    const totalFreight = Number(quotation.freightCost || 0);
    const totalLiquid  = totalBruto + totalTax + totalFreight;

    const cardW = (555 - 40 - 15) / 4;
    const cy = doc.y;
    drawCard(doc, 40,                    cy, cardW, 'Total Bruto',    formatCurrency(totalBruto),   PDF_COLORS.info);
    drawCard(doc, 40 + (cardW + 5),      cy, cardW, 'Impostos',       formatCurrency(totalTax),     PDF_COLORS.warning);
    drawCard(doc, 40 + (cardW + 5) * 2,  cy, cardW, 'Frete',          formatCurrency(totalFreight), '#8b5cf6');
    drawCard(doc, 40 + (cardW + 5) * 3,  cy, cardW, 'Total Líquido',  formatCurrency(totalLiquid),  PDF_COLORS.success);

    doc.y = cy + 64;
    doc.moveDown(0.5);

    // ── Tabela de itens ──
    ensurePageSpace(doc, 60);
    const colX    = [40, 200, 250, 290, 340, 390, 440, 490];
    const headers = ['Material', 'Unid.', 'Qtd', 'Unitário', 'IPI', 'ICMS', 'ST', 'Total'];

    const thY = doc.y;
    doc.save();
    doc.rect(40, thY, 515, 18).fill(PDF_COLORS.primary);
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, colX[i], thY + 5, { width: i < 7 ? colX[i + 1] - colX[i] - 4 : 60, align: i > 1 ? 'right' : 'left' });
    });
    doc.restore();
    doc.font('Helvetica');
    doc.y = thY + 20;

    items.forEach((item: any, idx: number) => {
      ensurePageSpace(doc, 20);
      const matName  = item.material?.name || item.purchaseRequestItem?.material?.name || `Item ${idx + 1}`;
      const unit     = item.material?.unit || '—';
      const qty      = Number(item.quantity || 0);
      const unitCost = Number(item.unitCost || 0);
      const ipi      = Number(item.ipiValue || 0);
      const icms     = Number(item.icmsValue || 0);
      const st       = Number(item.stValue || 0);
      const total    = qty * unitCost + ipi + icms + st;

      const rowTop = doc.y;
      doc.rect(40, rowTop, 515, 16).fill(idx % 2 === 0 ? PDF_COLORS.bg : '#ffffff');
      doc.fillColor(PDF_COLORS.text).fontSize(8);
      doc.text(matName,                                         colX[0], rowTop + 4, { width: 155, ellipsis: true });
      doc.text(unit,                                            colX[1], rowTop + 4, { width: 45, align: 'left' });
      doc.text(qty % 1 === 0 ? String(qty) : qty.toFixed(2),   colX[2], rowTop + 4, { width: 35, align: 'right' });
      doc.text(unitCost.toFixed(2),                             colX[3], rowTop + 4, { width: 45, align: 'right' });
      doc.text(ipi  > 0 ? ipi.toFixed(2)  : '—',               colX[4], rowTop + 4, { width: 45, align: 'right' });
      doc.text(icms > 0 ? icms.toFixed(2) : '—',               colX[5], rowTop + 4, { width: 45, align: 'right' });
      doc.text(st   > 0 ? st.toFixed(2)   : '—',               colX[6], rowTop + 4, { width: 45, align: 'right' });
      doc.text(formatCurrency(total),                           colX[7], rowTop + 4, { width: 65, align: 'right' });
      doc.y = rowTop + 18;
    });

    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke(PDF_COLORS.border);
    doc.moveDown(0.4);
    const totalRowY = doc.y;
    doc.fillColor(PDF_COLORS.primary).fontSize(9).font('Helvetica-Bold')
      .text('TOTAL LÍQUIDO', 40, totalRowY, { width: 430, align: 'right' });
    doc.fillColor(PDF_COLORS.success).fontSize(11)
      .text(formatCurrency(totalLiquid), 470, totalRowY - 1, { width: 85, align: 'right' });
    doc.y = totalRowY + 16;
    doc.font('Helvetica');

    addPremiumFooter(doc);

    doc.end();
  });
}
