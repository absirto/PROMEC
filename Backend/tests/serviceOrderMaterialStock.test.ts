import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import prisma from '../src/core/prisma';
import { JWT_SECRET } from '../src/config/security';
import { globalSetup, globalTeardown } from './setup';
import { API_ROOT } from './authHelper';

beforeAll(async () => {
  await globalSetup();
});

afterAll(async () => {
  await globalTeardown();
});

function uniqueCpf() {
  return String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10);
}

// ServiceOrderService grava um ServiceOrderTrace com FK real para User (changedByUserId),
// então o token de teste precisa apontar para um usuário existente no banco
// (diferente do adminAuthHeader() genérico usado pelos demais módulos, que não têm essa FK).
async function createAdminAuthHeader() {
  const user = await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'Teste OS x Estoque',
      email: `admin-os-estoque-${Date.now()}@teste.local`,
      password: 'not-used-in-tests',
      role: 'admin',
    }
  });
  const token = jwt.sign({ id: user.id, email: user.email, role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
  return { Authorization: `Bearer ${token}` };
}

async function availableQty(materialId: number) {
  const logs = await prisma.stockLog.findMany({ where: { materialId }, select: { type: true, quantity: true } });
  return logs.reduce((acc, log) => acc + (log.type === 'IN' ? Number(log.quantity) : -Number(log.quantity)), 0);
}

describe('Baixa automática de estoque ao vincular material à OS', () => {
  let materialId: number;
  let personId: number;
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await createAdminAuthHeader();

    const materialRes = await request(app)
      .post(`${API_ROOT}/materials`)
      .set(authHeader)
      .send({
        name: 'Material Teste - Baixa Automática OS',
        description: 'Material usado nos testes de integração OS x Estoque',
        price: 5,
        unit: 'un',
        active: true,
      });
    expect(materialRes.status).toBe(201);
    materialId = materialRes.body.data.id;

    const person = await prisma.person.create({
      data: {
        type: 'F',
        naturalPerson: {
          create: {
            cpf: uniqueCpf(),
            name: 'Cliente Teste - Baixa Automática OS',
          }
        }
      }
    });
    personId = person.id;

    const stockRes = await request(app)
      .post(`${API_ROOT}/stock`)
      .set(authHeader)
      .send({
        materialId,
        quantity: 10,
        type: 'IN',
        description: 'Compra inicial para teste',
        supplierPersonId: personId,
        unitCost: 5,
      });
    expect(stockRes.status).toBe(201);
    expect(await availableQty(materialId)).toBe(10);
  });

  let orderId: number;
  let traceCode: string;

  it('cria um StockLog OUT (FIFO) ao vincular material a uma nova OS', async () => {
    const res = await request(app)
      .post(`${API_ROOT}/service-orders`)
      .set(authHeader)
      .send({
        personId,
        status: 'Aberta',
        description: 'OS de teste - consumo inicial de material',
        problemDescription: 'Problema relatado para teste',
        materials: [
          { materialId, quantity: 4, unitPrice: 8, totalPrice: 32 }
        ]
      });

    expect(res.status).toBe(201);
    orderId = res.body.data.id;
    traceCode = res.body.data.traceCode;

    expect(await availableQty(materialId)).toBe(6);

    const outLogs = await prisma.stockLog.findMany({ where: { materialId, type: 'OUT' } });
    expect(outLogs).toHaveLength(1);
    expect(outLogs[0].quantity).toBe(4);
    expect(outLogs[0].unitCost).toBe(5);
    expect(outLogs[0].description).toContain(traceCode);
  });

  it('consome apenas o delta quando a quantidade aumenta em uma atualização', async () => {
    const res = await request(app)
      .put(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader)
      .send({
        personId,
        status: 'Aberta',
        materials: [
          { materialId, quantity: 7, unitPrice: 8, totalPrice: 56 }
        ]
      });

    expect(res.status).toBe(200);
    expect(await availableQty(materialId)).toBe(3);

    const outLogs = await prisma.stockLog.findMany({ where: { materialId, type: 'OUT' }, orderBy: { id: 'asc' } });
    expect(outLogs).toHaveLength(2);
    expect(outLogs[1].quantity).toBe(3);
    expect(outLogs[1].unitCost).toBe(5);
  });

  it('devolve ao estoque (StockLog IN) quando a quantidade diminui em uma atualização', async () => {
    const res = await request(app)
      .put(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader)
      .send({
        personId,
        status: 'Aberta',
        materials: [
          { materialId, quantity: 2, unitPrice: 8, totalPrice: 16 }
        ]
      });

    expect(res.status).toBe(200);
    expect(await availableQty(materialId)).toBe(8);

    const returnLogs = await prisma.stockLog.findMany({
      where: { materialId, type: 'IN', description: { contains: 'Devolução' } }
    });
    expect(returnLogs).toHaveLength(1);
    expect(returnLogs[0].quantity).toBe(5);
    expect(returnLogs[0].remainingQty).toBe(5);
  });

  it('não gera nenhuma movimentação ao salvar a OS novamente com os mesmos materiais', async () => {
    const logsBefore = await prisma.stockLog.count({ where: { materialId } });

    const res = await request(app)
      .put(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader)
      .send({
        personId,
        status: 'Aberta',
        materials: [
          { materialId, quantity: 2, unitPrice: 8, totalPrice: 16 }
        ]
      });

    expect(res.status).toBe(200);

    const logsAfter = await prisma.stockLog.count({ where: { materialId } });
    expect(logsAfter).toBe(logsBefore);
    expect(await availableQty(materialId)).toBe(8);
  });

  it('devolve o saldo integral ao remover o material da OS', async () => {
    const res = await request(app)
      .put(`${API_ROOT}/service-orders/${orderId}`)
      .set(authHeader)
      .send({
        personId,
        status: 'Aberta',
        materials: []
      });

    expect(res.status).toBe(200);
    expect(res.body.data.materials).toHaveLength(0);
    expect(await availableQty(materialId)).toBe(10);
  });

  it('bloqueia a criação da OS quando o estoque é insuficiente (rollback atômico)', async () => {
    const availableBefore = await availableQty(materialId);

    const res = await request(app)
      .post(`${API_ROOT}/service-orders`)
      .set(authHeader)
      .send({
        personId,
        status: 'Aberta',
        description: 'OS de teste - estoque insuficiente',
        problemDescription: 'Problema relatado para teste',
        materials: [
          { materialId, quantity: availableBefore + 50, unitPrice: 8, totalPrice: 8 * (availableBefore + 50) }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.materialId).toBe(materialId);
    expect(res.body.requestedQty).toBe(availableBefore + 50);
    expect(res.body.availableQty).toBe(availableBefore);

    expect(await availableQty(materialId)).toBe(availableBefore);
  });

  it('bloqueia a atualização da OS quando o estoque é insuficiente, sem alterar os materiais existentes', async () => {
    const createRes = await request(app)
      .post(`${API_ROOT}/service-orders`)
      .set(authHeader)
      .send({
        personId,
        status: 'Aberta',
        description: 'OS de teste - update com estoque insuficiente',
        problemDescription: 'Problema relatado para teste',
        materials: [
          { materialId, quantity: 3, unitPrice: 8, totalPrice: 24 }
        ]
      });
    expect(createRes.status).toBe(201);
    const secondOrderId = createRes.body.data.id;
    const availableAfterCreate = await availableQty(materialId);

    const updateRes = await request(app)
      .put(`${API_ROOT}/service-orders/${secondOrderId}`)
      .set(authHeader)
      .send({
        personId,
        status: 'Aberta',
        materials: [
          { materialId, quantity: availableAfterCreate + 999, unitPrice: 8, totalPrice: 8 }
        ]
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.materialId).toBe(materialId);

    expect(await availableQty(materialId)).toBe(availableAfterCreate);

    const getRes = await request(app)
      .get(`${API_ROOT}/service-orders/${secondOrderId}`)
      .set(authHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.materials).toHaveLength(1);
    expect(getRes.body.data.materials[0].quantity).toBe(3);
  });
});
