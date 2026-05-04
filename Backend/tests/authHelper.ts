import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'test_secret_for_jest_32chars_min!!';

export function adminAuthHeader(): { Authorization: string } {
  const token = jwt.sign(
    { id: 1, email: 'test-admin@local', role: 'admin' },
    secret,
    { expiresIn: '2h' },
  );
  return { Authorization: `Bearer ${token}` };
}

export const API_ROOT = '/v1';
