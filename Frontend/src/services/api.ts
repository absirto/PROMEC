import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { clearStoredSession, getValidStoredToken } from '../utils/authSession';

function redirectToLogin() {
  if (typeof window === 'undefined') return;

  clearStoredSession();

  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

const defaultApiUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001/v1'
  : '/v1';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || defaultApiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token JWT automaticamente
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getValidStoredToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

// Interceptor para tratar respostas padronizadas do backend
api.interceptors.response.use(
  (response: AxiosResponse) => {
    let result = response.data;
    
    // Unwraps { status: 'success', data: ... }
    if (result && result.status === 'success') {
      result = result.data;
    }

    // Se for um objeto paginado { data: [], meta: {} }
    // Retornamos a array de dados, mas anexamos o 'meta' como uma propriedade oculta.
    // Isso evita quebrar o .map() e permite acessar .meta se necessário.
    if (result && !Array.isArray(result) && Array.isArray(result.data)) {
      const dataArray = result.data;
      // Anexa os metadados diretamente na array
      Object.defineProperty(dataArray, 'meta', {
        value: result.meta,
        enumerable: false, // não aparece em loops normais
        configurable: true
      });
      Object.defineProperty(dataArray, 'isPaginated', {
        value: true,
        enumerable: false,
        configurable: true
      });
      return dataArray;
    }

    return result;
  },
  (error) => {
    if (error.response && error.response.data) {
      const data = error.response.data;
      const message = typeof data === 'string'
        ? data
        : typeof data?.message === 'string'
          ? data.message
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

// Exportamos como 'any' para evitar que o TypeScript reclame nos componentes 
// sobre a mudança de estrutura causada pelo interceptor (AxiosResponse vs Data).
export default api as any;
