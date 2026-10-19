import { gravar, ler } from './storage';

const BASE = '/api/v1';
const CHAVE = 'promec.token';

let token: string | null = ler(CHAVE);
export const getToken = () => token;
export const setToken = (t: string | null) => {
  token = t;
  gravar(CHAVE, t);
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public codigo?: string,
    public detalhes?: unknown
  ) {
    super(message);
  }
}

export const SESSAO_EXPIRADA = 'promec:sessao-expirada';

type Opcoes = { method?: string; body?: unknown; query?: Record<string, string | number | undefined | null> };

export async function api<T>(caminho: string, { method = 'GET', body, query }: Opcoes = {}): Promise<T> {
  const qs = query
    ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString()
    : '';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${caminho}${qs ? `?${qs}` : ''}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Não conseguimos falar com o servidor. Confira a conexão e tente de novo em instantes.', 'OFFLINE');
  }

  const texto = await res.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const e = (json ?? {}) as { mensagem?: string; codigo?: string; detalhes?: unknown };
    if (res.status === 401 && caminho !== '/auth/login') {
      setToken(null);
      window.dispatchEvent(new Event(SESSAO_EXPIRADA));
    }
    throw new ApiError(res.status, e.mensagem ?? mensagemPadrao(res.status), e.codigo, e.detalhes);
  }
  return json as T;
}

function mensagemPadrao(status: number) {
  if (status === 401) return 'Sua sessão terminou. Entre de novo para continuar de onde parou.';
  if (status === 403) return 'Essa ação precisa de uma permissão que você ainda não tem. Peça a quem administra o ProMEC.';
  if (status === 404) return 'Não encontramos o que você procurava. Pode ter sido removido.';
  if (status >= 500) return 'O servidor tropeçou aqui. Tente de novo em instantes; se continuar, avise o suporte.';
  return 'Algo não saiu como esperado. Confira os dados e tente de novo.';
}

export const msgErro = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Algo não saiu como esperado. Tente de novo.';
