import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Info, Layers, Plus, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import type { Painel as PainelT } from '../lib/types';
import { brl, competenciaLonga, num, pct, toNum } from '../lib/format';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Button } from '../components/Button';
import { useTitulo } from '../layout/titulo';
import { useAuth } from '../lib/auth';
import { saudacaoAgora } from './Login';

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
