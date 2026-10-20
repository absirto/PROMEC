import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TriangleAlert } from 'lucide-react';
import { api, ApiError, msgErro } from '../../lib/api';
import type { Categoria, ComponenteDireto, CustoFixoRealizado, HistoricoCustos } from '../../lib/types';
import { brl, mesNome, pct, toNum } from '../../lib/format';
import { CATEGORIA } from '../../lib/rotulos';
import { useAcao } from '../../lib/queries';
import { Card, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Pill } from '../../components/Pill';

/** Custo fixo realizado no financeiro contra o usado na Tabela de Custos, com importação. */
export function CustoFixoRealizadoCard({ competencia }: { competencia: string }) {
  const q = useQuery({ queryKey: ['financeiro', 'custo-fixo-realizado', competencia], queryFn: () => api<CustoFixoRealizado>('/financeiro/custo-fixo-realizado', { query: { competencia } }), retry: false });
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const importar = useAcao(() => api('/custo-fixo/importar-financeiro', { method: 'POST', body: { competencia } }), {
    invalida: [['custo-fixo'], ['tabelas-custos']],
    sucesso: `Lançamentos de ${mesNome(competencia)} substituídos pelo realizado do financeiro.`,
    onSuccess: () => setConfirmar(false)
  });
  if (q.isLoading || q.isError || !q.data) return null;
  const r = q.data;
  const cats = Array.isArray(r.porCategoria) ? r.porCategoria : Object.entries(r.porCategoria ?? {}).map(([categoria, valor]) => ({ categoria: categoria as Categoria, valor: valor ?? '0' }));
  const desvio = r.desvio === null ? null : toNum(r.desvio);
  return (
    <Card className="p-5 flex flex-col gap-3" aria-labelledby="h-realizado">
      <CardHeader id="h-realizado" titulo="Realizado no financeiro" sub="Títulos a pagar que compõem o custo fixo nesta competência, pagos ou não."
        acao={<Button icone={Download} onClick={() => { setErro(null); setConfirmar(true); }}>Importar do financeiro</Button>} />
      <div className="flex flex-wrap gap-x-8 gap-y-2 items-baseline">
        <span className="flex flex-col"><span className="text-caption text-ink-3">Realizado</span><span className="mono text-[24px] font-bold">{brl(r.realizado)}</span></span>
        {r.tabela && <span className="flex flex-col"><span className="text-caption text-ink-3">Na Tabela de Custos v{r.tabela.versao}</span><span className="mono text-[18px] font-semibold text-ink-2">{brl(r.tabela.custoFixo)}</span></span>}
        {desvio !== null && <Pill tom={r.acimaDaTolerancia ? 'bad' : Math.abs(desvio) > 0.0005 ? 'warn' : 'ok'} icone={r.acimaDaTolerancia ? TriangleAlert : undefined}>{desvio > 0 ? '+' : ''}{pct(desvio)} contra a tabela</Pill>}
      </div>
      {r.acimaDaTolerancia && <p className="m-0 text-[14px] text-ink-2">O gasto real passou da tolerância. Vale revisar o custo fixo do próximo rascunho da Tabela de Custos, senão o custo-hora fica baixo.</p>}
      {cats.length > 0 && (
        <ul className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-1">
          {cats.map((c) => <li key={c.categoria} className="flex justify-between gap-3 text-[13.5px] py-1 border-b border-border"><span>{CATEGORIA[c.categoria] ?? c.categoria}</span><span className="mono">{brl(c.valor)}</span></li>)}
        </ul>
      )}
      <Modal aberto={confirmar} onFechar={() => setConfirmar(false)} faixa titulo={`Importar o realizado de ${mesNome(competencia)}?`}
        rodape={<><Button onClick={() => setConfirmar(false)}>Voltar</Button><Button variante="primario" icone={Download} carregando={importar.isPending}
          onClick={() => importar.mutate(undefined, { onError: (e) => setErro(e instanceof ApiError && e.codigo === 'TABELA_VIGENTE' ? 'Esse mês já tem Tabela de Custos vigente, e ela não muda depois de publicada. Importe num mês ainda sem tabela, ou crie um rascunho novo.' : msgErro(e)) })}>Substituir lançamentos</Button></>}>
        <p className="m-0 text-ink-2">Os lançamentos do custo fixo deste mês são trocados pelo realizado por categoria ({brl(r.realizado)}). Serve para fechar o mês com o que de fato foi gasto.</p>
        {erro && <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{erro}</p>}
      </Modal>
    </Card>
  );
}

const COMP: { k: ComponenteDireto; rotulo: string; cor: string }[] = [
  { k: 'manutencao', rotulo: 'Manutenção', cor: 'var(--pm-chart-hora)' },
  { k: 'insumos', rotulo: 'Insumos', cor: 'var(--pm-chart-setup)' },
  { k: 'energia', rotulo: 'Energia', cor: 'var(--pm-chart-impostos)' },
  { k: 'outros', rotulo: 'Outros', cor: '#B5AC9C' }
];

/** Gasto direto do centro mês a mês (financeiro + estoque) e a média proposta para o cadastro. */
export function HistoricoCustosCentro({ centroId, atual, onUsarMedia }: { centroId: string; atual: Partial<Record<ComponenteDireto, string>>; onUsarMedia?: (m: Partial<Record<ComponenteDireto, string>>) => void }) {
  const q = useQuery({ queryKey: ['centros-trabalho', centroId, 'historico-custos'], queryFn: () => api<HistoricoCustos>(`/centros-trabalho/${centroId}/historico-custos`, { query: { meses: 6 } }), retry: false });
  if (!q.data) return null;
  const meses = q.data.meses ?? [];
  const valorDe = (m: (typeof meses)[number], k: ComponenteDireto) => toNum((m.componentes as Record<string, string> | undefined)?.[k] ?? (m as unknown as Record<string, string>)[k]);
  const max = Math.max(1, ...meses.map((m) => COMP.reduce((a, c) => a + valorDe(m, c.k), 0)), ...COMP.map((c) => toNum(atual[c.k])));
  const media = q.data.mediaProposta ?? {};
  const diferente = COMP.some((c) => media[c.k] !== undefined && Math.abs(toNum(media[c.k]) - toNum(atual[c.k])) > 0.5);
  return (
    <Card className="p-5 flex flex-col gap-3" aria-labelledby="h-hist-custos">
      <CardHeader id="h-hist-custos" titulo="O que o centro gastou de verdade" sub="Títulos com custo direto deste centro e insumos que saíram do estoque, nos últimos meses." />
      {meses.length === 0 ? <p className="m-0 text-[14px] text-ink-2">Nenhum gasto direto registrado ainda.</p> : (
        <div className="flex items-end gap-2 h-[150px]" role="img" aria-label={`Gasto direto por mês: ${meses.map((m) => `${mesNome(m.competencia)} ${brl(m.total)}`).join(', ')}`}>
          {meses.map((m) => (
            <div key={m.competencia} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
              <span className="mono text-[11px] text-ink-3">{brl(m.total).replace('R$ ', '')}</span>
              <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: `${(COMP.reduce((a, c) => a + valorDe(m, c.k), 0) / max) * 110}px` }}>
                {COMP.map((c) => { const v = valorDe(m, c.k); return v > 0 ? <span key={c.k} style={{ height: `${(v / max) * 110}px`, background: c.cor }} title={`${c.rotulo}: ${brl(v)}`} /> : null; })}
              </div>
              <span className="text-[11.5px] text-ink-3">{mesNome(m.competencia).slice(0, 3)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-caption text-ink-2">{COMP.map((c) => <span key={c.k} className="inline-flex items-center gap-1.5"><span className="size-3 rounded" style={{ background: c.cor }} />{c.rotulo}</span>)}</div>
      <dl className="m-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {COMP.filter((c) => media[c.k] !== undefined).map((c) => (
          <div key={c.k} className="p-2.5 rounded-field bg-surface-2">
            <dt className="text-caption text-ink-3">{c.rotulo}</dt>
            <dd className="m-0 mono text-[14px]"><strong>{brl(media[c.k])}</strong> <span className="text-ink-3">cadastro {brl(atual[c.k] ?? 0)}</span></dd>
          </div>
        ))}
      </dl>
      {diferente && onUsarMedia && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-field bg-warn-soft text-[14px]">
          <span className="flex-1 min-w-[200px]">A média real está diferente do cadastro. Usar a média deixa o próximo custo-hora mais perto da realidade.</span>
          <Button tamanho="sm" onClick={() => onUsarMedia(media)}>Usar a média proposta</Button>
        </div>
      )}
    </Card>
  );
}
