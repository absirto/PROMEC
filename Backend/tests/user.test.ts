import request from 'supertest';
import app from '../src/app';
import { globalSetup, globalTeardown, prisma } from './setup';
import { adminAuthHeader, API_ROOT } from './authHelper';

beforeAll(async () => {
  await globalSetup();
});

afterAll(async () => {
  await globalTeardown();
});

describe('User API', () => {
  let userId: number;
  let groupId: number;

  beforeAll(async () => {
    const group = await prisma.group.upsert({
      where: { name: 'TestUsersGroup' },
      update: {},
      create: { name: 'TestUsersGroup', description: 'jest' },
    });
    groupId = group.id;
  });

  const buildUserPayload = () => ({
    firstName: 'Test',
    lastName: 'User',
    email: `testuser_${Date.now()}@mail.com`,
    password: 'test1234',
    role: 'user',
    groupId,
  });

  it('should create a user', async () => {
    const res = await request(app)
      .post(`${API_ROOT}/users`)
      .set(adminAuthHeader())
      .send(buildUserPayload());
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    userId = res.body.data.id;
  });

  it('should get all users', async () => {
    const res = await request(app).get(`${API_ROOT}/users`).set(adminAuthHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should get user by id', async () => {
    const res = await request(app).get(`${API_ROOT}/users/${userId}`).set(adminAuthHeader());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: userId });
  });

  it('should update user', async () => {
    const res = await request(app)
      .put(`${API_ROOT}/users/${userId}`)
      .set(adminAuthHeader())
      .send({ firstName: 'Updated', groupId });
    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe('Updated');
  });

  it('should delete user', async () => {
    const res = await request(app).delete(`${API_ROOT}/users/${userId}`).set(adminAuthHeader());
    expect(res.status).toBe(204);
  });
});
