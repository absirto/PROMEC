import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { globalSetup, globalTeardown } from './setup';
import { API_ROOT } from './authHelper';

beforeAll(async () => {
  await globalSetup();
});

afterAll(async () => {
  await globalTeardown();
});

describe('Authorization by permission key', () => {
  const noPermHeader = () => {
    const token = jwt.sign(
      { id: 999999, email: 'no-perm@local', role: 'user' },
      process.env.JWT_SECRET || 'test_secret_for_jest_32chars_min!!',
      { expiresIn: '1h' },
    );
    return { Authorization: `Bearer ${token}` };
  };

  it('should return 403 when token has no required permission', async () => {
    const res = await request(app)
      .get(`${API_ROOT}/users`)
      .set(noPermHeader());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Permissão insuficiente');
  });

  it('should return 403 for finance summary without permission', async () => {
    const res = await request(app)
      .get(`${API_ROOT}/finance/summary`)
      .set(noPermHeader());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Permissão insuficiente');
  });

  it('should return 403 for stock list without permission', async () => {
    const res = await request(app)
      .get(`${API_ROOT}/stock`)
      .set(noPermHeader());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Permissão insuficiente');
  });

  it('should return 403 for reports without permission', async () => {
    const res = await request(app)
      .get(`${API_ROOT}/reports/operational/service-orders`)
      .set(noPermHeader());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Permissão insuficiente');
  });

  it('should return 403 for external lookup when public mode is disabled', async () => {
    const res = await request(app)
      .get(`${API_ROOT}/external/cnpj/12345678000195`)
      .set(noPermHeader());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Permissão insuficiente');
  });

  it('should return 403 for register when public mode is disabled', async () => {
    const res = await request(app)
      .post(`${API_ROOT}/auth/register`)
      .set(noPermHeader())
      .send({
        firstName: 'No',
        lastName: 'Perm',
        email: `noperm_${Date.now()}@mail.com`,
        password: 'secret123',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Permissão insuficiente');
  });
});
