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

describe('Material API', () => {
  let materialId: number;
  const materialData = {
    name: 'Material Teste',
    description: 'Descrição do material',
    price: 10.5,
    unit: 'kg',
    active: true,
  };

  it('should create a material', async () => {
    const res = await request(app)
      .post(`${API_ROOT}/materials`)
      .set(adminAuthHeader())
      .send(materialData);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    materialId = res.body.data.id;
  });

  it('should get all materials', async () => {
    const res = await request(app).get(`${API_ROOT}/materials`).set(adminAuthHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should get material by id', async () => {
    const res = await request(app).get(`${API_ROOT}/materials/${materialId}`).set(adminAuthHeader());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: materialId });
  });

  it('should update material', async () => {
    const res = await request(app)
      .put(`${API_ROOT}/materials/${materialId}`)
      .set(adminAuthHeader())
      .send({ name: 'Material Atualizado' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Material Atualizado');
  });

  it('should delete material', async () => {
    const res = await request(app).delete(`${API_ROOT}/materials/${materialId}`).set(adminAuthHeader());
    expect(res.status).toBe(204);
  });
});
