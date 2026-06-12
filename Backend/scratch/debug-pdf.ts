import { PrismaClient } from '@prisma/client';
import { generateSingleServiceOrderPDF } from '../src/utils/pdfSingleServiceOrder';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: 5 },
    include: {
      person: { include: { naturalPerson: true, legalPerson: true } },
      services: { include: { service: true, employee: { include: { person: { include: { naturalPerson: true } } } } } },
      materials: { include: { material: true } },
      qualityControls: true,
      transactions: true,
    }
  });

  if (!order) {
    console.error("OS 5 not found!");
    process.exit(1);
  }

  const companyInfo = {
    companyName: "ProMEC Industrial",
    cnpj: "00.000.000/0001-00",
    phone: "11999999999",
    address: "Rua Principal, 123",
    companyLogo: undefined,
  };

  console.log("Generating PDF and tracing page additions...");
  
  const pdfBuffer = await generateSingleServiceOrderPDF(order, companyInfo);
  fs.writeFileSync('debug-os-5.pdf', pdfBuffer);
  console.log("Done. Saved to debug-os-5.pdf");
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
