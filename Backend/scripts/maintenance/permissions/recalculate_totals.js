
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recalculate() {
  console.log('Iniciando recalculo de itens de OS...');

  // 1. Recalcular materiais
  const materials = await prisma.serviceOrderMaterial.findMany();
  for (const m of materials) {
    const correctTotal = m.quantity * m.unitPrice;
    if (Math.abs(m.totalPrice - correctTotal) > 0.01) {
      console.log(`Atualizando material OS #${m.serviceOrderId}: ${m.totalPrice} -> ${correctTotal}`);
      await prisma.serviceOrderMaterial.update({
        where: { id: m.id },
        data: { totalPrice: correctTotal }
      });
    }
  }

  // 2. Recalcular serviços
  const services = await prisma.serviceOrderService.findMany();
  for (const s of services) {
    const correctTotal = s.hoursWorked * s.unitPrice;
    if (Math.abs(s.totalPrice - correctTotal) > 0.01) {
      console.log(`Atualizando serviço OS #${s.serviceOrderId}: ${s.totalPrice} -> ${correctTotal}`);
      await prisma.serviceOrderService.update({
        where: { id: s.id },
        data: { totalPrice: correctTotal }
      });
    }
  }

  console.log('Recalculo concluído!');
}

recalculate()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
