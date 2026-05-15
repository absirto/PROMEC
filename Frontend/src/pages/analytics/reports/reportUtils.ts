import api from '../../../services/api';

export function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

export function buildReportQuery(params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function formatCurrency(value: unknown) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

export async function downloadPdfReport(path: string, fileName: string, params: Record<string, string | null | undefined>) {
  const blob = await api.get(`${path}${buildReportQuery(params)}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}