import PDFDocument from 'pdfkit';
import { addPremiumHeader, addPremiumFooter, PDF_COLORS, ensurePageSpace, drawMetricCard } from './pdfCommon';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function drawInfoRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fillColor('#64748b').fontSize(9).text(`${label}:`, { continued: true, width: 150 });
  doc.fillColor('#0f172a').fontSize(9).text(`  ${value}`);
  doc.moveDown(0.3);
}

export function generateSingleServiceOrderPDF(
  order: any,
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

    if (companyInfo?.companyLogo) {
      (doc as any).companyLogo = companyInfo.companyLogo;
    }

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const renderHeader = () => {
      addPremiumHeader(doc, 'Ordem de Serviço', companyInfo?.companyName || 'ProMEC Industrial');
    };

    doc.on('pageAdded', renderHeader);
    renderHeader();

    // ── Identificação da OS ──
    const clientName =
      order.person?.naturalPerson?.name ||
      order.person?.legalPerson?.corporateName ||
      '—';
    const clientCpfCnpj =
      order.person?.naturalPerson?.cpf ||
      order.person?.legalPerson?.cnpj ||
      '—';

    doc.fillColor(PDF_COLORS.primary).fontSize(14).font('Helvetica-Bold')
      .text(`OS #${order.id}  —  Código: ${order.traceCode || 'Sem código'}`, 40, doc.y);
    doc.font('Helvetica');
    doc.moveDown(0.5);

    // Grid de Informações
    const topY = doc.y;
    doc.fontSize(10);
    
    // Bloco Esquerdo: Cliente
    doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').text('Informações do Cliente', 40, topY);
    doc.font('Helvetica').moveDown(0.3);
    drawInfoRow(doc, 'Nome / Razão', clientName);
    drawInfoRow(doc, 'CPF / CNPJ', clientCpfCnpj);
    drawInfoRow(doc, 'E-mail', order.person?.email || '—');
    
    const leftEndY = doc.y;

    // Bloco Direito: Operacional
    const rightX = 300;
    doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').text('Planejamento & PCP', rightX, topY);
    doc.font('Helvetica').moveDown(0.3);
    
    // Para desenhar info rows à direita:
    const drawRightInfoRow = (label: string, value: string) => {
      doc.fillColor('#64748b').fontSize(9).text(`${label}:`, rightX, doc.y, { continued: true, width: 100 });
      doc.fillColor('#0f172a').fontSize(9).text(`  ${value}`);
      doc.moveDown(0.3);
    };
    
    drawRightInfoRow('Status', order.status || '—');
    drawRightInfoRow('Abertura', formatDate(order.openingDate));
    drawRightInfoRow('Fechamento', formatDate(order.closingDate));
    drawRightInfoRow('Centro de Trabalho', order.workCenter || '—');
    drawRightInfoRow('Carga Planejada', order.plannedHours ? `${order.plannedHours}h` : '—');

    // Use whichever column ended lower
    doc.y = Math.max(leftEndY, doc.y);
    doc.moveDown(1);

    // ── Descrição & Diagnóstico ──
    ensurePageSpace(doc, 100);
    doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Descrição do Problema');
    doc.font('Helvetica').fontSize(9).fillColor(PDF_COLORS.text).moveDown(0.3);
    doc.text(order.problemDescription || 'Nenhum detalhe informado.', { width: 515 });
    doc.moveDown(0.8);

    if (order.technicalDiagnosis) {
      doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Diagnóstico Técnico');
      doc.font('Helvetica').fontSize(9).fillColor(PDF_COLORS.text).moveDown(0.3);
      doc.text(order.technicalDiagnosis, { width: 515 });
      doc.moveDown(1);
    }

    // ── Totais Financeiros ──
    ensurePageSpace(doc, 80);
    const mTotal = (order.materials || []).reduce((acc: number, m: any) => acc + (Number(m.totalPrice) || 0), 0);
    const sTotal = (order.services || []).reduce((acc: number, s: any) => acc + (Number(s.totalPrice) || 0), 0);
    const directCost = mTotal + sTotal;
    const profitPct = Number(order.profitPercent) || 0;
    const taxPct = Number(order.taxPercent) || 0;
    const profitAmt = directCost * (profitPct / 100);
    const baseForTax = directCost + profitAmt;
    const taxAmt = baseForTax * (taxPct / 100);
    const finalTotal = baseForTax + taxAmt;

    const cardW = Math.floor((515 - 15) / 4);
    const cy = doc.y;
    drawMetricCard(doc, 40, cy, cardW, 'Custo Direto', formatCurrency(directCost), PDF_COLORS.info);
    drawMetricCard(doc, 40 + (cardW + 5), cy, cardW, 'Margem Lucro', formatCurrency(profitAmt), PDF_COLORS.success);
    drawMetricCard(doc, 40 + (cardW + 5) * 2, cy, cardW, 'Impostos', formatCurrency(taxAmt), PDF_COLORS.warning);
    drawMetricCard(doc, 40 + (cardW + 5) * 3, cy, cardW, 'Valor Total', formatCurrency(finalTotal), PDF_COLORS.primary);

    doc.y = cy + 70;

    // ── Tabela de Serviços ──
    const services = order.services || [];
    if (services.length > 0) {
      ensurePageSpace(doc, 80);
      doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Serviços Realizados');
      doc.moveDown(0.4);
      
      const colX = [40, 240, 310, 390, 460];
      const widths = [190, 70, 70, 70, 75];
      const headers = ['Serviço / Operação', 'Colaborador', 'Horas', 'Valor Unit.', 'Total'];
      
      const thY = doc.y;
      doc.save().roundedRect(40, thY, 515, 20, 2).fill(PDF_COLORS.primary);
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, colX[i], thY + 6, { width: widths[i], align: i >= 2 ? 'right' : 'left' });
      });
      doc.restore().font('Helvetica');
      doc.y = thY + 22;

      services.forEach((s: any, idx: number) => {
        ensurePageSpace(doc, 22);
        const name = s.service?.name || 'Serviço';
        const empName = s.employee?.person?.naturalPerson?.name || '—';
        const hours = Number(s.hoursWorked || 0);
        const uPrice = Number(s.unitPrice || 0);
        const total = Number(s.totalPrice || 0);

        const rowY = doc.y;
        doc.save().rect(40, rowY, 515, 18).fill(idx % 2 === 0 ? PDF_COLORS.bg : '#ffffff').restore();
        doc.fillColor(PDF_COLORS.text).fontSize(8);
        doc.text(name, colX[0], rowY + 5, { width: 195, ellipsis: true });
        doc.text(empName, colX[1], rowY + 5, { width: 65, ellipsis: true });
        doc.text(hours.toFixed(1) + 'h', colX[2], rowY + 5, { width: widths[2], align: 'right' });
        doc.text(formatCurrency(uPrice), colX[3], rowY + 5, { width: widths[3], align: 'right' });
        doc.text(formatCurrency(total), colX[4], rowY + 5, { width: widths[4], align: 'right' });
        doc.y = rowY + 20;
      });
      doc.moveDown(0.8);
    }

    // ── Tabela de Materiais ──
    const materials = order.materials || [];
    if (materials.length > 0) {
      ensurePageSpace(doc, 80);
      doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Materiais Aplicados');
      doc.moveDown(0.4);
      
      const colX = [40, 240, 310, 390, 460];
      const widths = [190, 70, 70, 70, 75];
      const headers = ['Insumo / Material', 'Quantidade', 'Unidade', 'Valor Unit.', 'Total'];
      
      const thY = doc.y;
      doc.save().roundedRect(40, thY, 515, 20, 2).fill(PDF_COLORS.primary);
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, colX[i], thY + 6, { width: widths[i], align: i >= 3 ? 'right' : 'left' });
      });
      doc.restore().font('Helvetica');
      doc.y = thY + 22;

      materials.forEach((m: any, idx: number) => {
        ensurePageSpace(doc, 22);
        const name = m.material?.name || 'Material';
        const qty = Number(m.quantity || 0);
        const unit = m.material?.unit || 'un';
        const uPrice = Number(m.unitPrice || 0);
        const total = Number(m.totalPrice || 0);

        const rowY = doc.y;
        doc.save().rect(40, rowY, 515, 18).fill(idx % 2 === 0 ? PDF_COLORS.bg : '#ffffff').restore();
        doc.fillColor(PDF_COLORS.text).fontSize(8);
        doc.text(name, colX[0], rowY + 5, { width: 195, ellipsis: true });
        doc.text(String(qty), colX[1], rowY + 5, { width: widths[1], align: 'left' });
        doc.text(unit, colX[2], rowY + 5, { width: widths[2], align: 'left' });
        doc.text(formatCurrency(uPrice), colX[3], rowY + 5, { width: widths[3], align: 'right' });
        doc.text(formatCurrency(total), colX[4], rowY + 5, { width: widths[4], align: 'right' });
        doc.y = rowY + 20;
      });
      doc.moveDown(1);
    }

    addPremiumFooter(doc);
    doc.end();
  });
}
