import request from 'supertest';
import app from '../src/app';
import { globalSetup, globalTeardown } from './setup';
import { adminAuthHeader, API_ROOT } from './authHelper';

beforeAll(async () => {
  await globalSetup();
});

afterAll(async () => {
  await globalTeardown();
});

let cnpjCounter = 0;
function uniqueCnpj() {
  cnpjCounter += 1;
  return `${Date.now()}${cnpjCounter}`.slice(-14).padStart(14, '0');
}

async function createMaterial(name: string) {
  const res = await request(app)
    .post(`${API_ROOT}/materials`)
    .set(adminAuthHeader())
    .send({ name, description: 'Material de teste de compras', price: 1, unit: 'UN', active: true });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

async function createSupplier(corporateName: string) {
  const res = await request(app)
    .post(`${API_ROOT}/people`)
    .set(adminAuthHeader())
    .send({
      type: 'J',
      legalPerson: { cnpj: uniqueCnpj(), corporateName },
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

async function createPurchaseRequest(materialId: number, requestedQty: number) {
  const res = await request(app)
    .post(`${API_ROOT}/service-orders/purchase-requests`)
    .set(adminAuthHeader())
    .send({
      items: [
        { materialId, requestedQty, stockQty: 0, shortageQty: requestedQty, unit: 'UN' },
      ],
    });
  expect(res.status).toBe(201);
  return {
    requestId: res.body.data.id as number,
    itemId: res.body.data.items[0].id as number,
  };
}

async function createQuotation(purchaseRequestId: number, purchaseRequestItemId: number, materialId: number, supplierPersonId: number, quantity: number, unitCost: number) {
  const res = await request(app)
    .post(`${API_ROOT}/service-orders/purchase-quotations`)
    .set(adminAuthHeader())
    .send({
      purchaseRequestId,
      supplierPersonId,
      items: [
        { purchaseRequestItemId, materialId, quantity, unitCost, totalPaid: unitCost * quantity },
      ],
    });
  expect(res.status).toBe(201);
  return { quotationId: res.body.data.id as number, code: res.body.data.code as string };
}

describe('Purchase stock entry - fulfillPurchaseRequest x approveQuotation (lógica compartilhada)', () => {
  describe('fulfillPurchaseRequest (POST /purchase-requests/:id/fulfill)', () => {
    let materialId: number;
    let supplierId: number;
    let requestId: number;
    let itemId: number;

    beforeAll(async () => {
      materialId = await createMaterial('Material Fulfill Teste');
      supplierId = await createSupplier('Fornecedor Fulfill Ltda');
      const created = await createPurchaseRequest(materialId, 10);
      requestId = created.requestId;
      itemId = created.itemId;
    });

    it('registra compra parcial: cria StockLog IN, atualiza preço do material e marca item PARTIAL', async () => {
      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-requests/${requestId}/fulfill`)
        .set(adminAuthHeader())
        .send({
          supplierPersonId: supplierId,
          items: [{ purchaseRequestItemId: itemId, quantity: 4, unitCost: 10 }],
        });

      expect(res.status).toBe(200);
      const item = res.body.data.items.find((i: any) => i.id === itemId);
      expect(item).toMatchObject({ stockQty: 4, shortageQty: 6, status: 'PARTIAL' });
      expect(item.material.price).toBe(10);
      expect(res.body.data.status).toBe('PARTIAL');

      const stockRes = await request(app)
        .get(`${API_ROOT}/stock/purchases`)
        .query({ materialId })
        .set(adminAuthHeader());
      expect(stockRes.status).toBe(200);
      const log = stockRes.body.data.find((l: any) => l.materialId === materialId && l.quantity === 4);
      expect(log).toBeTruthy();
      expect(log).toMatchObject({ type: 'IN', unitCost: 10, totalPaid: 40, supplierPersonId: supplierId });
    });

    it('completa a compra via totalPaid (sem unitCost): fecha o item e a solicitação', async () => {
      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-requests/${requestId}/fulfill`)
        .set(adminAuthHeader())
        .send({
          supplierPersonId: supplierId,
          items: [{ purchaseRequestItemId: itemId, quantity: 6, totalPaid: 90 }],
        });

      expect(res.status).toBe(200);
      const item = res.body.data.items.find((i: any) => i.id === itemId);
      expect(item).toMatchObject({ stockQty: 10, shortageQty: 0, status: 'PURCHASED' });
      expect(item.material.price).toBe(15); // 90 / 6 = 15 (fallback unitCost = totalPaid / qtyToBuy)
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('é idempotente para item já PURCHASED: não gera novo StockLog', async () => {
      const before = await request(app)
        .get(`${API_ROOT}/stock/purchases`)
        .query({ materialId })
        .set(adminAuthHeader());
      const countBefore = before.body.data.length;

      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-requests/${requestId}/fulfill`)
        .set(adminAuthHeader())
        .send({
          supplierPersonId: supplierId,
          items: [{ purchaseRequestItemId: itemId, quantity: 1, unitCost: 999 }],
        });

      expect(res.status).toBe(200);
      const item = res.body.data.items.find((i: any) => i.id === itemId);
      expect(item).toMatchObject({ stockQty: 10, shortageQty: 0, status: 'PURCHASED' });
      expect(item.material.price).toBe(15); // preço não deve mudar

      const after = await request(app)
        .get(`${API_ROOT}/stock/purchases`)
        .query({ materialId })
        .set(adminAuthHeader());
      expect(after.body.data.length).toBe(countBefore);
    });

    it('exige unitCost ou totalPaid válidos (ITEM_COST_REQUIRED)', async () => {
      const material = await createMaterial('Material Custo Obrigatorio');
      const { requestId: reqId, itemId: itId } = await createPurchaseRequest(material, 5);

      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-requests/${reqId}/fulfill`)
        .set(adminAuthHeader())
        .send({
          supplierPersonId: supplierId,
          items: [{ purchaseRequestItemId: itId, quantity: 5 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/custo unitário ou total pago/i);
    });

    it('retorna 404 quando o fornecedor não existe', async () => {
      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-requests/${requestId}/fulfill`)
        .set(adminAuthHeader())
        .send({
          supplierPersonId: 999999999,
          items: [{ purchaseRequestItemId: itemId, quantity: 1, unitCost: 1 }],
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/fornecedor/i);
    });

    it('retorna 404 quando o item não pertence à solicitação (REQUEST_ITEM_NOT_FOUND)', async () => {
      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-requests/${requestId}/fulfill`)
        .set(adminAuthHeader())
        .send({
          supplierPersonId: supplierId,
          items: [{ purchaseRequestItemId: 999999999, quantity: 1, unitCost: 1 }],
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/item da solicitação/i);
    });

    it('retorna 404 quando a solicitação de compra não existe', async () => {
      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-requests/999999999/fulfill`)
        .set(adminAuthHeader())
        .send({
          supplierPersonId: supplierId,
          items: [{ purchaseRequestItemId: itemId, quantity: 1, unitCost: 1 }],
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/solicitação de compra/i);
    });
  });

  describe('approveQuotation (POST /purchase-quotations/:id/approve)', () => {
    let materialId: number;
    let supplierAId: number;
    let supplierBId: number;
    let requestId: number;
    let itemId: number;
    let quotationAId: number;
    let quotationACode: string;
    let quotationBId: number;

    beforeAll(async () => {
      materialId = await createMaterial('Material Cotacao Teste');
      supplierAId = await createSupplier('Fornecedor A Ltda');
      supplierBId = await createSupplier('Fornecedor B Ltda');
      const created = await createPurchaseRequest(materialId, 20);
      requestId = created.requestId;
      itemId = created.itemId;

      const quoteA = await createQuotation(requestId, itemId, materialId, supplierAId, 20, 8);
      quotationAId = quoteA.quotationId;
      quotationACode = quoteA.code;

      const quoteB = await createQuotation(requestId, itemId, materialId, supplierBId, 20, 9);
      quotationBId = quoteB.quotationId;
    });

    it('aprova a cotação: cria StockLog IN, atualiza preço do material, fecha item/solicitação e rejeita cotações irmãs OPEN', async () => {
      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-quotations/${quotationAId}/approve`)
        .set(adminAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: quotationAId, status: 'APPROVED' });
      expect(res.body.data.approvedByEmail).toBeTruthy();

      const item = res.body.data.purchaseRequest.items.find((i: any) => i.id === itemId);
      expect(item).toMatchObject({ stockQty: 20, shortageQty: 0, status: 'PURCHASED' });
      expect(item.material.price).toBe(8);
      expect(res.body.data.purchaseRequest.status).toBe('CLOSED');

      const stockRes = await request(app)
        .get(`${API_ROOT}/stock/purchases`)
        .query({ materialId })
        .set(adminAuthHeader());
      const log = stockRes.body.data.find((l: any) => l.quantity === 20 && l.unitCost === 8);
      expect(log).toBeTruthy();
      expect(log).toMatchObject({ type: 'IN', supplierPersonId: supplierAId });
      expect(log.description).toContain(quotationACode);

      // Cotação irmã (fornecedor B), que ainda estava OPEN, deve ter sido rejeitada automaticamente
      const listRes = await request(app)
        .get(`${API_ROOT}/service-orders/purchase-quotations`)
        .query({ purchaseRequestId: requestId })
        .set(adminAuthHeader());
      const siblingQuotation = listRes.body.data.find((q: any) => q.id === quotationBId);
      expect(siblingQuotation.status).toBe('REJECTED');
    });

    it('não permite aprovar uma cotação que já foi rejeitada (auto-rejeição por cotação irmã)', async () => {
      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-quotations/${quotationBId}/approve`)
        .set(adminAuthHeader());

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('QUOTATION_NOT_OPEN');
    });

    it('não permite aprovar a mesma cotação duas vezes', async () => {
      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-quotations/${quotationAId}/approve`)
        .set(adminAuthHeader());

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('QUOTATION_NOT_OPEN');
    });

    it('retorna erro para cotação inexistente', async () => {
      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-quotations/999999999/approve`)
        .set(adminAuthHeader());

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('QUOTATION_NOT_FOUND');
    });

    it('marca item/solicitação como PARTIAL quando a cotação cobre menos que a ruptura', async () => {
      const material = await createMaterial('Material Cotacao Parcial');
      const { requestId: reqId, itemId: itId } = await createPurchaseRequest(material, 10);
      const supplier = await createSupplier('Fornecedor Parcial Ltda');
      const { quotationId } = await createQuotation(reqId, itId, material, supplier, 4, 5);

      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-quotations/${quotationId}/approve`)
        .set(adminAuthHeader());

      expect(res.status).toBe(200);
      const item = res.body.data.purchaseRequest.items.find((i: any) => i.id === itId);
      expect(item).toMatchObject({ stockQty: 4, shortageQty: 6, status: 'PARTIAL' });
      expect(res.body.data.purchaseRequest.status).toBe('PARTIAL');
    });

    it('[documenta assimetria pré-existente] approveQuotation não exige unitCost > 0, diferente de fulfillPurchaseRequest', async () => {
      const material = await createMaterial('Material Custo Zero Cotacao');
      const { requestId: reqId, itemId: itId } = await createPurchaseRequest(material, 3);
      const supplier = await createSupplier('Fornecedor Custo Zero Ltda');
      const { quotationId } = await createQuotation(reqId, itId, material, supplier, 3, 0);

      const res = await request(app)
        .post(`${API_ROOT}/service-orders/purchase-quotations/${quotationId}/approve`)
        .set(adminAuthHeader());

      // Diferente de fulfillPurchaseRequest (que lançaria ITEM_COST_REQUIRED), approveQuotation aceita
      // o unitCost gravado na cotação sem revalidar > 0. Comportamento pré-existente, preservado no refactor.
      expect(res.status).toBe(200);
      const item = res.body.data.purchaseRequest.items.find((i: any) => i.id === itId);
      expect(item.material.price).toBe(0);
    });
  });
});
