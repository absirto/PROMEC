import PDFDocument from 'pdfkit';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight = 40) {
  if (doc.y + neededHeight > doc.page.height - 60) {
    doc.addPage();
  }
}

function drawSummaryCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string, color: string) {
  doc.save();
  doc.roundedRect(x, y, width, 52, 10).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.rect(x, y, 6, 52).fill(color);
  doc.fillColor('#64748b').fontSize(9).text(label, x + 14, y + 10, { width: width - 24 });
  doc.fillColor('#0f172a').fontSize(15).text(value, x + 14, y + 24, { width: width - 24 });
  doc.restore();
}

function drawMiniBar(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: number, maxValue: number, color: string) {
  const safeMax = maxValue > 0 ? maxValue : 1;
  const fillWidth = Math.max(8, (value / safeMax) * width);
  doc.fillColor('#475569').fontSize(9).text(label, x, y - 12);
  doc.roundedRect(x, y, width, 10, 5).fill('#e2e8f0');
  doc.roundedRect(x, y, Math.min(width, fillWidth), 10, 5).fill(color);
  doc.fillColor('#0f172a').fontSize(9).text(String(value), x + width + 8, y - 2);
}

export function generatePurchasesPDF(
  purchaseRequests: any[],
  purchaseHistory: any[],
  filters: { start?: string; end?: string; status?: string; supplierName?: string },
  companyLogo?: string,
  companyInfo?: { companyName?: string; cnpj?: string; phone?: string; contactEmail?: string; address?: string; emitterName?: string }
): Buffer {
  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  if (companyLogo) (doc as any).companyLogo = companyLogo;

  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  const generatedAt = new Date().toLocaleString('pt-BR');

  const renderHeader = () => {
    if ((doc as any).companyLogo) {
      try {
        const logo = (doc as any).companyLogo as string;
        if (logo.startsWith('data:image/')) {
          const base64Data = logo.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          doc.image(buffer, 40, 20, { width: 40 });
        } else {
          doc.image(logo, 40, 20, { width: 40 });
        }
      } catch {
        // ignora erro de logo e segue o relatório
      }
    }

    doc.fillColor('#1a237e').fontSize(20).text('Relatório de Compras', 90, 30, { align: 'left' });
    doc.fontSize(10).fillColor('#64748b').text(companyInfo?.companyName || 'ProMEC', 90, 54, { align: 'left' });
    doc.moveTo(40, 78).lineTo(555, 78).stroke('#cbd5e1');
    doc.x = 40;
    doc.y = 92;
  };

  doc.on('pageAdded', () => {
    renderHeader();
  });

  renderHeader();

  const totalRequests = purchaseRequests.length;
  const openRequests = purchaseRequests.filter((request) => request.status !== 'CLOSED').length;
  const closedRequests = purchaseRequests.filter((request) => request.status === 'CLOSED').length;
  const totalPurchases = purchaseHistory.length;
  const totalPaid = purchaseHistory.reduce((acc, log) => acc + Number(log.totalPaid || 0), 0);
  const chartMax = Math.max(totalRequests, openRequests, closedRequests, totalPurchases, 1);

  doc.fontSize(11).fillColor('#455a64');
  doc.text(`Período: ${filters.start || '-'} a ${filters.end || '-'}`);
  doc.text(`Status solicitado: ${filters.status || 'Todos'}`);
  doc.text(`Fornecedor: ${filters.supplierName || 'Todos'}`);
  doc.text(`Emitido em: ${generatedAt}`);
  doc.moveDown();

  const cardsY = doc.y;
  drawSummaryCard(doc, 40, cardsY, 120, 'Solicitações', String(totalRequests), '#2563eb');
  drawSummaryCard(doc, 172, cardsY, 120, 'Em aberto/parcial', String(openRequests), '#f59e0b');
  drawSummaryCard(doc, 304, cardsY, 120, 'Compras', String(totalPurchases), '#10b981');
  drawSummaryCard(doc, 436, cardsY, 120, 'Valor comprado', formatCurrency(totalPaid), '#7c3aed');
  doc.y = cardsY + 68;

  doc.fontSize(13).fillColor('#1a237e').text('Resumo Visual', { underline: true });
  doc.moveDown(0.5);
  const chartY = doc.y + 4;
  drawMiniBar(doc, 40, chartY, 180, 'Solicitações totais', totalRequests, chartMax, '#2563eb');
  drawMiniBar(doc, 40, chartY + 22, 180, 'Solicitações fechadas', closedRequests, chartMax, '#10b981');
  drawMiniBar(doc, 300, chartY, 180, 'Solicitações em aberto/parcial', openRequests, chartMax, '#f59e0b');
  drawMiniBar(doc, 300, chartY + 22, 180, 'Compras registradas', totalPurchases, chartMax, '#7c3aed');
  doc.y = chartY + 44;
  doc.moveDown();

  doc.fontSize(13).fillColor('#1a237e').text('Resumo Executivo', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(11).fillColor('#263238');
  doc.text(`Solicitações encontradas: ${totalRequests}`);
  doc.text(`Solicitações em aberto/parcial: ${openRequests}`);
  doc.text(`Compras registradas: ${totalPurchases}`);
  doc.text(`Valor total comprado: ${formatCurrency(totalPaid)}`);
  doc.moveDown();

  doc.fontSize(13).fillColor('#1a237e').text('Solicitações de Compra', { underline: true });
  doc.moveDown(0.5);

  if (!purchaseRequests.length) {
    doc.fontSize(11).fillColor('#607d8b').text('Nenhuma solicitação encontrada para os filtros informados.');
  } else {
    purchaseRequests.forEach((request) => {
      ensureSpace(doc, 90);
      doc.fontSize(11).fillColor('#0f172a').text(`${request.code} | Status: ${request.status}`);
      doc.fontSize(10).fillColor('#546e7a').text(
        `OS: ${request.serviceOrder?.traceCode || 'Sem OS'} | Descrição: ${request.serviceOrder?.description || 'Solicitação geral'}`
      );
      doc.text(`Criada em: ${new Date(request.createdAt).toLocaleString('pt-BR')}`);
      doc.moveDown(0.3);

      (request.items || []).forEach((item: any) => {
        ensureSpace(doc, 20);
        doc.fontSize(9).fillColor('#263238').text(
          `- ${item.material?.name || 'Material'} | Solicitado: ${Number(item.requestedQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ${item.unit || item.material?.unit || ''} | Falta: ${Number(item.shortageQty || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} | Status do item: ${item.status}`
        );
      });

      doc.moveDown(0.7);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cbd5e1');
      doc.moveDown(0.7);
    });
  }

  ensureSpace(doc, 60);
  doc.fontSize(13).fillColor('#1a237e').text('Histórico de Compras', { underline: true });
  doc.moveDown(0.5);

  if (!purchaseHistory.length) {
    doc.fontSize(11).fillColor('#607d8b').text('Nenhuma compra encontrada para os filtros informados.');
  } else {
    purchaseHistory.forEach((log) => {
      ensureSpace(doc, 55);
      doc.fontSize(10).fillColor('#0f172a').text(
        `${log.material?.name || 'Material'} | ${new Date(log.createdAt).toLocaleString('pt-BR')}`
      );
      doc.fontSize(9).fillColor('#455a64').text(
        `Fornecedor: ${log.supplierName || '-'} | Quantidade: ${Number(log.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ${log.material?.unit || ''} | Custo unitário: ${formatCurrency(Number(log.unitCost || 0))} | Total: ${formatCurrency(Number(log.totalPaid || 0))}`
      );
      if (log.description) {
        doc.text(`Observação: ${log.description}`);
      }
      doc.moveDown(0.7);
    });
  }

  ensureSpace(doc, 90);
  doc.moveDown();
  doc.fontSize(13).fillColor('#1a237e').text('Emissão Institucional', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#334155');
  doc.text(`Empresa: ${companyInfo?.companyName || 'ProMEC'}`);
  if (companyInfo?.cnpj) doc.text(`CNPJ: ${companyInfo.cnpj}`);
  if (companyInfo?.address) doc.text(`Endereço: ${companyInfo.address}`);
  if (companyInfo?.phone || companyInfo?.contactEmail) {
    doc.text(`Contato: ${companyInfo?.phone || '-'} ${companyInfo?.contactEmail ? `| ${companyInfo.contactEmail}` : ''}`);
  }
  if (companyInfo?.emitterName) {
    doc.text(`Emitido por: ${companyInfo.emitterName}`);
  }
  doc.moveDown(1.2);
  doc.moveTo(40, doc.y).lineTo(250, doc.y).stroke('#94a3b8');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#475569').text(`Assinatura / Responsável pela emissão do relatório${companyInfo?.emitterName ? `: ${companyInfo.emitterName}` : ''}`, 40);

  const pageRange = doc.bufferedPageRange();
  for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const pageNumber = pageIndex - pageRange.start + 1;
    doc.fontSize(9).fillColor('#64748b').text(
      `Gerado em ${generatedAt} | Página ${pageNumber}/${pageRange.count}`,
      40,
      doc.page.height - 32,
      { align: 'center', width: doc.page.width - 80 }
    );
  }

  doc.end();
  return Buffer.concat(buffers);
}