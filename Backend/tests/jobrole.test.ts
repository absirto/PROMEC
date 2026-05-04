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

describe('JobRole API', () => {
  let jobRoleId: number;
  const jobRoleData = { name: `Cargo ${Date.now()}` };

  it('should create a job role', async () => {
    const res = await request(app).post(`${API_ROOT}/job-roles`).set(adminAuthHeader()).send(jobRoleData);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    jobRoleId = res.body.data.id;
  });

  it('should get all job roles', async () => {
    const res = await request(app).get(`${API_ROOT}/job-roles`).set(adminAuthHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should get job role by id', async () => {
    const res = await request(app).get(`${API_ROOT}/job-roles/${jobRoleId}`).set(adminAuthHeader());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: jobRoleId });
  });

  it('should update job role', async () => {
    const res = await request(app)
      .put(`${API_ROOT}/job-roles/${jobRoleId}`)
      .set(adminAuthHeader())
      .send({ name: 'Cargo Atualizado' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Cargo Atualizado');
  });

  it('should delete job role', async () => {
    const res = await request(app).delete(`${API_ROOT}/job-roles/${jobRoleId}`).set(adminAuthHeader());
    expect(res.status).toBe(204);
  });
});
