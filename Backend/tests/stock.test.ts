import request from 'supertest';
import app from '../src/app';
import prisma from '../src/core/prisma';
import { globalSetup, globalTeardown } from './setup';
import { adminAuthHeader, API_ROOT } from './authHelper';

beforeAll(async () => {
  await globalSetup();
});

afterAll(async () => {
  await globalTeardown();
});

describe('Stock API (movimentação manual)', () => {
  let materialId: number;
  let supplierPersonId: number;

  beforeAll(async () => {
    const materialRes = await request(app)
      .post(`${API_ROOT}/materials`)
      .set(adminAuthHeader())
      .send({
        name: 'Material Teste - Movimentação Manual',
        description: 'Material usado nos testes de regressão do StockController',
        price: 2,
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
            cpf: String(Date.now()).slice(-9) + '11',
            name: 'Fornecedor Teste - Movimentação Manual',
          }
        }
      }
    });
    supplierPersonId = person.id;
  });

  it('registra uma entrada (IN) de estoque', async () => {
    const res = await request(app)
      .post(`${API_ROOT}/stock`)
      .set(adminAuthHeader())
      .send({
        materialId,
        quantity: 20,
        type: 'IN',
        description: 'Compra teste',
        supplierPersonId,
        unitCost: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('IN');
    expect(res.body.data.remainingQty).toBe(20);
    expect(res.body.data.unitCost).toBe(2);
  });

  it('registra uma saída (OUT) consumindo FIFO do lote existente', async () => {
    const res = await request(app)
      .post(`${API_ROOT}/stock`)
      .set(adminAuthHeader())
      .send({
        materialId,
        quantity: 5,
        type: 'OUT',
        description: 'Consumo manual teste',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('OUT');
    expect(res.body.data.quantity).toBe(5);
    expect(res.body.data.unitCost).toBe(2);
    expect(res.body.data.remainingQty).toBe(0);
  });

  it('mantém o formato de erro original ao tentar dar saída maior que o estoque disponível', async () => {
    const res = await request(app)
      .post(`${API_ROOT}/stock`)
      .set(adminAuthHeader())
      .send({
        materialId,
        quantity: 1000,
        type: 'OUT',
        description: 'Consumo acima do saldo',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Estoque insuficiente para a saída informada.');
    expect(res.body.status).toBeUndefined();
  });
});
