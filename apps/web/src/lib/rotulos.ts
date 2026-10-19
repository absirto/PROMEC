import type { CriterioRateio, TipoCentro } from '@promec/motor';
import type { Categoria, Segmento, Vinculo } from './types';

export const TIPO_CENTRO: Record<TipoCentro, string> = {
  maquina: 'Máquina',
  automatica: 'Máquina automática',
  box: 'Box / elevador',
  bancada: 'Bancada',
  celulaSolda: 'Célula de solda',
  movel: 'Equipamento móvel',
  maoDeObra: 'Mão de obra pura',
  externa: 'Serviço externo'
};

export const CRITERIO: Record<CriterioRateio, string> = {
  horas: 'por horas reais',
  valorAtivo: 'por valor do ativo',
  area: 'por área ocupada',
  faturamento: 'por faturamento',
  manual: 'por pesos manuais'
};

export const CATEGORIA: Record<Categoria, string> = {
  aluguel: 'Aluguel',
  luz: 'Luz',
  agua: 'Água',
  telefone: 'Telefone e internet',
  alarme: 'Alarme e segurança',
  contabilidade: 'Contabilidade',
  pessoalAdm: 'Pessoal administrativo',
  pessoalComercial: 'Pessoal comercial',
  proLabore: 'Pró-labore',
  seguros: 'Seguros',
  sistemas: 'Sistemas',
  tarifas: 'Tarifas',
  taxasBancarias: 'Taxas bancárias',
  treinamentos: 'Treinamentos',
  outros: 'Outros'
};

export const VINCULO: Record<Vinculo, string> = { CLT: 'CLT', PJ: 'PJ', HORISTA: 'Horista', SOCIO: 'Sócio' };
export const SEGMENTO: Record<Segmento, string> = { OFICINA: 'Oficina', USINAGEM: 'Usinagem', CALDEIRARIA: 'Caldeiraria' };

export const corTipoCentro: Record<TipoCentro, string> = {
  maquina: '#1D6FB8',
  automatica: '#0F9D76',
  box: '#5B6B7F',
  bancada: '#8C8476',
  celulaSolda: '#E35D14',
  movel: '#7C5CC4',
  maoDeObra: '#2A6AA3',
  externa: '#0E7C86'
};
