import { useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleDashed, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import type { FluxoCaixa as Fluxo, PontoCaixaApi } from '../lib/types';
import { brl, data, mesNome, toNum } from '../lib/format';
import { escalaFluxo } from '../features/financeiro/fin';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Segmented } from '../components/Field';
import { DataTable } from '../components/DataTable';
import { Aviso, Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { useTitulo } from '../layout/titulo';

type Agrupamento = 'dia' | 'semana' | 'mes';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const eixo = (v: number) => (v === 0 ? '0' : `${v < 0 ? '−' : ''}${compacto.format(Math.abs(v))}`);
const ddmm = (d: string) => data(d).slice(0, 5);

function rotuloPeriodo(inicio: string, ag: Agrupamento, curto = false) {
  if (ag === 'dia') return curto ? ddmm(inicio) : data(inicio);
  if (ag === 'semana') return curto ? ddmm(inicio) : `semana de ${ddmm(inicio)}`;
  const m = mesNome(inicio.slice(0, 7));
  return curto ? m.slice(0, 3) : `${m} de ${inicio.slice(0, 4)}`;
}

function passo(bruto: number) {
  const p = 10 ** Math.floor(Math.log10(bruto || 1));
  const m = bruto / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function Grafico({ pontos, ag, resumo }: { pontos: PontoCaixaApi[]; ag: Agrupamento; resumo: string }) {
  const id = useId().replace(/:/g, '');
  const W = 900, L = 64, R = 8, T = 16, PH = 240, B = 28;
  const n = pontos.length;
  const sw = (W - L - R) / n;
  const bw = Math.min(sw * 0.62, 44);
  const v = pontos.map((p) => ({ e: toNum(p.entradas), s: toNum(p.saidas), saldo: toNum(p.saldoFinal) }));
  const esc = escalaFluxo(v.flatMap((x) => [x.e, -x.s, x.saldo]), PH);
  const y = (val: number) => T + esc.y(val);
  const st = passo((esc.max - esc.min) / 4);
  const ticks: number[] = [];
  for (let t = Math.ceil(esc.min / st) * st; t <= esc.max; t += st) ticks.push(t);
  const cx = (i: number) => L + sw * (i + 0.5);
  const salto = Math.ceil(n / 8);

  return (
    <svg viewBox={`0 0 ${W} ${T + PH + B}`} className="w-full h-auto" role="img" aria-label={resumo}>
      <defs>
        <pattern id={`hz${id}`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="12" fill="#1E1B16" />
          <rect width="6" height="12" fill="var(--pm-signal)" />
        </pattern>
      </defs>
      {pontos.map((p, i) => p.negativo && (
        <g key={`n${p.inicio}`}>
          <rect x={L + sw * i} y={T} width={sw} height={PH} fill="var(--pm-bad-soft)" />
          <rect x={L + sw * i} y={3} width={sw} height={8} fill={`url(#hz${id})`} />
        </g>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--pm-text-3)' : 'var(--pm-border)'} strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="14" fill="var(--pm-text-3)" className="mono">{eixo(t)}</text>
        </g>
      ))}
      {pontos.map((p, i) => (
        <g key={p.inicio}>
          <title>{`${rotuloPeriodo(p.inicio, ag)}: entradas ${brl(p.entradas)}, saídas ${brl(p.saidas)}, saldo ${brl(p.saldoFinal)}`}</title>
          <rect x={L + sw * i} y={T} width={sw} height={PH} fill="transparent" />
          {v[i]!.e > 0 && <rect x={cx(i) - bw / 2} y={y(v[i]!.e)} width={bw} height={Math.max(esc.zero - esc.y(v[i]!.e), 1)} rx={Math.min(4, bw / 3)} fill="var(--pm-ok)" />}
          {v[i]!.s > 0 && <rect x={cx(i) - bw / 2} y={T + esc.zero} width={bw} height={Math.max(esc.y(-v[i]!.s) - esc.zero, 1)} rx={Math.min(4, bw / 3)} fill="var(--pm-bad)" opacity=".85" />}
          {i % salto === 0 && <text x={cx(i)} y={T + PH + 20} textAnchor="middle" fontSize="14" fill="var(--pm-text-3)" className="mono">{rotuloPeriodo(p.inicio, ag, true)}</text>}
        </g>
      ))}
      <polyline points={v.map((x, i) => `${cx(i)},${y(x.saldo)}`).join(' ')} fill="none" stroke="var(--pm-steel)" strokeWidth="3" strokeLinejoin="round" />
      {n <= 40 && v.map((x, i) => <circle key={i} cx={cx(i)} cy={y(x.saldo)} r="4.5" fill="var(--pm-surface-1)" stroke={pontos[i]!.negativo ? 'var(--pm-bad)' : 'var(--pm-steel)'} strokeWidth="2.5" />)}
    </svg>
  );
}

function Legenda() {
  const item = 'inline-flex items-center gap-1.5';
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-ink-2" aria-hidden>
      <span className={item}><span className="size-3 rounded-[3px] bg-ok" />Entradas</span>
      <span className={item}><span className="size-3 rounded-[3px] bg-bad" />Saídas</span>
      <span className={item}><span className="w-4 h-[3px] rounded bg-steel" />Saldo no fim do período</span>
      <span className={item}><span className="hazard w-4 h-2 rounded-sm" />Caixa negativo</span>
    </div>
  );
}

function Realizado({ realizado, pontos, ag }: { realizado: Fluxo['realizado']; pontos: PontoCaixaApi[]; ag: Agrupamento }) {
  const linhas = realizado.slice(-6).map((r) => {
    const p = pontos.find((x) => x.inicio === r.inicio);
    return { ...r, prevE: p ? toNum(p.entradasPrevistas) : null, prevS: p ? toNum(p.saidasPrevistas) : null };
  });
  const max = Math.max(1, ...linhas.flatMap((l) => [toNum(l.entradas), toNum(l.saidas), l.prevE ?? 0, l.prevS ?? 0]));
  const barra = (valor: number | null, cor: string, rot: string) =>
    valor === null ? null : (
      <span className="flex items-center gap-2 min-w-0">
        <span className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
          <span className="block h-full rounded-full" style={{ width: `${(valor / max) * 100}%`, background: cor }} />
        </span>
        <span className="mono text-caption w-[104px] text-right flex-none" aria-label={`${rot} ${brl(valor)}`}>{brl(valor)}</span>
      </span>
    );
  return (
    <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-real">
      <CardHeader id="h-real" titulo="Realizado e previsto" sub="O que entrou e saiu de fato nos últimos períodos. Onde havia previsão, ela aparece em cinza logo acima." />
      {linhas.length === 0 ? (
        <p className="m-0 text-ink-2">Ainda não há baixas registradas nos últimos períodos. Assim que receber ou pagar um título, ele aparece aqui.</p>
      ) : (
        <>
          <ul className="m-0 p-0 list-none flex flex-col gap-4">
            {linhas.map((l) => (
              <li key={l.inicio} className="grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] gap-x-5 gap-y-2">
                <span className="text-[14px] font-semibold">{rotuloPeriodo(l.inicio, ag)}</span>
                <span className="flex flex-col gap-1">
                  <span className="text-caption text-ink-3">Entradas</span>
                  {barra(l.prevE, 'var(--pm-chart-orcado)', 'previsto')}
                  {barra(toNum(l.entradas), 'var(--pm-chart-real)', 'realizado')}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-caption text-ink-3">Saídas</span>
                  {barra(l.prevS, 'var(--pm-chart-orcado)', 'previsto')}
                  {barra(toNum(l.saidas), 'var(--pm-chart-real)', 'realizado')}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-4 text-caption text-ink-2" aria-hidden>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-chart-orcado" />Previsto</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-chart-real" />Realizado</span>
          </div>
        </>
      )}
    </Card>
  );
}

export default function FluxoCaixa() {
  useTitulo('Fluxo de caixa');
  const [ag, setAg] = useState<Agrupamento>('semana');
  const [horizonte, setHorizonte] = useState<'30' | '60' | '90' | '180'>('90');
  const hoje = useMemo(() => new Date(), []);
  const ate = iso(somarDias(hoje, Number(horizonte)));

  const q = useQuery({ queryKey: ['financeiro', 'fluxo', ate, ag], queryFn: () => api<Fluxo>('/financeiro/fluxo', { query: { ate, agrupamento: ag } }), placeholderData: (p) => p });
  const pontos = q.data?.pontos ?? [];
  const menor = q.data?.menorSaldo ?? null;
  const menorNeg = menor ? toNum(menor.valor) < 0 : false;
  const negativos = pontos.filter((p) => p.negativo).length;

  const caixaEm = (dias: number) => {
    if (dias > Number(horizonte)) return null;
    const limite = iso(somarDias(hoje, dias));
    const p = [...pontos].reverse().find((x) => x.inicio <= limite);
    return p ? toNum(p.saldoFinal) : null;
  };

  const resumo = pontos.length
    ? `Fluxo de caixa previsto até ${data(ate)}: saldo hoje ${brl(q.data?.saldoAtual)}, saldo no fim ${brl(pontos[pontos.length - 1]!.saldoFinal)}` +
      (menor ? `, menor saldo ${brl(menor.valor)} em ${rotuloPeriodo(menor.inicio, ag)}` : '') +
      (negativos ? `. ${negativos} ${negativos === 1 ? 'período fica' : 'períodos ficam'} com caixa negativo.` : '. O caixa fica positivo em todo o período.')
    : '';

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        titulo="Fluxo de caixa"
        texto="Quanto tem no banco hoje e como o saldo deve andar com o que vai entrar e sair: títulos em aberto, OS a entregar e contas fixas."
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <HeroKpi destaque rotulo="Saldo nas contas hoje" valor={q.data ? brl(q.data.saldoAtual) : '—'} sub="somando bancos e caixa da oficina" />
          <HeroKpi
            rotulo="Menor saldo previsto"
            valor={menor ? <span className={menorNeg ? 'text-[#FF9C8A]' : ''}>{brl(menor.valor)}</span> : '—'}
            sub={menor ? `${rotuloPeriodo(menor.inicio, ag)}${menorNeg ? ' · abaixo de zero' : ''}` : `até ${data(ate)}`}
          />
        </div>
      </HeroBand>

      <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-fluxo">
        <CardHeader id="h-fluxo" titulo="Entradas, saídas e saldo" sub={`Previsto de hoje até ${data(ate)}. Passe o mouse numa barra para ver os valores.`} />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <Segmented label="Agrupar por" tamanho="sm" value={ag} onChange={setAg} opcoes={[{ valor: 'dia', rotulo: 'Dia' }, { valor: 'semana', rotulo: 'Semana' }, { valor: 'mes', rotulo: 'Mês' }]} />
          <Segmented
            label="Horizonte"
            tamanho="sm"
            value={horizonte}
            onChange={setHorizonte}
            opcoes={(['30', '60', '90', '180'] as const).map((d) => ({ valor: d, rotulo: `${d} dias` }))}
          />
        </div>
        {q.isLoading ? <Carregando rotulo="Carregando o fluxo de caixa" /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : pontos.length === 0 ? (
          <EmptyState titulo="Nada previsto nesse período" texto="Não há títulos em aberto, OS a entregar nem contas fixas até essa data. Aumente o horizonte ou lance as contas do mês." />
        ) : (
          <>
            <Grafico pontos={pontos} ag={ag} resumo={resumo} />
            <Legenda />
            {menor && (
              <Aviso
                tom={menorNeg ? 'bad' : 'info'}
                faixa={menorNeg}
                titulo={<>O caixa fica mais apertado em {rotuloPeriodo(menor.inicio, ag)}: <span className="mono">{brl(menor.valor)}</span></>}
              >
                {menorNeg
                  ? 'Dá tempo de agir: cobre os títulos vencidos, tente antecipar recebimentos, negocie o vencimento de alguma conta a pagar ou segure as compras que podem esperar.'
                  : 'Continua no azul, mas essa é a menor folga do período. Antes de assumir um gasto grande, confira se ele cabe aqui.'}
              </Aviso>
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              {[30, 60, 90].map((d) => {
                const v = caixaEm(d);
                return (
                  <div key={d} className={`rounded-[18px] px-4 py-3.5 ${v === null ? 'bg-surface-2' : v < 0 ? 'bg-bad-soft' : 'bg-ok-soft'}`}>
                    <span className="text-[13px] text-ink-2">Caixa previsto em {d} dias</span>
                    <span className={`mono block text-[22px] font-bold ${v !== null && v < 0 ? 'text-bad' : ''}`}>{v === null ? '—' : brl(v)}</span>
                    {v === null && <span className="text-caption text-ink-3">aumente o horizonte para ver</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {pontos.length > 0 && (
        <Card className="overflow-hidden" aria-label="Fluxo por período">
          <DataTable<PontoCaixaApi>
            rotulo="Fluxo de caixa por período"
            linhas={pontos}
            chave={(p) => p.inicio}
            colunas={[
              { chave: 'p', titulo: 'Período', principal: true, render: (p) => <span className="font-semibold">{rotuloPeriodo(p.inicio, ag)}</span> },
              { chave: 'e', titulo: 'Entradas', alinhar: 'right', mono: true, render: (p) => <span className="text-ok">{brl(p.entradas)}</span> },
              { chave: 's', titulo: 'Saídas', alinhar: 'right', mono: true, render: (p) => <span className="text-bad">{toNum(p.saidas) ? `− ${brl(p.saidas)}` : brl(0)}</span> },
              { chave: 'f', titulo: 'Saldo final', alinhar: 'right', mono: true, render: (p) => <strong className={p.negativo ? 'text-bad' : ''}>{brl(p.saldoFinal)}</strong> },
              {
                chave: 'x',
                titulo: 'Situação',
                render: (p) => p.negativo ? <Pill tom="bad" icone={TriangleAlert}>Caixa negativo</Pill> : <Pill tom="neutral" icone={CircleDashed}>Previsto</Pill>
              }
            ]}
          />
        </Card>
      )}

      {q.data && <Realizado realizado={q.data.realizado ?? []} pontos={pontos} ag={ag} />}
    </>
  );
}
