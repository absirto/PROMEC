import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Categoria, CompetenciaResumo, CustoFixoMes, Lancamento } from '../lib/types';
import { brl, competenciaAtual, competenciaLonga, mesNome, pct, somarMes, toNum } from '../lib/format';
import { CATEGORIA } from '../lib/rotulos';
import { useAcao } from '../lib/queries';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { DecimalInput, NumberField, Select, SelectField, TextField } from '../components/Field';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { CompetenciaPicker } from '../components/CompetenciaPicker';
import { useTitulo } from '../layout/titulo';

const OPCOES = (Object.keys(CATEGORIA) as Categoria[]).map((k) => ({ valor: k, rotulo: CATEGORIA[k] }));

function Linha({ l, competencia }: { l: Lancamento; competencia: string }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(l);
  const inval = [['custo-fixo'], ['tabelas-custos'], ['painel']];
  const salvar = useAcao(() => api(`/custo-fixo/${l.id}`, { method: 'PATCH', body: { categoria: v.categoria, descricao: v.descricao, valor: v.valor || '0' } }), {
    invalida: inval,
    sucesso: 'Lançamento atualizado.',
    onSuccess: () => setEditando(false)
  });
  const del = useAcao(() => api(`/custo-fixo/${l.id}`, { method: 'DELETE' }), { invalida: inval, sucesso: `Lançamento removido de ${mesNome(competencia)}.` });
  if (editando)
    return (
      <li className="flex flex-wrap items-center gap-2 px-5 py-2.5 bg-surface-2">
        <Select aria-label="Categoria" value={v.categoria} onChange={(c) => setV({ ...v, categoria: c as Categoria })} opcoes={OPCOES} className="flex-[1_1_160px]" />
        <div className="campo flex-[2_1_200px]"><input aria-label="Descrição" value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} /></div>
        <div className="campo flex-[1_1_140px]"><span className="un">R$</span><DecimalInput aria-label="Valor" value={v.valor} onChange={(x) => setV({ ...v, valor: x })} className="text-right" /></div>
        <IconButton icone={Check} rotulo="Salvar lançamento" onClick={() => salvar.mutate(undefined)} className="text-ok" />
        <IconButton icone={X} rotulo="Cancelar edição" onClick={() => { setV(l); setEditando(false); }} />
      </li>
    );
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <span className="flex-1 min-w-0 truncate text-[14.5px]">{l.descricao || CATEGORIA[l.categoria]}</span>
      <span className="mono text-[14.5px] font-medium">{brl(l.valor)}</span>
      <IconButton icone={Pencil} rotulo={`Editar ${l.descricao}`} onClick={() => setEditando(true)} className="size-9" />
      <IconButton icone={Trash2} rotulo={`Remover ${l.descricao}`} onClick={() => del.mutate(undefined)} className="size-9 hover:text-bad" />
    </li>
  );
}

export default function CustoFixo() {
  useTitulo('Custo fixo');
  const [sp, setSp] = useSearchParams();
  const comp = sp.get('competencia') ?? competenciaAtual();
  const setComp = (c: string) => setSp({ competencia: c }, { replace: true });
  const anterior = somarMes(comp, -1);

  const q = useQuery({ queryKey: ['custo-fixo', comp], queryFn: () => api<CustoFixoMes>('/custo-fixo', { query: { competencia: comp } }) });
  const meses = useQuery({ queryKey: ['custo-fixo', 'competencias'], queryFn: () => api<CompetenciaResumo[]>('/custo-fixo/competencias') });
  const totalAnterior = meses.data?.find((m) => m.competencia === anterior)?.total;

  const [novo, setNovo] = useState({ categoria: 'aluguel' as Categoria, descricao: '', valor: '' });
  const [erroNovo, setErroNovo] = useState<string | null>(null);
  const inval = [['custo-fixo'], ['tabelas-custos'], ['painel']];
  const add = useAcao(() => api('/custo-fixo', { method: 'POST', body: { competencia: comp, ...novo, descricao: novo.descricao.trim() || CATEGORIA[novo.categoria] } }), {
    invalida: inval,
    sucesso: 'Lançado. O custo-hora do rascunho já pode ser recalculado com ele.',
    onSuccess: () => setNovo({ ...novo, descricao: '', valor: '' })
  });
  const copiar = useAcao(() => api('/custo-fixo/copiar', { method: 'POST', body: { de: anterior, para: comp } }), {
    invalida: inval,
    sucesso: `Copiamos os lançamentos de ${mesNome(anterior)}. Ajuste o que mudou.`
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!(toNum(novo.valor) > 0)) return setErroNovo('Informe quanto custa por mês. Se ainda não sabe, use a média dos últimos meses.');
    setErroNovo(null);
    add.mutate(undefined);
  };

  const lanc = q.data?.lancamentos ?? [];
  const grupos = OPCOES.map((o) => ({ ...o, itens: lanc.filter((l) => l.categoria === o.valor) })).filter((g) => g.itens.length);
  const total = toNum(q.data?.total ?? lanc.reduce((a, l) => a + toNum(l.valor), 0));
  const variacao = totalAnterior && toNum(totalAnterior) > 0 ? total / toNum(totalAnterior) - 1 : null;

  return (
    <>
      <HeroBand
        ilustracao="cofre"
        titulo="Custo fixo"
        texto="O que a empresa gasta para abrir as portas no mês, faça chuva ou faça sol. Ele é dividido entre as horas das máquinas no rateio."
        acoes={
          <>
            <CompetenciaPicker escuro valor={comp} onChange={setComp} />
            <Button variante="vidro" icone={Copy} carregando={copiar.isPending} onClick={() => copiar.mutate(undefined)}>Copiar de {mesNome(anterior)}</Button>
          </>
        }
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <HeroKpi destaque rotulo={`Total de ${competenciaLonga(comp)}`} valor={brl(total)} sub={`${lanc.length} lançamentos`} />
          <HeroKpi
            rotulo={`Comparado a ${mesNome(anterior)}`}
            valor={variacao === null ? '—' : `${variacao > 0 ? '+' : ''}${pct(variacao)}`}
            sub={totalAnterior ? `${mesNome(anterior)} fechou em ${brl(totalAnterior)}` : 'sem lançamentos no mês anterior'}
          />
        </div>
      </HeroBand>

      <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-novo">
        <CardHeader id="h-novo" titulo="Novo lançamento" sub="Mexer no custo fixo do mês vigente marca a Tabela de Custos como desatualizada." />
        <form onSubmit={enviar} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-3 items-end">
          <SelectField label="Categoria" value={novo.categoria} onChange={(c) => setNovo({ ...novo, categoria: c as Categoria })} opcoes={OPCOES} />
          <TextField label="Descrição" value={novo.descricao} onChange={(d) => setNovo({ ...novo, descricao: d })} placeholder="Ex.: aluguel do galpão" />
          <NumberField label="Valor no mês" prefixo="R$" value={novo.valor} onChange={(v) => setNovo({ ...novo, valor: v })} erro={erroNovo} />
          <Button type="submit" variante="primario" icone={Plus} carregando={add.isPending} className={erroNovo ? 'sm:mb-[26px]' : ''}>Adicionar</Button>
        </form>
      </Card>

      <Card className="overflow-hidden" aria-label={`Lançamentos de ${competenciaLonga(comp)}`}>
        {q.isLoading && <Carregando />}
        {q.isError && <ErroEstado erro={q.error} tentar={() => q.refetch()} />}
        {q.isSuccess && lanc.length === 0 && (
          <EmptyState
            ilustracao="cofre"
            titulo={`Nada lançado em ${mesNome(comp)}`}
            texto={`Comece pelo aluguel e pela luz, ou copie os lançamentos de ${mesNome(anterior)} e ajuste o que mudou.`}
            acao={<Button icone={Copy} onClick={() => copiar.mutate(undefined)}>Copiar de {mesNome(anterior)}</Button>}
          />
        )}
        {grupos.map((g) => {
          const sub = g.itens.reduce((a, l) => a + toNum(l.valor), 0);
          return (
            <section key={g.valor} aria-label={g.rotulo} className="border-b border-border last:border-0">
              <div className="flex items-center gap-3 px-5 pt-3.5 pb-1">
                <h2 className="m-0 flex-1 font-sans text-[15px] font-semibold">{g.rotulo}</h2>
                <span className="mono text-[13px] text-ink-3">{total ? pct(sub / total) : ''}</span>
                <span className="mono font-semibold">{brl(sub)}</span>
              </div>
              <div className="mx-5 h-1.5 rounded-full bg-surface-3 overflow-hidden" aria-hidden>
                <span className="anim-crescer block h-full bg-steel rounded-full" style={{ width: `${total ? (sub / total) * 100 : 0}%` }} />
              </div>
              <ul className="list-none m-0 p-0 pb-2">
                {g.itens.map((l) => <Linha key={`${l.id}-${l.valor}-${l.descricao}`} l={l} competencia={comp} />)}
              </ul>
            </section>
          );
        })}
        {lanc.length > 0 && (
          <div className="flex items-center justify-between px-5 py-4 border-t-2 border-ink-1 bg-surface-1">
            <span className="text-ink-2">Total do mês</span>
            <span className="mono text-[22px] font-bold">{brl(total)}</span>
          </div>
        )}
      </Card>
    </>
  );
}
