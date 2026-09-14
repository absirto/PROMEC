import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { globalSetup, globalTeardown, prisma } from './setup';
import { API_ROOT } from './authHelper';
import { JWT_SECRET } from '../src/config/security';

// ServiceOrderService.create/update/delete grava ServiceOrderTrace.changedByUserId, que tem
// FK real para User — diferente do header padrão dos outros testes (id fixo 1, sem usuário
// no banco), aqui precisamos de um usuário existente de verdade para essas escritas não
// violarem a FK.
let authHeader: { Authorization: string };

beforeAll(async () => {
  await globalSetup();

  const user = await prisma.user.create({
    data: {
      firstName: 'Teste',
      lastName: 'ExclusaoOS',
      email: `admin-os-delete-${Date.now()}@teste.local`,
      password: 'hash-nao-usado-neste-teste',
      role: 'admin',
    },
  });
  const token = jwt.sign({ id: user.id, email: user.email, role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
  authHeader = { Authorization: `Bearer ${token}` };
});

afterAll(async () => {
  await globalTeardown();
});

let cnpjCounter = 0;
function uniqueCnpj() {
  cnpjCounter += 1;
  return `${Date.now()}${cnpjCounter}`.slice(-14).padStart(14, '0');
}

async function createClientPerson(corporateName: string) {
  const res = await request(app)
    .post(`${API_ROOT}/people`)
    .set(authHeader)
    .send({
      type: 'J',
      legalPerson: { cnpj: uniqueCnpj(), corporateName },
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

async function createMaterial(name: string) {
  const res = await request(app)
    .post(`${API_ROOT}/materials`)
    .set(authHeader)
    .send({ name, description: 'Material de teste de exclusão de OS', price: 10, unit: 'UN', active: true });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

// Vincular material a uma OS agora dá baixa automática no estoque (FIFO) — sem entrada
// prévia, a criação da OS falharia com INSUFFICIENT_STOCK antes de chegar ao teste de exclusão.
async function giveStock(materialId: number, quantity: number, supplierPersonId: number) {
  const res = await request(app)
    .post(`${API_ROOT}/stock`)
    .set(authHeader)
    .send({ materialId, quantity, type: 'IN', description: 'Entrada para teste de exclusão de OS', supplierPersonId, unitCost: 10 });
  expect(res.status).toBe(201);
}

async function createCatalogService(name: string) {
  const res = await request(app)
    .post(`${API_ROOT}/services`)
    .set(authHeader)
    .send({ name, description: 'Serviço de teste de exclusão de OS', price: 100, active: true });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

async function createServiceOrder(personId: number, overrides: any = {}) {
  const res = await request(app)
    .post(`${API_ROOT}/service-orders`)
    .set(authHeader)
    .send({
      personId,
      status: 'Aberta',
      problemDescription: 'Problema relatado pelo cliente para teste de exclusão',
      services: [],
      materials: [],
      ...overrides,
    });
  expect(res.status).toBe(201);
  return res.body.data.id as number;
}

describe('DELETE /service-orders/:id', () => {
  let personId: number;

  beforeAll(async () => {
    personId = await createClientPerson('Cliente Exclusão OS Ltda');
  });

  it('exclui normalmente uma OS sem materiais ou serviços vinculados', async () => {
    const orderId = await createServiceOrder(personId);

    const deleteRes = await request(app)
      .delete(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app)
      .get(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader);
    expect(getRes.status).toBe(404);
  });

  it('retorna 404 ao tentar excluir uma OS inexistente', async () => {
    const res = await request(app)
      .delete(`${API_ROOT}/service-orders/999999999`)
      .set(authHeader);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/não encontrada/i);
  });

  it('bloqueia com 409 a exclusão de uma OS com material vinculado, e a OS permanece intacta', async () => {
    const materialId = await createMaterial('Material Vinculado a OS');
    await giveStock(materialId, 2, personId);
    const orderId = await createServiceOrder(personId, {
      materials: [{ materialId, quantity: 2, unitPrice: 10, totalPrice: 20 }],
    });

    const deleteRes = await request(app)
      .delete(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader);

    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.message).toMatch(/cancele a os/i);
    expect(deleteRes.body.materialsCount).toBe(1);
    expect(deleteRes.body.servicesCount).toBe(0);

    const getRes = await request(app)
      .get(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.materials).toHaveLength(1);
  });

  it('bloqueia com 409 a exclusão de uma OS com serviço vinculado, e a OS permanece intacta', async () => {
    const serviceId = await createCatalogService('Serviço Vinculado a OS');
    const orderId = await createServiceOrder(personId, {
      services: [{ serviceId, description: 'Execução de teste', hoursWorked: 1, unitPrice: 100, totalPrice: 100 }],
    });

    const deleteRes = await request(app)
      .delete(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader);

    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.message).toMatch(/cancele a os/i);
    expect(deleteRes.body.materialsCount).toBe(0);
    expect(deleteRes.body.servicesCount).toBe(1);

    const getRes = await request(app)
      .get(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.services).toHaveLength(1);
  });
});
