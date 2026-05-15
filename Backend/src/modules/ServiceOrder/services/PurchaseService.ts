import prisma from '../../../core/prisma';
import { logger } from '../../../utils/logger';

function generatePurchaseRequestCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SC-${y}${m}${d}-${h}${min}-${rand}`;
}

function generatePurchaseQuotationCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `COT-${y}${m}${d}-${h}${min}-${rand}`;
}

export const PurchaseService = {
  async createPurchaseRequest(tx: any, data: any, actor: any) {
    const requestCode = generatePurchaseRequestCode();
    const txAny = tx as any;

    const createdRequest = await txAny.purchaseRequest.create({
      data: {
        code: requestCode,
        serviceOrderId: data.serviceOrderId,
        status: 'OPEN',
        notes: data.notes,
        requestedByEmail: actor.email,
        items: {
          create: data.items.map((item: any) => ({
            materialId: item.materialId,
            requestedQty: item.requestedQty,
            stockQty: item.stockQty,
            shortageQty: item.shortageQty,
            unit: item.unit,
            status: 'PENDING',
          }))
        }
      },
      include: {
        items: { include: { material: true } },
        serviceOrder: { select: { id: true, traceCode: true } }
      }
    });

    return createdRequest;
  },

  async createQuotation(tx: any, data: any, actor: any) {
    const txAny = tx as any;
    const quotationCode = generatePurchaseQuotationCode();

    const quotation = await txAny.purchaseQuotation.create({
      data: {
        code: quotationCode,
        purchaseRequestId: data.purchaseRequestId,
        supplierPersonId: data.supplierPersonId,
        status: 'OPEN',
        notes: data.notes,
        validUntil: data.validUntil,
        paymentTerms: data.paymentTerms,
        freightMode: data.freightMode,
        freightCost: data.freightCost,
        deliveryLeadTimeDays: data.deliveryLeadTimeDays,
        warrantyDays: data.warrantyDays,
        createdByEmail: actor.email,
        items: {
          create: data.items.map((item: any) => ({
            purchaseRequestItemId: item.purchaseRequestItemId,
            materialId: item.materialId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            ipiValue: item.ipiValue,
            icmsValue: item.icmsValue,
            stValue: item.stValue,
            totalPaid: item.totalPaid,
            notes: item.notes,
          }))
        }
      },
      include: {
        supplierPerson: { include: { naturalPerson: true, legalPerson: true } },
        purchaseRequest: {
          include: {
            serviceOrder: { select: { id: true, traceCode: true, description: true } },
            items: { include: { material: true } }
          }
        },
        items: { include: { material: true, purchaseRequestItem: true } }
      }
    });

    return quotation;
  },

  async approveQuotation(tx: any, quotationId: number, actor: any) {
    const txAny = tx as any;
    const quotation = await txAny.purchaseQuotation.findUnique({
      where: { id: quotationId },
      include: {
        purchaseRequest: {
          include: {
            serviceOrder: { select: { id: true, traceCode: true } },
            items: { include: { material: true } }
          }
        },
        items: true,
      }
    });

    if (!quotation) throw new Error('QUOTATION_NOT_FOUND');
    if (quotation.status !== 'OPEN') throw new Error('QUOTATION_NOT_OPEN');

    const requestItemsMap = new Map<number, any>(quotation.purchaseRequest.items.map((ri: any) => [ri.id, ri]));

    for (const qItem of quotation.items) {
      const requestItem = requestItemsMap.get(qItem.purchaseRequestItemId);
      if (!requestItem) continue;

      const availableShortage = Math.max(0, Number(requestItem.shortageQty || 0));
      if (availableShortage <= 0) continue;

      const qtyToBuy = Math.min(Number(qItem.quantity || 0), availableShortage);
      if (qtyToBuy <= 0) continue;

      const unitCost = Number(qItem.unitCost || 0);
      const totalPaid = Number(qItem.totalPaid || 0) > 0 ? Number(qItem.totalPaid) : unitCost * qtyToBuy;

      // Entrada no estoque
      await txAny.stockLog.create({
        data: {
          materialId: requestItem.materialId,
          quantity: qtyToBuy,
          type: 'IN',
          description: `Compra por cotação ${quotation.code}`,
          supplierPersonId: quotation.supplierPersonId,
          unitCost,
          totalPaid,
          remainingQty: qtyToBuy,
        }
      });

      // Atualiza preço médio/último do material
      await tx.material.update({
        where: { id: requestItem.materialId },
        data: { price: unitCost }
      });

      const newStockQty = Number(requestItem.stockQty || 0) + qtyToBuy;
      const newShortageQty = Math.max(0, Number(requestItem.shortageQty || 0) - qtyToBuy);
      const newStatus = newShortageQty <= 0 ? 'PURCHASED' : 'PARTIAL';

      await txAny.purchaseRequestItem.update({
        where: { id: requestItem.id },
        data: {
          stockQty: newStockQty,
          shortageQty: newShortageQty,
          status: newStatus,
        }
      });
    }

    // Atualiza status da solicitação
    const refreshedItems = await txAny.purchaseRequestItem.findMany({
      where: { purchaseRequestId: quotation.purchaseRequestId },
      select: { id: true, status: true }
    });
    const allPurchased = refreshedItems.every((ri: any) => ri.status === 'PURCHASED');
    const hasAnyPurchased = refreshedItems.some((ri: any) => ri.status === 'PURCHASED' || ri.status === 'PARTIAL');

    await txAny.purchaseRequest.update({
      where: { id: quotation.purchaseRequestId },
      data: {
        status: allPurchased ? 'CLOSED' : (hasAnyPurchased ? 'PARTIAL' : 'OPEN')
      }
    });

    // Rejeita outras cotações abertas para a mesma solicitação (opcional dependendo da regra de negócio)
    // await txAny.purchaseQuotation.updateMany({
    //   where: { purchaseRequestId: quotation.purchaseRequestId, id: { not: quotationId }, status: 'OPEN' },
    //   data: { status: 'REJECTED' }
    // });

    const approvedQuotation = await txAny.purchaseQuotation.update({
      where: { id: quotationId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByEmail: actor.email,
      },
      include: {
        supplierPerson: { include: { naturalPerson: true, legalPerson: true } },
        purchaseRequest: {
          include: {
            serviceOrder: { select: { id: true, traceCode: true, description: true } },
            items: { include: { material: true } }
          }
        },
        items: { include: { material: true, purchaseRequestItem: true } }
      }
    });

    return approvedQuotation;
  }
};
