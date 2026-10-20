import { createHmac, timingSafeEqual } from 'node:crypto';

export type TipoLink = 'ORCAMENTO' | 'OS';
interface Carga {
  t: string;
  k: TipoLink;
  id: string;
  v: number;
  exp: number;
}

const segredo = () => process.env.PORTAL_SECRET || process.env.JWT_SECRET || 'promec-dev';
const b64 = (b: Buffer) => b.toString('base64url');
const assinatura = (carga: string) => b64(createHmac('sha256', segredo()).update(carga).digest());

export function assinarLink(c: Carga) {
  const carga = b64(Buffer.from(JSON.stringify(c)));
  return `${carga}.${assinatura(carga)}`;
}

/** Carga do token se a assinatura confere e ainda não venceu; senão null. */
export function lerLink(token: string): Carga | null {
  const [carga, sig] = token.split('.');
  if (!carga || !sig) return null;
  const esperado = Buffer.from(assinatura(carga));
  const recebido = Buffer.from(sig);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  try {
    const c = JSON.parse(Buffer.from(carga, 'base64url').toString()) as Carga;
    return c.exp * 1000 > Date.now() ? c : null;
  } catch {
    return null;
  }
}
