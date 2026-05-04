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

describe('Settings API', () => {
  it('should get settings singleton', async () => {
    const res = await request(app).get(`${API_ROOT}/settings`).set(adminAuthHeader());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
  });

  it('should update settings via PUT', async () => {
    const res = await request(app)
      .put(`${API_ROOT}/settings`)
      .set(adminAuthHeader())
      .send({ backgroundImageUrl: 'http://imagem.com/bg2.png', companyName: 'ProMEC Test' });
    expect(res.status).toBe(200);
    expect(res.body.data.backgroundImageUrl).toBe('http://imagem.com/bg2.png');
    expect(res.body.data.companyName).toBe('ProMEC Test');
  });
});
