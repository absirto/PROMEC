import PDFDocument from 'pdfkit';
import { addHeaderFooter } from './pdfCommon';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight = 40) {
  if (doc.y + neededHeight > doc.page.height - 60) {
    doc.addPage();
  }
}

export function generatePurchasesPDF(
  purchaseRequests: any[],
  purchaseHistory: any[],
  filters: { start?: string; end?: string; status?: string; supplierName?: string },
  companyLogo?: string
): Buffer {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  if (companyLogo) (doc as any).companyLogo = companyLogo;

  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  addHeaderFooter(doc, 'Relatório de Compras');

  const totalRequests = purchaseRequests.length;
  const openRequests = purchaseRequests.filter((request) => request.status !== 'CLOSED').length;
  const totalPurchases = purchaseHistory.length;
  const totalPaid = purchaseHistory.reduce((acc, log) => acc + Number(log.totalPaid || 0), 0);

  doc.fontSize(11).fillColor('#455a64');
  doc.text(`Período: ${filters.start || '-'} a ${filters.end || '-'}`);
  doc.text(`Status solicitado: ${filters.status || 'Todos'}`);
  doc.text(`Fornecedor: ${filters.supplierName || 'Todos'}`);
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

  doc.end();
  return Buffer.concat(buffers);
}