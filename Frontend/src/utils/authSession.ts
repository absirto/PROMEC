const USER_STORAGE_KEY = 'user';

/**
 * Limpa todos os dados de sessão do lado do cliente.
 * O token JWT agora é gerenciado via Cookie HttpOnly (servidor),
 * então aqui só limpamos os dados de UI do usuário.
 */
export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Recupera o objeto do usuário armazenado localmente (dados de UI não-sensíveis).
 */
export function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_STORAGE_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Salva os dados do usuário no localStorage (dados de UI: nome, role, permissões).
 */
export function setStoredUser(user: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}