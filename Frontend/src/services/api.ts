import axios, { AxiosResponse } from 'axios';
import { clearStoredSession } from '../utils/authSession';

function redirectToLogin() {
  if (typeof window === 'undefined') return;

  clearStoredSession();

  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:3001/v1'
  : '/v1';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultApiUrl,
  withCredentials: true, // Envia cookies HttpOnly automaticamente
  headers: {
    'Content-Type': 'application/json',
  },
});

// O token JWT agora é enviado automaticamente via Cookie HttpOnly.
// Não é mais necessário um interceptor de request para injetar o header Authorization.

// Interceptor para tratar respostas padronizadas do backend
api.interceptors.response.use(
  (response: AxiosResponse) => {
    let result = response.data;
    
    // Unwraps { status: 'success', data: ... }
    if (result && result.status === 'success') {
      // Se for um envelope de sucesso paginado, não removemos o envelope agora,
      // pois precisamos das propriedades 'data' e 'meta' no bloco seguinte.
      if (!(Array.isArray(result.data) && result.meta)) {
        result = result.data;
      }
    }

    // Se for um objeto paginado { data: [], meta: {} }
    // Retornamos a array de dados, mas anexamos o 'meta' como uma propriedade oculta.
    // Isso evita quebrar o .map() e permite acessar .meta se necessário.
    if (result && !Array.isArray(result) && Array.isArray(result.data)) {
      const dataArray = result.data;
      
      // Anexa os metadados
      Object.defineProperty(dataArray, 'meta', {
        value: result.meta,
        enumerable: false,
        configurable: true
      });

      // NOVIDADE: Permite que componentes que fazem res.data ainda funcionem
      // mesmo que o interceptor tenha retornado a array diretamente.
      Object.defineProperty(dataArray, 'data', {
        value: dataArray,
        enumerable: false,
        configurable: true
      });

      Object.defineProperty(dataArray, 'isPaginated', {
        value: true,
        enumerable: false,
        configurable: true
      });

      return dataArray;
    }

    // Se for uma array simples ou objeto simples, também anexamos .data para compatibilidade
    if (result && typeof result === 'object') {
       if (!Object.prototype.hasOwnProperty.call(result, 'data')) {
         Object.defineProperty(result, 'data', {
            value: result,
            enumerable: false,
            configurable: true
         });
       }
    }

    return result;
  },
  (error: any) => {
    if (error.response && error.response.data) {
      const data = error.response.data;
      const message = typeof data === 'string'
        ? data
        : typeof data?.message === 'string'
          ? data.message
          : typeof data?.error === 'string'
            ? data.error
            : undefined;

      if (error.response.status === 401 || message === 'Token inválido' || message === 'Não autenticado') {
        redirectToLogin();
      }

      // Preserva payload completo para telas que precisam renderizar detalhes de conflito.
      if (data.conflicts || data.externalConflicts || data.internalConflicts) {
        return Promise.reject(data);
      }

      if (message) {
        return Promise.reject(message);
      }

      return Promise.reject('Erro inesperado ao comunicar com o servidor.');
    }

    if (error?.message) {
      return Promise.reject(error.message);
    }

    return Promise.reject('Erro inesperado ao comunicar com o servidor.');
  }
);

export interface CustomAxiosInstance {
  defaults: typeof api.defaults;
  interceptors: typeof api.interceptors;
  get<T = any>(url: string, config?: any): Promise<T>;
  post<T = any>(url: string, data?: any, config?: any): Promise<T>;
  put<T = any>(url: string, data?: any, config?: any): Promise<T>;
  delete<T = any>(url: string, config?: any): Promise<T>;
  patch<T = any>(url: string, data?: any, config?: any): Promise<T>;
  request<T = any>(config: any): Promise<T>;
}

export default api as unknown as CustomAxiosInstance;
