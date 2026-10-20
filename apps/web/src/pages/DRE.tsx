import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DRE as Resultado, LinhaDRE, Segmento } from '../lib/types';
import { brl, competenciaAtual, competenciaLonga, mesNome, pct, somarMes, toNum } from '../lib/format';
import { SEGMENTO } from '../lib/rotulos';
import { formatarLinhaDRE } from '../features/financeiro/fin';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { CompetenciaPicker } from '../components/CompetenciaPicker';
import { FiltroChips } from '../components/DataTable';
import { Aviso, Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { useTitulo } from '../layout/titulo';

const CAMPO_PLANO: Record<string, string> = {
  receita: 'receitaBruta',
  variaveis: 'custosVariaveis',
  margemContribuicao: 'margemContribuicao',
  custoFixo: 'custoFixo',
  resultado: 'resultado'
};

function valorAnterior(comparativo: Resultado['comparativo'], chave: string): number | null {
  if (!comparativo) return null;
  const l = comparativo.linhas?.find((x) => x.chave === chave);
  if (l) return toNum(l.valor);
  const campo = (comparativo as Record<string, unknown>)[CAMPO_PLANO[chave] ?? chave];
  return typeof campo === 'string' || typeof campo === 'number' ? toNum(campo) : null;
}

function corBarra(l: LinhaDRE, custo: boolean) {
  if (custo) return 'var(--pm-bad)';
  if (l.chave === 'margemContribuicao') return 'var(--pm-steel)';
  return toNum(l.valor) < 0 ? 'var(--pm-bad)' : 'var(--pm-ok)';
}

function Variacao({ atual, anterior, custo }: { atual: number; anterior: number | null; custo: boolean }) {
  if (anterior === null || anterior === 0) return <span className="text-ink-3">—</span>;
  const v = (atual - anterior) / Math.abs(anterior);
  if (Math.abs(v) < 0.0005) return <span className="text-ink-3">igual</span>;
  const bom = custo ? v < 0 : v > 0;
  return <span className={bom ? 'text-ok' : 'text-bad'}>{`${v > 0 ? '+' : '−'}${pct(Math.abs(v))}`}</span>;
}

function Demonstrativo({ d, comp }: { d: Resultado; comp: string }) {
  const receita = toNum(d.receitaBruta);
  const base = receita || Math.max(1, ...d.linhas.map((l) => Math.abs(toNum(l.valor))));
  const ant = mesNome(d.comparativo?.competencia ?? somarMes(comp, -1));
  return (
    <table className="w-full border-collapse text-[14px]" aria-label={`DRE de ${competenciaLonga(comp)}`}>
      <thead>
        <tr className="text-left text-caption text-ink-3">
          <th scope="col" className="font-medium py-2 pr-3">Linha</th>
          <th scope="col" className="font-medium py-2 px-2 text-right">Valor</th>
          <th scope="col" className="font-medium py-2 px-2 text-right">% receita</th>
          <th scope="col" className="font-medium py-2 px-2 text-right hidden md:table-cell">Em {ant}</th>
          <th scope="col" className="font-medium py-2 pl-2 text-right hidden md:table-cell">Variação</th>
        </tr>
      </thead>
      <tbody>
        {d.linhas.map((l) => {
          const f = formatarLinhaDRE(l);
          const v = toNum(l.valor);
          const a = valorAnterior(d.comparativo, l.chave);
          const largura = Math.min(100, (Math.abs(v) / base) * 100);
          return (
            <tr key={l.chave} className={f.total ? 'border-t-2 border-border-strong' : ''}>
              <th scope="row" className={`text-left align-top py-2.5 pr-3 ${f.total ? 'font-semibold' : 'font-normal text-ink-2 pl-4 sm:pl-6'}`}>
                <span className="block">{f.rotulo}</span>
                <span className="mt-1.5 block h-1.5 max-w-[320px] rounded-full bg-surface-3 overflow-hidden" aria-hidden>
                  <span className="anim-crescer block h-full rounded-full" style={{ width: `${largura}%`, background: corBarra(l, f.custo) }} />
                </span>
                <span className="md:hidden mt-1 block text-caption text-ink-3 font-normal">
                  {a === null ? `sem dado de ${ant}` : <>em {ant}: <span className="mono">{f.custo && a ? `− ${brl(Math.abs(a))}` : brl(a)}</span> · <Variacao atual={v} anterior={a} custo={f.custo} /></>}
                </span>
              </th>
              <td className={`mono align-top text-right py-2.5 px-2 whitespace-nowrap ${f.total ? 'font-bold' : ''} ${f.negativo ? 'text-bad' : ''}`}>{f.valor}</td>
              <td className="mono align-top text-right py-2.5 px-2 text-ink-3">{receita ? f.pct : '—'}</td>
              <td className="mono align-top text-right py-2.5 px-2 text-ink-2 whitespace-nowrap hidden md:table-cell">{a === null ? '—' : f.custo && a ? `− ${brl(Math.abs(a))}` : brl(a)}</td>
              <td className="mono align-top text-right py-2.5 pl-2 hidden md:table-cell"><Variacao atual={v} anterior={a} custo={f.custo} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Equilibrio({ d, comp }: { d: Resultado; comp: string }) {
  const receita = toNum(d.receitaBruta);
  const pe = d.pontoEquilibrio === null ? null : toNum(d.pontoEquilibrio);
  const mes = mesNome(comp);
  let corpo;
  if (pe === null) {
    corpo = (
      <p className="m-0 text-ink-2">
        {receita === 0
          ? `Sem receita em ${mes}, ainda não dá para calcular. O ponto de equilíbrio aparece quando a primeira OS do mês for faturada.`
          : 'Com a margem de contribuição zerada ou negativa, não existe ponto de equilíbrio: cada serviço vendido aumenta o prejuízo. Revise os preços e os custos variáveis das últimas OS.'}
      </p>
    );
  } else {
    const max = Math.max(receita, pe) * 1.1 || 1;
    const passou = receita >= pe;
    const dif = Math.abs(receita - pe);
    corpo = (
      <>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <span className="flex flex-col"><span className="text-[13px] text-ink-2">Ponto de equilíbrio</span><span className="mono text-[24px] font-bold">{brl(pe)}</span></span>
          <span className="flex flex-col"><span className="text-[13px] text-ink-2">Receita do mês</span><span className="mono text-[24px] font-bold">{brl(receita)}</span></span>
        </div>
        <div
          className="relative h-4 rounded-full bg-surface-3"
          role="progressbar"
          aria-label="Receita em relação ao ponto de equilíbrio"
          aria-valuemin={0}
          aria-valuemax={Math.round(max)}
          aria-valuenow={Math.round(receita)}
          aria-valuetext={`${brl(receita)} de receita para um ponto de equilíbrio de ${brl(pe)}`}
        >
          <span className="anim-crescer absolute inset-y-0 left-0 rounded-full" style={{ width: `${(receita / max) * 100}%`, background: passou ? 'var(--pm-ok)' : 'var(--pm-warn)' }} />
          <span className="absolute -top-1 -bottom-1 w-[3px] rounded bg-ink-1" style={{ left: `calc(${(pe / max) * 100}% - 1.5px)` }} aria-hidden />
        </div>
        <p className="m-0 text-ink-2">
          {passou
            ? <>A receita passou o ponto de equilíbrio em <strong className="mono text-ink-1">{brl(dif)}</strong>. O custo fixo de {mes} está pago; daqui em diante, cada real faturado deixa <span className="mono">{pct(d.margemContribuicaoPct)}</span> de margem.</>
            : <>Faltam <strong className="mono text-ink-1">{brl(dif)}</strong> de receita para cobrir o custo fixo de {mes}. Priorize entregar e faturar as OS que estão prontas.</>}
        </p>
      </>
    );
  }
  return (
    <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-pe">
      <CardHeader id="h-pe" titulo="Ponto de equilíbrio" sub="A receita que paga o custo fixo do mês com a margem de contribuição atual." />
      {corpo}
    </Card>
  );
}

export default function DRE() {
  useTitulo('DRE gerencial');
  const [sp, setSp] = useSearchParams();
  const comp = sp.get('competencia') ?? competenciaAtual();
  const seg = (sp.get('segmento') ?? '') as Segmento | '';
  const mudar = (p: { competencia?: string; segmento?: string }) => {
    const n = { competencia: p.competencia ?? comp, segmento: p.segmento ?? seg };
    setSp(n.segmento ? n : { competencia: n.competencia }, { replace: true });
  };

  const q = useQuery({ queryKey: ['financeiro', 'dre', comp, seg], queryFn: () => api<Resultado>('/financeiro/dre', { query: { competencia: comp, segmento: seg } }), placeholderData: (p) => p });
  const d = q.data;
  const linhas = d?.linhas ?? [];
  const vazio = linhas.every((l) => toNum(l.valor) === 0);
  const resultado = toNum(d?.resultado);

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        titulo="DRE gerencial"
        texto="O que o mês deixou de resultado: receita das OS, menos os custos de cada serviço, menos o custo fixo. Sem apuração fiscal."
        acoes={<CompetenciaPicker escuro valor={comp} onChange={(c) => mudar({ competencia: c })} />}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <HeroKpi destaque rotulo={`Resultado de ${competenciaLonga(comp)}`} valor={d ? brl(d.resultado) : '—'} sub={d && toNum(d.receitaBruta) ? `${pct(d.resultadoPct)} da receita` : 'sem receita no mês'} />
          <HeroKpi rotulo="Receita bruta" valor={d ? brl(d.receitaBruta) : '—'} />
          <HeroKpi rotulo="Margem de contribuição" valor={d ? brl(d.margemContribuicao) : '—'} sub={d && toNum(d.receitaBruta) ? `${pct(d.margemContribuicaoPct)} da receita` : undefined} />
        </div>
      </HeroBand>

      <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-dre">
        <CardHeader
          id="h-dre"
          titulo="Demonstrativo do mês"
          sub="Custo fixo rateado pela receita quando filtra um segmento. Barras proporcionais à receita."
          acao={
            <FiltroChips
              rotulo="Segmento"
              valor={seg}
              onChange={(s) => mudar({ segmento: s })}
              opcoes={[{ valor: '' as Segmento | '', rotulo: 'Todos' }, ...(Object.keys(SEGMENTO) as Segmento[]).map((s) => ({ valor: s as Segmento | '', rotulo: SEGMENTO[s] }))]}
            />
          }
        />
        {q.isLoading ? <Carregando rotulo="Carregando a DRE" /> : q.isError ? <ErroEstado erro={q.error} tentar={() => q.refetch()} /> : !d || vazio ? (
          <EmptyState
            titulo={`Nada apurado em ${mesNome(comp)}`}
            texto="A DRE se monta com os títulos a receber das OS com competência no mês e com o custo fixo lançado. Confira a competência ou volte um mês."
          />
        ) : (
          <>
            {toNum(d.receitaBruta) === 0 && (
              <Aviso tom="warn" titulo={`Ainda sem receita em ${mesNome(comp)}`}>
                Os custos já aparecem, mas nenhuma OS foi faturada com essa competência. Os percentuais voltam quando a primeira entrar.
              </Aviso>
            )}
            {toNum(d.receitaBruta) > 0 && resultado < 0 && (
              <Aviso tom="bad" faixa titulo={`O mês está fechando no vermelho: ${brl(resultado)}`}>
                Veja abaixo qual custo cresceu em relação ao mês anterior e confira o ponto de equilíbrio para saber quanto falta faturar.
              </Aviso>
            )}
            <Demonstrativo d={d} comp={comp} />
          </>
        )}
      </Card>

      {d && !vazio && <Equilibrio d={d} comp={comp} />}
    </>
  );
}
