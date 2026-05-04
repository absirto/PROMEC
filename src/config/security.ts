const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.trim().length === 0) {
  throw new Error('JWT_SECRET não configurado. Defina a variável de ambiente JWT_SECRET.');
}

if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET muito curto. Use no mínimo 32 caracteres para segurança adequada.');
}

export const JWT_SECRET = jwtSecret;
