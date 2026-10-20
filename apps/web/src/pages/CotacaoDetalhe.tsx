import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Save, Trophy } from 'lucide-react';
import { api, ApiError, msgErro } from '../lib/api';
import type { Cotacao, Fornecedor, Lista } from '../lib/types';
import { brl, data, num, pct, toNum } from '../lib/format';
import { useAcao } from '../lib/queries';
import { rankingCotacao, type LinhaRanking } from '../features/suprimentos/sup';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Aviso, Carregando, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { NumberField, TextArea } from '../components/Field';
import { Estrelas } from '../components/Estrelas';
import { useToast } from '../components/Toast';
import { useTitulo } from '../layout/titulo';

type Rascunho = { precos: Record<string, string>; frete: string; prazo: string };
type Resposta = { fornecedorId: string; nome: string; precos: Record<string, number>; itens: number; frete: number; prazoDias: number; avaliacao: string };

const comoLista = <T,>(d: T[] | Lista<T> | null | undefined): T[] => (!d ? [] : Array.isArray(d) ? d : d.itens ?? []);
const igual = (a?: Rascunho, b?: Rascunho) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

function deResposta(c: Cotacao, fornecedorId: string): Rascunho {
  const r = c.respostas?.find((x) => x.fornecedorId === fornecedorId);
  return {
    precos: Object.fromEntries(c.itens.map((i) => [i.itemId, r?.itens.find((x) => x.itemId === i.itemId)?.precoUnitario ?? ''])),
    frete: r ? String(r.frete ?? '') : '',
    prazo: r ? String(r.prazoDias ?? '') : ''
  };
}

function montar(c: Cotacao, f: { id: string; nome: string; avaliacao: string }, r: Rascunho): Resposta | null {
  if (r.prazo === '' || c.itens.some((i) => !(toNum(r.precos[i.itemId]) > 0))) return null;
  const precos = Object.fromEntries(c.itens.map((i) => [i.itemId, toNum(r.precos[i.itemId])]));
  const itens = c.itens.reduce((a, i) => a + precos[i.itemId]! * toNum(i.quantidade), 0);
  return { fornecedorId: f.id, nome: f.nome, precos, itens, frete: toNum(r.frete), prazoDias: Math.round(toNum(r.prazo)), avaliacao: f.avaliacao };
}

const ranquear = (rs: Resposta[]): LinhaRanking[] =>
  rankingCotacao(rs.map((r) => ({ fornecedorId: r.fornecedorId, nome: r.nome, precoUnitario: String(r.itens), quantidade: '1', frete: String(r.frete), prazoDias: r.prazoDias, avaliacao: r.avaliacao || '3' })));

export default function CotacaoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['compras', 'cotacoes', id], queryFn: () => api<Cotacao>(`/compras/cotacoes/${id}`), enabled: !!id });
  const fq = useQuery({ queryKey: ['fornecedores'], queryFn: () => api<Fornecedor[] | Lista<Fornecedor>>('/fornecedores') });
  const c = q.data;
  useTitulo(c?.numero ? `Cotação ${c.numero}` : 'Cotação');
  const [rasc, setRasc] = useState<Record<string, Rascunho>>({});
  const [justificar, setJustificar] = useState<LinhaRanking | null>(null);
  const [justificativa, setJustificativa] = useState('');

  const cadastro = useMemo(() => new Map(comoLista(fq.data).map((f) => [f.id, f])), [fq.data]);
  const fornecedores = useMemo(
    () => (c?.fornecedores ?? []).map((f) => ({ ...f, avaliacao: f.avaliacao ?? cadastro.get(f.id)?.avaliacao ?? '', prazoMedioDias: f.prazoMedioDias ?? cadastro.get(f.id)?.prazoMedioDias })),
    [c, cadastro]
  );

  useEffect(() => {
    if (!c) return;
    setRasc((atual) => {
      const n = { ...atual };
      c.fornecedores.forEach((f) => { if (!n[f.id]) n[f.id] = deResposta(c, f.id); });
      return n;
    });
  }, [c]);

  const salvar = useAcao(
    (b: { fornecedorId: string; itens: { itemId: string; precoUnitario: string }[]; frete: string; prazoDias: number }) => api(`/compras/cotacoes/${id}/respostas`, { method: 'POST', body: b }),
    {
      sucesso: (_r, v) => `Resposta de ${fornecedores.find((f) => f.id === v.fornecedorId)?.nome ?? 'fornecedor'} guardada. O comparativo já considera esses valores.`,
      onSuccess: (_r, v) => {
        qc.setQueryData<Cotacao>(['compras', 'cotacoes', id], (old) =>
          old ? { ...old, respostas: [...(old.respostas ?? []).filter((x) => x.fornecedorId !== v.fornecedorId), v] } : old
        );
        qc.invalidateQueries({ queryKey: ['compras'] });
      }
    }
  );

  const escolher = useMutation({
    mutationFn: (b: { fornecedorId: string; justificativa?: string }) => api<Record<string, unknown> | null>(`/compras/cotacoes/${id}/escolher`, { method: 'POST', body: b }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['compras'] });
      setJustificar(null);
      const pedidoId =
        (r?.pedidoId as string | undefined) ?? ((r?.pedido as { id?: string } | undefined)?.id) ?? (r && 'fornecedor' in r && 'total' in r ? (r.id as string) : undefined);
      const numero = r?.numero as string | undefined;
      toast(`${numero ? `Pedido ${numero}` : 'Pedido'} gerado. Se passar do limite de compra, ele espera a aprovação do gestor.`, 'ok');
      navigate(pedidoId ? `/compras/pedidos/${pedidoId}` : '/compras?aba=pedidos');
    },
    onError: (e, v) => {
      if (e instanceof ApiError && e.codigo === 'JUSTIFICATIVA_OBRIGATORIA') {
        const linha = rankingSalvo.find((x) => x.fornecedorId === v.fornecedorId);
        setJustificar(linha ?? { fornecedorId: v.fornecedorId, nome: fornecedores.find((f) => f.id === v.fornecedorId)?.nome ?? '', total: '0', nota: '0', posicao: 2, melhorPreco: false, melhorPrazo: false, prazoDias: 0, rotulo: '' });
        return;
      }
      toast(msgErro(e), 'bad');
    }
  });

  const respostasVivas = useMemo(
    () => (c ? fornecedores.map((f) => montar(c, f, rasc[f.id] ?? deResposta(c, f.id))).filter((x): x is Resposta => !!x) : []),
    [c, fornecedores, rasc]
  );
  const respostasSalvas = useMemo(
    () => (c ? fornecedores.filter((f) => c.respostas?.some((r) => r.fornecedorId === f.id)).map((f) => montar(c, f, deResposta(c, f.id))).filter((x): x is Resposta => !!x) : []),
    [c, fornecedores]
  );
  const ranking = useMemo(() => ranquear(respostasVivas), [respostasVivas]);
  const rankingSalvo = useMemo(() => ranquear(respostasSalvas), [respostasSalvas]);

  if (q.isLoading) return <Card><Carregando rotulo="Carregando cotação" /></Card>;
  if (q.isError || !c) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;

  const decidida = !!(c.pedidoId || c.escolhido);
  const escolhido = c.escolhido ? fornecedores.find((f) => f.id === c.escolhido!.fornecedorId) : undefined;
  const lider = ranking[0];
  const posicao = new Map(ranking.map((r) => [r.fornecedorId, r]));
  const menorItem = new Map(c.itens.map((i) => [i.itemId, Math.min(...respostasVivas.map((r) => r.precos[i.itemId]!).filter((x) => x > 0))]));
  const naoSalvas = fornecedores.filter((f) => rasc[f.id] && !igual(rasc[f.id], deResposta(c, f.id))).length;

  const pedirEscolha = (fornecedorId: string) => {
    const linha = rankingSalvo.find((r) => r.fornecedorId === fornecedorId);
    if (linha && linha.posicao !== 1) {
      setJustificativa('');
      setJustificar(linha);
    } else escolher.mutate({ fornecedorId });
  };

  const setCampo = (fid: string, p: Partial<Rascunho>) => setRasc((r) => ({ ...r, [fid]: { ...(r[fid] ?? deResposta(c, fid)), ...p } }));

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        sobretitulo={
          <Link to="/compras?aba=cotacoes" className="inline-flex items-center gap-1.5 text-[#FFC08F] no-underline hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Compras · cotação
          </Link>
        }
        titulo={c.numero ?? 'Cotação'}
        texto={
          decidida
            ? `Fornecedor escolhido${escolhido ? `: ${escolhido.nome}` : ''}. O pedido já foi gerado a partir desta cotação.`
            : respostasVivas.length < 2
              ? 'Lance os preços conforme os fornecedores responderem. O comparativo pondera preço com frete, prazo e a avaliação de cada um.'
              : `${lider?.nome} está na frente agora. Confira o comparativo e escolha; se for outro, a gente pede o porquê.`
        }
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          <HeroKpi destaque rotulo="Melhor nota agora" valor={lider ? brl(lider.total) : '—'} sub={lider ? `${lider.nome} · com frete` : 'esperando respostas'} />
          <HeroKpi rotulo="Respostas" valor={`${respostasVivas.length}/${fornecedores.length}`} sub="fornecedores com preço e prazo" />
          <HeroKpi rotulo="Itens" valor={c.itens.length} sub={data(c.criadaEm) !== '—' ? `aberta em ${data(c.criadaEm)}` : 'nesta cotação'} />
        </div>
      </HeroBand>

      {decidida && (
        <Aviso tom="ok" titulo="Decisão tomada" acao={c.pedidoId ? <Button to={`/compras/pedidos/${c.pedidoId}`}>Abrir o pedido</Button> : undefined}>
          {c.escolhido?.justificativa ? `Motivo registrado: ${c.escolhido.justificativa}` : 'Os valores ficam aqui para consulta.'}
        </Aviso>
      )}
      {!decidida && naoSalvas > 0 && (
        <Aviso tom="info">
          {naoSalvas === 1 ? 'Há uma resposta' : `Há ${naoSalvas} respostas`} com valores não salvos. O comparativo já mostra, mas a escolha vale pelo que está salvo.
        </Aviso>
      )}

      <Card className="p-4 sm:p-5 flex flex-col gap-4">
        <CardHeader titulo="Comparativo" sub="Nota de 0 a 100%: 60% preço com frete, 25% prazo e 15% avaliação do fornecedor." />
        <div className="relative overflow-x-auto max-w-full">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[14.5px]" aria-label="Comparativo de fornecedores">
            <thead>
              <tr>
                <th scope="col" className="text-left text-[13px] font-semibold text-ink-2 p-3 border-b border-border bg-surface-2 sticky left-0">Item</th>
                {fornecedores.map((f) => {
                  const r = posicao.get(f.id);
                  return (
                    <th key={f.id} scope="col" className={`text-right p-3 border-b border-border align-bottom ${r?.posicao === 1 ? 'bg-primary-soft' : 'bg-surface-2'}`}>
                      <span className="flex flex-col items-end gap-1">
                        {r && <Pill tom={r.posicao === 1 ? 'primary' : 'neutral'} icone={r.posicao === 1 ? Trophy : undefined}>{r.posicao}º</Pill>}
                        <span className="font-semibold text-ink-1">{f.nome}</span>
                        <Estrelas valor={f.avaliacao} tamanho={12} />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {c.itens.map((i) => (
                <tr key={i.itemId}>
                  <th scope="row" className="text-left font-normal p-3 border-b border-border bg-surface-1 sticky left-0">
                    <span className="flex flex-col">
                      <span className="font-semibold">{i.descricao}</span>
                      <span className="mono text-caption text-ink-3">{num(i.quantidade, toNum(i.quantidade) % 1 ? 2 : 0)} {i.unidade ?? ''}{i.custoMedio ? ` · médio ${brl(i.custoMedio)}` : ''}</span>
                    </span>
                  </th>
                  {fornecedores.map((f) => {
                    const v = toNum(rasc[f.id]?.precos[i.itemId]);
                    const melhor = v > 0 && respostasVivas.length > 1 && Math.abs(v - (menorItem.get(i.itemId) ?? 0)) < 1e-9;
                    return (
                      <td key={f.id} className={`mono text-right p-3 border-b border-border ${melhor ? 'text-ok font-semibold' : ''}`}>
                        {v > 0 ? brl(v) : <span className="text-ink-3">—</span>}
                        {melhor && <span className="sr-only"> (menor preço)</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row" className="text-left font-normal p-3 border-b border-border text-ink-2 sticky left-0 bg-surface-1">Frete</th>
                {fornecedores.map((f) => <td key={f.id} className="mono text-right p-3 border-b border-border">{rasc[f.id]?.frete ? brl(rasc[f.id]!.frete) : '—'}</td>)}
              </tr>
              <tr>
                <th scope="row" className="text-left font-normal p-3 border-b border-border text-ink-2 sticky left-0 bg-surface-1">Prazo</th>
                {fornecedores.map((f) => {
                  const r = posicao.get(f.id);
                  return (
                    <td key={f.id} className={`mono text-right p-3 border-b border-border ${r?.melhorPrazo && ranking.length > 1 ? 'text-ok font-semibold' : ''}`}>
                      {rasc[f.id]?.prazo ? `${rasc[f.id]!.prazo} dias` : '—'}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th scope="row" className="text-left p-3 sticky left-0 bg-surface-1">Total com frete</th>
                {fornecedores.map((f) => {
                  const r = posicao.get(f.id);
                  return (
                    <td key={f.id} className={`mono text-right p-3 ${r?.posicao === 1 ? 'bg-primary-soft' : ''}`}>
                      {r ? (
                        <span className="flex flex-col items-end gap-0.5">
                          <strong className={`text-[17px] ${r.melhorPreco && ranking.length > 1 ? 'text-ok' : ''}`}>{brl(r.total)}</strong>
                          <span className="text-caption text-ink-3">nota {pct(r.nota, 0)}</span>
                          {ranking.length > 1 && (r.melhorPreco || r.melhorPrazo) && (
                            <span className="font-sans text-caption text-ok">{[r.melhorPreco && 'melhor preço', r.melhorPrazo && 'melhor prazo'].filter(Boolean).join(' · ')}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-3 font-sans text-caption">sem resposta completa</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <section aria-labelledby="t-respostas" className="flex flex-col gap-3">
        <h2 id="t-respostas" className="m-0 font-sans text-headline">Respostas dos fornecedores</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
          {fornecedores.map((f) => {
            const r = rasc[f.id] ?? deResposta(c, f.id);
            const salva = c.respostas?.some((x) => x.fornecedorId === f.id);
            const sujo = !igual(r, deResposta(c, f.id));
            const viva = montar(c, f, r);
            const pos = posicao.get(f.id);
            const ehLider = pos?.posicao === 1 && respostasVivas.length > 0;
            const incompleta = !viva;
            return (
              <Card as="article" key={f.id} className={`p-4 flex flex-col gap-3 ${ehLider ? 'ring-2 ring-primary' : ''}`} aria-labelledby={`f-${f.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <h3 id={`f-${f.id}`} className="m-0 font-sans text-[17px] font-semibold">{f.nome}</h3>
                    <span className="flex flex-wrap items-center gap-x-2 text-caption text-ink-3">
                      <Estrelas valor={f.avaliacao} tamanho={13} />
                      {f.prazoMedioDias !== undefined && <span>costuma entregar em {f.prazoMedioDias} dias</span>}
                    </span>
                  </div>
                  {pos ? <Pill tom={ehLider ? 'primary' : 'neutral'}>{pos.posicao}º · {pct(pos.nota, 0)}</Pill> : <Pill tom="info">{salva ? 'incompleta' : 'esperando'}</Pill>}
                </div>
                <fieldset disabled={decidida} className="m-0 p-0 border-0 flex flex-col gap-2.5 min-w-0">
                  <legend className="sr-only">Preços de {f.nome}</legend>
                  {c.itens.map((i) => (
                    <NumberField
                      key={i.itemId}
                      label={i.descricao}
                      prefixo="R$"
                      sufixo={i.unidade ? `/${i.unidade}` : undefined}
                      value={r.precos[i.itemId] ?? ''}
                      onChange={(v) => setCampo(f.id, { precos: { ...r.precos, [i.itemId]: v } })}
                      disabled={decidida}
                    />
                  ))}
                  <div className="grid grid-cols-2 gap-2.5">
                    <NumberField label="Frete" prefixo="R$" value={r.frete} onChange={(v) => setCampo(f.id, { frete: v })} disabled={decidida} />
                    <NumberField label="Prazo" sufixo="dias" value={r.prazo} onChange={(v) => setCampo(f.id, { prazo: v })} disabled={decidida} />
                  </div>
                </fieldset>
                <div className="flex items-baseline justify-between gap-2 rounded-field bg-surface-2 px-3 py-2">
                  <span className="text-[13px] text-ink-2">Total com frete</span>
                  <span className="mono font-bold text-[18px]">{viva ? brl(viva.itens + viva.frete) : '—'}</span>
                </div>
                {!decidida && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      tamanho="sm"
                      icone={Save}
                      disabled={incompleta || !sujo}
                      carregando={salvar.isPending && salvar.variables?.fornecedorId === f.id}
                      onClick={() =>
                        viva &&
                        salvar.mutate({
                          fornecedorId: f.id,
                          itens: c.itens.map((i) => ({ itemId: i.itemId, precoUnitario: String(viva.precos[i.itemId]) })),
                          frete: String(viva.frete),
                          prazoDias: viva.prazoDias
                        })
                      }
                    >
                      {salva && !sujo ? 'Resposta salva' : 'Salvar resposta'}
                    </Button>
                    <Button
                      tamanho="sm"
                      variante={ehLider && !sujo && salva ? 'primario' : 'secundario'}
                      icone={CheckCircle2}
                      disabled={!salva || sujo}
                      carregando={escolher.isPending && escolher.variables?.fornecedorId === f.id}
                      onClick={() => pedirEscolha(f.id)}
                      aria-label={`Escolher ${f.nome}`}
                      title={!salva ? 'Salve a resposta antes de escolher' : sujo ? 'Salve as alterações antes de escolher' : undefined}
                    >
                      Escolher
                    </Button>
                  </div>
                )}
                {incompleta && !decidida && <span className="text-caption text-ink-3">Preencha o preço de todos os itens e o prazo para entrar no comparativo.</span>}
              </Card>
            );
          })}
        </div>
      </section>

      <Modal
        aberto={!!justificar}
        onFechar={() => setJustificar(null)}
        titulo="Por que este fornecedor?"
        faixa
        rodape={
          <>
            <Button variante="terciario" onClick={() => setJustificar(null)}>Voltar</Button>
            <Button
              variante="secundario"
              icone={CheckCircle2}
              disabled={justificativa.trim().length < 5}
              carregando={escolher.isPending}
              onClick={() => justificar && escolher.mutate({ fornecedorId: justificar.fornecedorId, justificativa: justificativa.trim() })}
            >
              Escolher {justificar?.nome}
            </Button>
          </>
        }
      >
        <p className="m-0 text-ink-2">
          {justificar?.nome} está em {justificar?.posicao}º no comparativo
          {rankingSalvo[0] ? `, atrás de ${rankingSalvo[0].nome} (${brl(rankingSalvo[0].total)})` : ''}. Tudo bem escolher, só registre o motivo para quem auditar a compra depois entender.
        </p>
        <TextArea label="Justificativa" value={justificativa} onChange={setJustificativa} hint="Ex.: só ele manda certificado do material; o mais barato atrasou nas duas últimas entregas." rows={3} />
      </Modal>
    </>
  );
}
