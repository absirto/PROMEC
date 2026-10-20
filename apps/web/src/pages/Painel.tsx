import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Info, Layers, Plus, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import type { Painel as PainelT } from '../lib/types';
import { brl, competenciaLonga, data, num, pct, toNum } from '../lib/format';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Button } from '../components/Button';
import { useTitulo } from '../layout/titulo';
import { useAuth } from '../lib/auth';
import { saudacaoAgora } from './Login';
import { tomOcupacao } from '../features/planejamento/plano';

const BARRA_OCUP = { ok: 'bg-ok', warn: 'bg-signal', bad: 'bg-bad' };

const hoje = () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

export default function Painel() {
  useTitulo('Painel');
  const { usuario } = useAuth();
  const q = useQuery({ queryKey: ['painel'], queryFn: () => api<PainelT>('/painel') });
  const p = q.data;
  const nome = p?.usuario ?? usuario?.nome?.split(' ')[0] ?? '';
  const d = hoje();

  const resumo = !p
    ? 'Buscando os números da oficina…'
    : p.orcamentos.abaixoDoMinimo > 0
      ? `${p.orcamentos.abertos} orçamentos em aberto, e ${p.orcamentos.abaixoDoMinimo === 1 ? 'um deles está' : `${p.orcamentos.abaixoDoMinimo} estão`} com margem abaixo do mínimo. Vale olhar antes de enviar.`
      : p.orcamentos.abertos > 0
        ? `${p.orcamentos.abertos} orçamentos em aberto somando ${brl(p.orcamentos.valorAberto)}. As margens estão dentro do combinado.`
        : 'Nenhum orçamento em aberto agora. Que tal montar o próximo?';

  return (
    <>
      <HeroBand
        grande
        ilustracao="torno"
        sobretitulo={d.charAt(0).toUpperCase() + d.slice(1)}
        titulo={`${p?.saudacao ?? saudacaoAgora()}${nome ? `, ${nome}` : ''}.`}
        texto={resumo}
      >
        {p && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <HeroKpi destaque rotulo="Em aberto" valor={brl(p.orcamentos.valorAberto)} sub={p.orcamentos.abertos === 1 ? '1 orçamento esperando resposta' : `${p.orcamentos.abertos} orçamentos esperando resposta`} />
            <HeroKpi rotulo="Aprovado no mês" valor={brl(p.orcamentos.valorAprovadoMes)} sub={p.orcamentos.aprovadosMes === 1 ? '1 orçamento aprovado' : `${p.orcamentos.aprovadosMes} orçamentos aprovados`} />
            <HeroKpi rotulo="Taxa de conversão" valor={pct(p.orcamentos.taxaConversao)} sub="aprovados sobre enviados" />
            <HeroKpi
              rotulo="Custo-hora médio"
              valor={p.tabelaVigente ? brl(p.tabelaVigente.cheioMedio) : '—'}
              sub={p.tabelaVigente ? `Tabela ${p.tabelaVigente.competencia} · v${p.tabelaVigente.versao}${p.tabelaVigente.desatualizada ? ' · desatualizada' : ''}` : 'sem tabela vigente'}
            />
          </div>
        )}
      </HeroBand>

      {q.isLoading && <Card><Carregando /></Card>}
      {q.isError && <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>}

      {p && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-[18px]">
          {p.ocupacao && p.ocupacao.length > 0 && (
            <Card className="p-5 flex flex-col gap-3 anim-subir" aria-labelledby="h-ocupacao">
              <CardHeader id="h-ocupacao" titulo="Ocupação" sub="Esta semana e a próxima, pela fila de hoje" acao={<Link to="/planejamento" className="text-[13px] font-semibold">Planejamento</Link>} />
              {p.ocupacao.map((c) => (
                <div key={c.centroId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center">
                  <span className="truncate text-[14px] font-medium">{c.nome}</span>
                  <span className="mono text-[13px] whitespace-nowrap"><strong className={tomOcupacao(c.semanaAtual) === 'bad' ? 'text-bad' : ''}>{pct(c.semanaAtual, 0)}</strong> <span className="text-ink-3">→ {pct(c.proximaSemana, 0)}</span></span>
                  {[c.semanaAtual, c.proximaSemana].map((v, i) => (
                    <span key={i} className="col-span-2 h-2 rounded-full bg-surface-3 overflow-hidden" aria-hidden style={{ opacity: i ? 0.6 : 1 }}>
                      <span className={`anim-crescer block h-full rounded-full ${BARRA_OCUP[tomOcupacao(v)]}`} style={{ width: `${Math.min(100, toNum(v) * 100)}%` }} />
                    </span>
                  ))}
                </div>
              ))}
              <span className="text-caption text-ink-3">Barra cheia: esta semana · clara: próxima. Acima de 90% é sobrecarga.</span>
            </Card>
          )}
          {p.financeiro && (
            <Card className="p-5 flex flex-col gap-3 anim-subir" aria-labelledby="h-fin">
              <CardHeader id="h-fin" titulo="Dinheiro" sub={`Saldo nas contas: ${brl(p.financeiro.saldoContas)}`} acao={<Link to="/financeiro/fluxo" className="text-[13px] font-semibold">Fluxo de caixa</Link>} />
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['A receber vencido', brl(p.financeiro.receberVencido), toNum(p.financeiro.receberVencido) > 0 ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-ink-2', '/financeiro/receber'],
                  ['A receber hoje', brl(p.financeiro.receberHoje), 'bg-ok-soft text-ok', '/financeiro/receber'],
                  ['A pagar em 7 dias', brl(p.financeiro.pagar7dias), 'bg-warn-soft text-warn', '/financeiro/pagar'],
                  ['Clientes bloqueados', String(p.financeiro.clientesBloqueados), p.financeiro.clientesBloqueados ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-ink-2', '/clientes']
                ] as const).map(([l, v, cor, to]) => (
                  <Link key={l} to={to} className={`no-underline rounded-[16px] p-3 flex flex-col ${cor}`}>
                    <span className="mono text-[18px] font-bold leading-tight">{v}</span>
                    <span className="text-[13px] font-medium">{l}</span>
                  </Link>
                ))}
              </div>
              <dl className="m-0 grid grid-cols-3 gap-2 text-center">
                {([['30 dias', p.financeiro.caixa30], ['60 dias', p.financeiro.caixa60], ['90 dias', p.financeiro.caixa90]] as const).map(([l, v]) => (
                  <div key={l} className="p-2 rounded-[12px] bg-surface-2"><dt className="text-caption text-ink-3">caixa em {l}</dt><dd className={`m-0 mono font-semibold ${toNum(v) < 0 ? 'text-bad' : ''}`}>{brl(v)}</dd></div>
                ))}
              </dl>
              {p.financeiro.menorSaldo && (
                <span className={`text-[13.5px] ${toNum(p.financeiro.menorSaldo.valor) < 0 ? 'text-bad font-semibold' : 'text-ink-2'}`}>
                  Menor saldo previsto: <strong className="mono">{brl(p.financeiro.menorSaldo.valor)}</strong> na semana de {data(p.financeiro.menorSaldo.inicio)}.
                </span>
              )}
              {p.financeiro.custoFixoDesvio != null && Math.abs(toNum(p.financeiro.custoFixoDesvio)) > 0.0005 && (
                <span className="text-[13.5px] text-ink-2">Custo fixo realizado {toNum(p.financeiro.custoFixoDesvio) > 0 ? 'acima' : 'abaixo'} da tabela: <strong className="mono">{toNum(p.financeiro.custoFixoDesvio) > 0 ? '+' : ''}{pct(p.financeiro.custoFixoDesvio)}</strong> · <Link to="/custo-fixo">ver</Link></span>
              )}
            </Card>
          )}
          {(p.suprimentos || p.qualidade) && (
            <Card className="p-5 flex flex-col gap-3 anim-subir" aria-labelledby="h-sup">
              <CardHeader id="h-sup" titulo="Estoque, compras e qualidade" />
              <div className="grid grid-cols-2 gap-2">
                {[
                  p.suprimentos && ['Abaixo do mínimo', String(p.suprimentos.abaixoDoMinimo), p.suprimentos.abaixoDoMinimo ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-2', '/estoque'],
                  p.suprimentos && ['Valor em estoque', brl(p.suprimentos.valorEstoque), 'bg-steel-soft text-steel', '/estoque'],
                  p.suprimentos && ['Pedidos para aprovar', String(p.suprimentos.pedidosAguardando), p.suprimentos.pedidosAguardando ? 'bg-info-soft text-info' : 'bg-surface-2 text-ink-2', '/compras?aba=pedidos'],
                  p.suprimentos && ['Entregas atrasadas', String(p.suprimentos.recebimentosAtrasados), p.suprimentos.recebimentosAtrasados ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-ink-2', '/compras?aba=pedidos'],
                  p.qualidade && ['NCs abertas', String(p.qualidade.ncsAbertas), p.qualidade.ncsAbertas ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok', '/qualidade?aba=ncs'],
                  p.qualidade && ['Garantias em análise', String(p.qualidade.garantiasAbertas), p.qualidade.garantiasAbertas ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-2', '/qualidade?aba=garantias']
                ].filter((x): x is string[] => !!x).map(([l, v, cor, to]) => (
                  <Link key={l} to={to!} className={`no-underline rounded-[16px] p-3 flex flex-col ${cor}`}>
                    <span className="mono text-[22px] font-bold leading-tight">{v}</span>
                    <span className="text-[13px] font-medium">{l}</span>
                  </Link>
                ))}
              </div>
              {p.qualidade && <span className="text-[13.5px] text-ink-2">Custo da não-qualidade no mês: <strong className={`mono ${toNum(p.qualidade.custoNaoQualidadeMes) > 0 ? 'text-bad' : 'text-ink-1'}`}>{brl(p.qualidade.custoNaoQualidadeMes)}</strong></span>}
            </Card>
          )}
          {p.ordens && (
            <Card className="p-5 flex flex-col gap-3 anim-subir" aria-labelledby="h-ordens">
              <CardHeader id="h-ordens" titulo="Chão de fábrica agora" acao={<Link to="/ordens-servico" className="text-[13px] font-semibold">Ordens de Serviço</Link>} />
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Em execução', p.ordens.emExecucao, 'bg-run-soft text-run', 'EM_EXECUCAO'],
                  ['Pausadas', p.ordens.pausadas, 'bg-warn-soft text-warn', 'PAUSADA'],
                  ['Atrasadas', p.ordens.atrasadas, p.ordens.atrasadas ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-ink-2', 'ATRASADAS'],
                  ['Na qualidade', p.ordens.emQualidade, 'bg-info-soft text-info', 'CONTROLE_QUALIDADE']
                ].map(([l, n, cor]) => (
                  <Link key={l as string} to="/ordens-servico" className={`no-underline rounded-[16px] p-3 flex flex-col ${cor}`}>
                    <span className="mono text-[28px] font-bold leading-none">{n as number}</span>
                    <span className="text-[13px] font-medium">{l as string}</span>
                  </Link>
                ))}
              </div>
              {p.ordens.margemProjetadaMedia != null && (
                <span className="text-[13.5px] text-ink-2">Margem projetada média das OS abertas: <strong className="mono text-ink-1">{pct(p.ordens.margemProjetadaMedia)}</strong></span>
              )}
            </Card>
          )}
          <Card className="p-5 flex flex-col gap-2.5 anim-subir" aria-labelledby="h-alertas">
            <CardHeader id="h-alertas" titulo="Precisa de você" sub={p.alertas.length ? `${p.alertas.length} ${p.alertas.length === 1 ? 'item' : 'itens'}` : undefined} />
            {p.alertas.length === 0 ? (
              <div className="flex items-center gap-3 p-3.5 rounded-field bg-ok-soft">
                <CheckCircle2 className="size-5 text-ok" aria-hidden />
                <span className="text-[14px]">Tudo em dia por aqui. Nenhuma pendência pedindo a sua atenção.</span>
              </div>
            ) : (
              p.alertas.map((a, i) => {
                const I = a.tipo === 'perigo' ? XCircle : a.tipo === 'atencao' ? AlertTriangle : a.tipo === 'ok' ? CheckCircle2 : Info;
                const cor = { perigo: 'bg-bad-soft text-bad', atencao: 'bg-warn-soft text-warn', ok: 'bg-ok-soft text-ok', info: 'bg-info-soft text-info' }[a.tipo] ?? 'bg-info-soft text-info';
                const conteudo = (
                  <>
                    <span className={`chip-ico ${cor}`}><I className="size-[18px]" aria-hidden /></span>
                    <span className="flex-1 text-[14.5px] text-ink-1">{a.mensagem}</span>
                    {a.link && <ChevronRight className="size-[18px] text-ink-3" aria-hidden />}
                  </>
                );
                return a.link ? (
                  <Link key={i} to={a.link} className="flex items-center gap-3 p-3 rounded-[16px] bg-surface-2 no-underline hover:translate-x-[3px] transition-transform duration-micro">{conteudo}</Link>
                ) : (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-[16px] bg-surface-2">{conteudo}</div>
                );
              })
            )}
          </Card>

          <Card className="p-5 flex flex-col gap-3 anim-subir" aria-labelledby="h-centros">
            <CardHeader
              id="h-centros"
              titulo="Quanto vale a hora de cada máquina"
              sub={p.tabelaVigente ? `Custo-hora cheio e preço de venda · ${competenciaLonga(p.tabelaVigente.competencia)}` : undefined}
              acao={<Link to="/tabelas-custos" className="text-[13px] font-semibold">Tabela de Custos</Link>}
            />
            {p.centros.length === 0 ? (
              <EmptyState ilustracao="engrenagens" titulo="Nenhuma máquina com custo ainda" texto="Publique a Tabela de Custos para ver aqui o custo e o preço da hora de cada centro." />
            ) : (
              (() => {
                const max = Math.max(...p.centros.map((c) => toNum(c.precoHora)), 1);
                return p.centros.map((c) => (
                  <Link key={c.id} to={`/centros-trabalho/${c.id}`} className="no-underline text-ink-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center p-2 -mx-2 rounded-control hover:bg-surface-2">
                    <span className="truncate text-[14px] font-medium">{c.nome}</span>
                    <span className="mono text-[13.5px] text-right whitespace-nowrap">
                      <span className="text-ink-3">{num(c.cheioHora)}</span> → <strong>{brl(c.precoHora)}</strong>
                      <span className="text-ink-3">/h</span>
                    </span>
                    <span className="col-span-2 relative h-2.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden>
                      <span className="anim-crescer absolute inset-y-0 left-0 rounded-full bg-chart-orcado" style={{ width: `${(toNum(c.precoHora) / max) * 100}%` }} />
                      <span className="anim-crescer absolute inset-y-0 left-0 rounded-full bg-steel" style={{ width: `${(toNum(c.cheioHora) / max) * 100}%` }} />
                    </span>
                  </Link>
                ));
              })()
            )}
            <span className="text-caption text-ink-3 flex gap-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-1 rounded bg-steel" />custo-hora cheio</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-1 rounded bg-chart-orcado" />preço de venda da hora</span>
            </span>
          </Card>

          <Card className="p-5 flex flex-col gap-3 anim-subir" aria-labelledby="h-atalhos">
            <CardHeader id="h-atalhos" titulo="Para começar o dia" />
            <Button variante="primario" icone={Plus} to="/orcamentos/novo" className="self-start">Novo orçamento</Button>
            <Link to="/orcamentos" className="flex items-center gap-3 p-3 rounded-[16px] bg-surface-2 no-underline text-ink-1">
              <span className="chip-ico bg-info-soft text-info"><ArrowRight className="size-[18px]" aria-hidden /></span>
              <span className="flex-1 text-[14.5px]">Ver os orçamentos em aberto</span>
            </Link>
            {p.tabelaVigente ? (
              <Link to={`/tabelas-custos/${p.tabelaVigente.id}`} className="flex items-center gap-3 p-3 rounded-[16px] bg-surface-2 no-underline text-ink-1">
                <span className="chip-ico bg-ok-soft text-ok"><Layers className="size-[18px]" aria-hidden /></span>
                <span className="flex-1 text-[14.5px]">Abrir a tabela de {competenciaLonga(p.tabelaVigente.competencia)}</span>
              </Link>
            ) : (
              <Link to="/tabelas-custos" className="flex items-center gap-3 p-3 rounded-[16px] bg-warn-soft no-underline text-ink-1">
                <span className="chip-ico bg-signal text-[#1E1B16]"><Layers className="size-[18px]" aria-hidden /></span>
                <span className="flex-1 text-[14.5px]">Ainda não há Tabela de Custos vigente. Monte o rascunho do mês.</span>
              </Link>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
