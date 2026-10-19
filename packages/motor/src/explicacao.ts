import { txt, type Dec } from './numero.js';

/** Nó da árvore "como chegamos nesse valor": cada número sabe de onde veio. */
export interface NoExplicacao {
  rotulo: string;
  valor: string;
  unidade?: 'R$' | 'R$/h' | 'h' | '%' | 'kg' | 'un';
  formula?: string;
  filhos?: NoExplicacao[];
}

export const no = (
  rotulo: string,
  valor: Dec,
  extra: Omit<NoExplicacao, 'rotulo' | 'valor'> = {}
): NoExplicacao => ({ rotulo, valor: txt(valor), ...extra });
