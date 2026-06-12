import PDFDocument from 'pdfkit';
import { addPremiumFooter, PDF_COLORS, ensurePageSpace, drawMetricCard } from './pdfCommon';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function generateSingleServiceOrderPDF(
  order: any,
  companyInfo?: {
    companyName?: string;
    cnpj?: string;
    phone?: string;
    address?: string;
    companyLogo?: string;
    email?: string;
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
      const compName = companyInfo?.companyName || 'ProMEC Industrial';
      const compCnpj = companyInfo?.cnpj || '00.000.000/0001-00';
      const compPhone = companyInfo?.phone || '(11) 99999-9999';
      const compEmail = companyInfo?.email || 'contato@promec.com.br';
      const compAddress = companyInfo?.address || 'Av. Industrial, 1000 - São Paulo, SP';

      // 1. Draw Company Name and Document Title on the left (no logo)
      doc.fillColor(PDF_COLORS.primary).fontSize(16).font('Helvetica-Bold')
        .text(compName, 40, 25);
      doc.fillColor(PDF_COLORS.secondary).fontSize(10).font('Helvetica')
        .text('ORDEM DE SERVIÇO', 40, 48);

      // 2. Draw Company Details on the right side
      const detailsX = 300;
      let detailsY = 25;
      doc.fillColor(PDF_COLORS.secondary).fontSize(8).font('Helvetica');
      
      doc.text(`CNPJ: ${compCnpj}`, detailsX, detailsY, { align: 'right', width: 255 });
      detailsY += 10;
      doc.text(`Telefone: ${compPhone}`, detailsX, detailsY, { align: 'right', width: 255 });
      detailsY += 10;
      doc.text(`E-mail: ${compEmail}`, detailsX, detailsY, { align: 'right', width: 255 });
      detailsY += 10;
      doc.text(`Endereço: ${compAddress}`, detailsX, detailsY, { align: 'right', width: 255 });

      // 3. Separation line
      doc.moveTo(40, 75).lineTo(555, 75).strokeColor(PDF_COLORS.border).lineWidth(1).stroke();
      
      // Reset document position/font
      doc.y = 90;
      doc.x = 40;
      doc.font('Helvetica').fillColor(PDF_COLORS.text);
    };

    doc.on('pageAdded', renderHeader);
    renderHeader();

    // Calculate markup/tax factor so that item sums match the final total shown to customer
    const mTotal = (order.materials || []).reduce((acc: number, m: any) => acc + safeNum(m.totalPrice), 0);
    const sTotal = (order.services || []).reduce((acc: number, s: any) => acc + safeNum(s.totalPrice), 0);
    const directCost = mTotal + sTotal;
    const profitPct = safeNum(order.profitPercent);
    const taxPct = safeNum(order.taxPercent);
    const profitAmt = directCost * (profitPct / 100);
    const baseForTax = directCost + profitAmt;
    const taxAmt = baseForTax * (taxPct / 100);
    const finalTotal = baseForTax + taxAmt;

    const factor = directCost > 0 ? finalTotal / directCost : 1;

    // ── Identificação da OS ──
    const clientName =
      order.person?.naturalPerson?.name ||
      order.person?.legalPerson?.corporateName ||
      '—';
    const clientDoc =
      order.person?.naturalPerson?.cpf ||
      order.person?.legalPerson?.cnpj ||
      '—';

    doc.fillColor(PDF_COLORS.primary).fontSize(14).font('Helvetica-Bold')
      .text(`OS #${order.id}  —  Código: ${order.traceCode || 'Sem código'}`);
    doc.font('Helvetica');
    doc.moveDown(0.8);

    // ── Info rows (single column, simple) ──
    const infoRow = (label: string, value: string) => {
      doc.fillColor(PDF_COLORS.secondary).fontSize(9).font('Helvetica-Bold')
        .text(`${label}:  `, { continued: true });
      doc.fillColor(PDF_COLORS.text).font('Helvetica').text(value);
      doc.moveDown(0.15);
    };

    doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Dados do Cliente');
    doc.moveDown(0.3);
    infoRow('Nome / Razão Social', clientName);
    infoRow('CPF / CNPJ', clientDoc);
    infoRow('E-mail', order.person?.email || '—');
    doc.moveDown(0.5);

    doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Planejamento & PCP');
    doc.moveDown(0.3);
    infoRow('Status', order.status || '—');
    infoRow('Data de Abertura', formatDate(order.openingDate));
    infoRow('Data de Fechamento', formatDate(order.closingDate));
    infoRow('Centro de Trabalho', order.workCenter || '—');
    infoRow('Carga Planejada', order.plannedHours ? `${order.plannedHours}h` : '—');
    infoRow('Início Previsto', formatDate(order.plannedStartDate));
    infoRow('Fim Previsto', formatDate(order.plannedEndDate));
    doc.moveDown(0.8);

    // ── Descrição & Diagnóstico ──
    ensurePageSpace(doc, 60);
    doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Descrição do Problema');
    doc.font('Helvetica').fontSize(9).fillColor(PDF_COLORS.text).moveDown(0.3);
    doc.text(order.problemDescription || order.description || 'Nenhum detalhe informado.', { width: 515 });
    doc.moveDown(0.8);

    if (order.technicalDiagnosis) {
      ensurePageSpace(doc, 40);
      doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Diagnóstico Técnico');
      doc.font('Helvetica').fontSize(9).fillColor(PDF_COLORS.text).moveDown(0.3);
      doc.text(order.technicalDiagnosis, { width: 515 });
      doc.moveDown(1);
    }

    // ── Resumo Financeiro ──
    ensurePageSpace(doc, 90);
    doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Resumo Financeiro');
    doc.moveDown(0.5);

    const cy = doc.y;
    drawMetricCard(doc, 40, cy, 515, 'Valor Total', formatCurrency(finalTotal), PDF_COLORS.primary);

    doc.y = cy + 72;
    doc.moveDown(0.5);

    // ── Tabela de Serviços ──
    const services = order.services || [];
    if (services.length > 0) {
      ensurePageSpace(doc, 60);
      doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Serviços Realizados');
      doc.moveDown(0.4);

      const sColW = [180, 50, 70, 80, 135];
      const sHeaders = ['Serviço / Operação', 'Horas', 'Valor Unit.', 'Total', 'Colaborador'];

      // Table header
      const thY = doc.y;
      doc.save();
      doc.rect(40, thY, 515, 20).fill(PDF_COLORS.primary);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      let cx = 45;
      sHeaders.forEach((h, i) => {
        doc.text(h, cx + (i === 4 ? 10 : 0), thY + 6, { width: sColW[i] - (i === 4 ? 10 : 0), align: i >= 1 && i <= 3 ? 'right' : 'left' });
        cx += sColW[i];
      });
      doc.restore();
      doc.font('Helvetica');
      doc.y = thY + 22;

      services.forEach((s: any, idx: number) => {
        ensurePageSpace(doc, 20);
        const name = s.service?.name || 'Serviço';
        const hours = safeNum(s.hoursWorked);
        const uPrice = safeNum(s.unitPrice) * factor;
        const total = safeNum(s.totalPrice) * factor;
        const employeeName = s.employee?.person?.naturalPerson?.name || '—';

        const rowY = doc.y;
        if (idx % 2 === 0) {
          doc.save().rect(40, rowY, 515, 18).fill(PDF_COLORS.bg).restore();
        }
        doc.fillColor(PDF_COLORS.text).fontSize(8);
        let rx = 45;
        doc.text(name, rx, rowY + 5, { width: sColW[0] - 5, ellipsis: true }); rx += sColW[0];
        doc.text(hours.toFixed(1) + 'h', rx, rowY + 5, { width: sColW[1], align: 'right' }); rx += sColW[1];
        doc.text(formatCurrency(uPrice), rx, rowY + 5, { width: sColW[2], align: 'right' }); rx += sColW[2];
        doc.text(formatCurrency(total), rx, rowY + 5, { width: sColW[3], align: 'right' }); rx += sColW[3];
        doc.text(employeeName, rx + 10, rowY + 5, { width: sColW[4] - 10, ellipsis: true });
        doc.y = rowY + 20;
      });
      doc.moveDown(0.8);
    }

    // ── Tabela de Materiais ──
    const materials = order.materials || [];
    if (materials.length > 0) {
      ensurePageSpace(doc, 60);
      doc.fillColor(PDF_COLORS.primary).font('Helvetica-Bold').fontSize(11).text('Materiais Aplicados');
      doc.moveDown(0.4);

      const mColW = [200, 50, 50, 80, 135];
      const mHeaders = ['Insumo / Material', 'Qtd', 'Unid.', 'Valor Unit.', 'Total'];

      const thY = doc.y;
      doc.save();
      doc.rect(40, thY, 515, 20).fill(PDF_COLORS.primary);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      let cx = 45;
      mHeaders.forEach((h, i) => {
        doc.text(h, cx, thY + 6, { width: mColW[i], align: i >= 3 ? 'right' : 'left' });
        cx += mColW[i];
      });
      doc.restore();
      doc.font('Helvetica');
      doc.y = thY + 22;

      materials.forEach((m: any, idx: number) => {
        ensurePageSpace(doc, 20);
        const name = m.material?.name || 'Material';
        const qty = safeNum(m.quantity);
        const unit = m.material?.unit || 'un';
        const uPrice = safeNum(m.unitPrice) * factor;
        const total = safeNum(m.totalPrice) * factor;

        const rowY = doc.y;
        if (idx % 2 === 0) {
          doc.save().rect(40, rowY, 515, 18).fill(PDF_COLORS.bg).restore();
        }
        doc.fillColor(PDF_COLORS.text).fontSize(8);
        let rx = 45;
        doc.text(name, rx, rowY + 5, { width: mColW[0] - 5, ellipsis: true }); rx += mColW[0];
        doc.text(String(qty), rx, rowY + 5, { width: mColW[1], align: 'left' }); rx += mColW[1];
        doc.text(unit, rx, rowY + 5, { width: mColW[2], align: 'left' }); rx += mColW[2];
        doc.text(formatCurrency(uPrice), rx, rowY + 5, { width: mColW[3], align: 'right' }); rx += mColW[3];
        doc.text(formatCurrency(total), rx, rowY + 5, { width: mColW[4], align: 'right' });
        doc.y = rowY + 20;
      });
      doc.moveDown(1);
    }

    addPremiumFooter(doc);
    doc.end();
  });
}
