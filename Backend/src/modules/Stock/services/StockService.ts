function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const StockService = {
  /**
   * Consome `quantity` unidades do material via FIFO sobre os lotes de entrada (StockLog IN)
   * com remainingQty > 0, criando um StockLog de saída (OUT) com o custo médio ponderado
   * dos lotes consumidos. Lança INSUFFICIENT_STOCK (com materialId/requestedQty/availableQty)
   * se o saldo total for menor que a quantidade solicitada.
   */
  async consumeFifo(tx: any, params: { materialId: number; quantity: number; description?: string | null }) {
    const { materialId, quantity, description } = params;
    const txAny = tx as any;

    // Adquire um bloqueio pessimista na linha do material para serializar movimentações concorrentes
    await tx.material.update({
      where: { id: materialId },
      data: { updatedAt: new Date() }
    });

    const inLots = await txAny.stockLog.findMany({
      where: {
        materialId,
        type: 'IN',
        remainingQty: { gt: 0 }
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    const totalAvailable = inLots.reduce((acc: number, lot: any) => acc + toNumber(lot.remainingQty), 0);
    if (totalAvailable < quantity) {
      const err: any = new Error('INSUFFICIENT_STOCK');
      err.materialId = materialId;
      err.requestedQty = quantity;
      err.availableQty = totalAvailable;
      throw err;
    }

    let remainingToConsume = quantity;
    let movementCost = 0;

    for (const lot of inLots) {
      if (remainingToConsume <= 0) break;
      const lotRemaining = toNumber(lot.remainingQty);
      if (lotRemaining <= 0) continue;

      const consumeQty = Math.min(lotRemaining, remainingToConsume);
      const costPerUnit = toNumber(lot.unitCost);
      movementCost += consumeQty * costPerUnit;

      await txAny.stockLog.update({
        where: { id: lot.id },
        data: { remainingQty: lotRemaining - consumeQty }
      });

      remainingToConsume -= consumeQty;
    }

    const movementUnitCost = movementCost / quantity;

    const outLog = await txAny.stockLog.create({
      data: {
        materialId,
        quantity,
        type: 'OUT',
        description: description ?? null,
        unitCost: movementUnitCost,
        totalPaid: movementCost,
        remainingQty: 0,
      },
      include: {
        material: true,
        supplierPerson: {
          include: {
            naturalPerson: { select: { name: true } },
            legalPerson: { select: { corporateName: true } },
          }
        }
      }
    });

    const nextLot = await txAny.stockLog.findFirst({
      where: {
        materialId,
        type: 'IN',
        remainingQty: { gt: 0 }
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    if (nextLot?.unitCost && toNumber(nextLot.unitCost) > 0) {
      await tx.material.update({
        where: { id: materialId },
        data: { price: toNumber(nextLot.unitCost) }
      });
    }

    return outLog;
  },

  /**
   * Devolve `quantity` unidades ao estoque como um novo lote de entrada (StockLog IN),
   * usando o custo padrão vigente do material. Usado quando um consumo previamente
   * registrado é reduzido ou removido (ex.: ajuste de materiais de uma OS).
   */
  async returnToStock(tx: any, params: { materialId: number; quantity: number; description?: string | null }) {
    const { materialId, quantity, description } = params;
    const txAny = tx as any;

    const material = await tx.material.update({
      where: { id: materialId },
      data: { updatedAt: new Date() },
      select: { price: true }
    });

    const unitCost = toNumber(material?.price);

    return txAny.stockLog.create({
      data: {
        materialId,
        quantity,
        type: 'IN',
        description: description ?? null,
        unitCost: unitCost > 0 ? unitCost : null,
        totalPaid: unitCost > 0 ? unitCost * quantity : null,
        remainingQty: quantity,
      },
      include: {
        material: true,
        supplierPerson: {
          include: {
            naturalPerson: { select: { name: true } },
            legalPerson: { select: { corporateName: true } },
          }
        }
      }
    });
  }
};
