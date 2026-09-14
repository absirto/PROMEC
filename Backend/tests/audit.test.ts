import request from 'supertest';
import app from '../src/app';
import { globalSetup, globalTeardown } from './setup';
import { API_ROOT, adminAuthHeader } from './authHelper';

beforeAll(async () => {
  await globalSetup();
});

afterAll(async () => {
  await globalTeardown();
});

describe('Audit log', () => {
  it('should record CREATE/UPDATE/DELETE entries for a work area and expose them via the audit endpoint', async () => {
    const createRes = await request(app)
      .post(`${API_ROOT}/work-areas`)
      .set(adminAuthHeader())
      .send({ name: `Área Auditoria ${Date.now()}` });
    expect(createRes.status).toBe(201);
    const workAreaId = createRes.body.data.id;

    await request(app)
      .put(`${API_ROOT}/work-areas/${workAreaId}`)
      .set(adminAuthHeader())
      .send({ name: 'Área Auditoria Atualizada' });

    await request(app)
      .delete(`${API_ROOT}/work-areas/${workAreaId}`)
      .set(adminAuthHeader());

    const auditRes = await request(app)
      .get(`${API_ROOT}/audit/WorkArea/${workAreaId}`)
      .set(adminAuthHeader());

    expect(auditRes.status).toBe(200);
    const entries: any[] = auditRes.body.data;
    expect(Array.isArray(entries)).toBe(true);

    const actions = entries.map((e) => e.action).sort();
    expect(actions).toEqual(['CREATE', 'DELETE', 'UPDATE']);
    entries.forEach((e) => expect(e.entity).toBe('WorkArea'));
  });
});
