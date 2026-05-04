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

describe('WorkArea API', () => {
  let workAreaId: number;
  const workAreaData = { name: `Área ${Date.now()}` };

  it('should create a work area', async () => {
    const res = await request(app).post(`${API_ROOT}/work-areas`).set(adminAuthHeader()).send(workAreaData);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    workAreaId = res.body.data.id;
  });

  it('should get all work areas', async () => {
    const res = await request(app).get(`${API_ROOT}/work-areas`).set(adminAuthHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should get work area by id', async () => {
    const res = await request(app).get(`${API_ROOT}/work-areas/${workAreaId}`).set(adminAuthHeader());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: workAreaId });
  });

  it('should update work area', async () => {
    const res = await request(app)
      .put(`${API_ROOT}/work-areas/${workAreaId}`)
      .set(adminAuthHeader())
      .send({ name: 'Área Atualizada' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Área Atualizada');
  });

  it('should delete work area', async () => {
    const res = await request(app).delete(`${API_ROOT}/work-areas/${workAreaId}`).set(adminAuthHeader());
    expect(res.status).toBe(204);
  });
});
