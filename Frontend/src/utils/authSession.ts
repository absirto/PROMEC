const TOKEN_STORAGE_KEY = 'token';
const USER_STORAGE_KEY = 'user';

interface JwtPayload {
  exp?: number;
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4)) % 4;
    return atob(`${normalized}${'='.repeat(padding)}`);
  } catch {
    return null;
  }
}

function getTokenPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) {
    return null;
  }

  try {
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export function getTokenExpirationTime(token: string): number | null {
  const payload = getTokenPayload(token);
  if (typeof payload?.exp !== 'number') {
    return null;
  }

  return payload.exp * 1000;
}

export function isTokenExpired(token: string, now = Date.now()): boolean {
  const expirationTime = getTokenExpirationTime(token);
  if (!expirationTime) {
    return true;
  }

  return expirationTime <= now;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getValidStoredToken(now = Date.now()): string | null {
  const token = getStoredToken();
  if (!token) {
    return null;
  }

  if (isTokenExpired(token, now)) {
    clearStoredSession();
    return null;
  }

  return token;
}

export function getRemainingSessionTime(now = Date.now()): number | null {
  const token = getStoredToken();
  if (!token) {
    return null;
  }

  const expirationTime = getTokenExpirationTime(token);
  if (!expirationTime) {
    clearStoredSession();
    return null;
  }

  const remainingTime = expirationTime - now;
  if (remainingTime <= 0) {
    clearStoredSession();
    return null;
  }

  return remainingTime;
}