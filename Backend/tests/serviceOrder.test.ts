import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { globalSetup, globalTeardown, prisma } from './setup';
import { API_ROOT } from './authHelper';
import { JWT_SECRET } from '../src/config/security';

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

// ServiceOrderService.create() grava um ServiceOrderTrace com changedByUserId = actor.id,
// FK para User real. O adminAuthHeader() global usa um id fixo (1) que pode não existir
// no banco de testes, então aqui criamos um usuário admin de verdade para o token.
async function createAdminAuthHeader() {
  const admin = await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'Teste OS',
      email: `admin-os-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.local`,
      password: 'test1234',
      role: 'admin',
    },
  });
  const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
  return { Authorization: `Bearer ${token}` };
}

async function createPerson(corporateName: string, authHeader: { Authorization: string }) {
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

describe('POST /service-orders - validação de problemDescription', () => {
  let personId: number;
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await createAdminAuthHeader();
    personId = await createPerson('Cliente Teste OS Ltda', authHeader);
  });

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      personId,
      status: 'Orçamento',
      problemDescription: 'Equipamento não liga',
      ...overrides,
    };
  }

  it('retorna 400 com mensagem de validação legível quando problemDescription está ausente', async () => {
    const { problemDescription, ...payload } = basePayload();

    const res = await request(app)
      .post(`${API_ROOT}/service-orders`)
      .set(authHeader)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Erro de validação');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/descrição do problema/i)])
    );
  });

  it.each([null, '', '   '])('retorna 400 quando problemDescription é %p', async (value) => {
    const res = await request(app)
      .post(`${API_ROOT}/service-orders`)
      .set(authHeader)
      .send(basePayload({ problemDescription: value }));

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/descrição do problema/i)])
    );
  });

  it('cria a OS normalmente quando problemDescription é informado', async () => {
    const res = await request(app)
      .post(`${API_ROOT}/service-orders`)
      .set(authHeader)
      .send(basePayload());

    expect(res.status).toBe(201);
    expect(res.body.data.problemDescription).toBe('Equipamento não liga');
  });
});
