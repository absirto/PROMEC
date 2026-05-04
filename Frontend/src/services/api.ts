import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

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
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar respostas padronizadas do backend
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Se o backend retorna { status: 'success', data: ... }, entregamos apenas o data
    if (response.data && response.data.status === 'success') {
      return response.data.data;
    }
    return response.data;
  },
  (error) => {
    if (error.response && error.response.data && error.response.data.message) {
      return Promise.reject(error.response.data.message);
    }
    return Promise.reject(error);
  }
);

// Exportamos como 'any' para evitar que o TypeScript reclame nos componentes 
// sobre a mudança de estrutura causada pelo interceptor (AxiosResponse vs Data).
export default api as any;
