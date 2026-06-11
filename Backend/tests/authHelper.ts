import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../src/config/security';

export function adminAuthHeader(): { Authorization: string } {
  const token = jwt.sign(
    { id: 1, email: 'test-admin@local', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '2h' },
  );
  return { Authorization: `Bearer ${token}` };
}

export const API_ROOT = '/v1';
