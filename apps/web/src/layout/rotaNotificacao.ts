/** Converte o link gravado pela API na rota real da tela (algumas rotas da API não existem no front). */
export function rotaNotificacao(link: string | null | undefined): { rota: string; externo: boolean } | null {
  if (!link) return null;
  if (/^https?:\/\//.test(link)) return { rota: link, externo: true };
  const [caminho = '', busca = ''] = link.split('?');
  const sp = new URLSearchParams(busca);
  const r = (rota: string) => ({ rota, externo: false });
  const tit = caminho.match(/^\/financeiro\/titulos\/([^/]+)$/);
  if (tit) return r(`/financeiro/${sp.get('tipo') === 'PAGAR' ? 'pagar' : 'receber'}?titulo=${tit[1]}`);
  if (caminho === '/financeiro/titulos') return r(sp.get('tipo') === 'PAGAR' ? '/financeiro/pagar' : '/financeiro/receber');
  if (caminho === '/financeiro/custo-fixo-realizado') return r('/financeiro/dre');
  const om = caminho.match(/^\/manutencao\/ordens\/([^/]+)$/);
  if (om) return r(`/manutencao?aba=ordens&ordem=${om[1]}`);
  const sub = caminho.match(/^\/(compras|estoque|manutencao|rh)\/([a-z-]+)$/);
  if (sub) {
    const q = new URLSearchParams(busca);
    q.set('aba', sub[2]!);
    return r(`/${sub[1]}?${q.toString()}`);
  }
  return r(link);
}
