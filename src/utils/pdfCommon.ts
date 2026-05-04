import PDFDocument from 'pdfkit';

export function addHeaderFooter(doc: any, title: string) {
  // Cabeçalho com logotipo dinâmico e título
  // O logo pode ser passado como base64 ou caminho de arquivo
  if (doc.companyLogo) {
    try {
      const logo = doc.companyLogo;
      if (logo.startsWith('data:image/')) {
        // Base64
        const base64Data = logo.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        doc.image(buffer, 40, 20, { width: 40 });
      } else {
        // Caminho de arquivo
        doc.image(logo, 40, 20, { width: 40 });
      }
    } catch (e) {
      // Se falhar, ignora o logo
    }
  }
  doc.fontSize(20).fillColor('#1a237e').text(title, 90, 30, { align: 'left', continued: false });
  doc.moveDown(2);

  // Rodapé com data/hora
  const pageHeight = doc.page.height;
  doc.fontSize(10).fillColor('#757575').text(
    `Gerado em: ${new Date().toLocaleString()}`,
    40,
    pageHeight - 40,
    { align: 'left' }
  );
  doc.moveDown();
}

export function setTableHeader(doc: any, headers: string[], y: number) {
  doc.fontSize(12).fillColor('#283593').font('Helvetica-Bold');
  let x = 60;
  headers.forEach((header: string) => {
    doc.text(header, x, y, { continued: true });
    x += 120;
  });
  doc.moveDown();
  doc.moveTo(60, doc.y).lineTo(540, doc.y).stroke('#283593');
  doc.font('Helvetica').fillColor('black');
}
