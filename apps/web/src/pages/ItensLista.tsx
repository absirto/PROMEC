import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Boxes, Plus, Wallet } from 'lucide-react';
import type { Item, TipoItem } from '../lib/types';
import { brl, num, toNum } from '../lib/format';
import { HeroBand } from '../components/HeroBand';
import { Kpi } from '../components/Card';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Listagem, normalizar } from '../components/Listagem';
import { useItens } from '../components/ItemPicker';
import { TIPO_ITEM } from '../features/suprimentos/sup';
import { useTitulo } from '../layout/titulo';

type Filtro = 'todos' | 'baixo' | TipoItem;
export const situacaoItem = (i: Pick<Item, 'saldo' | 'estoqueMinimo'>) =>
  toNum(i.saldo?.disponivel) <= 0 ? 'zerado' : toNum(i.saldo?.disponivel) < toNum(i.estoqueMinimo) ? 'baixo' : 'ok';
export function SituacaoPill({ s }: { s: 'ok' | 'baixo' | 'zerado' }) {
  return s === 'ok' ? <Pill tom="ok">ok</Pill> : s === 'baixo' ? <Pill tom="warn" icone={AlertTriangle}>abaixo do mínimo</Pill> : <Pill tom="bad">zerado</Pill>;
}

export default function ItensLista() {
  useTitulo('Itens');
  const q = useItens();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const todos = q.data ?? [];
  const termo = normalizar(busca.trim());
  const baixos = todos.filter((i) => situacaoItem(i) !== 'ok' && i.tipo !== 'SERVICO_EXTERNO');
  const linhas = todos.filter((i) => (filtro === 'todos' || (filtro === 'baixo' ? baixos.includes(i) : i.tipo === filtro)) && (!termo || normalizar(`${i.codigo} ${i.descricao}`).includes(termo)));
  const valor = todos.reduce((a, i) => a + toNum(i.saldo?.fisico) * toNum(i.custoMedio), 0);
  const tipos = (Object.keys(TIPO_ITEM) as TipoItem[]).filter((t) => todos.some((i) => i.tipo === t));

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        titulo={<>Itens <span className="mono text-[22px] font-medium opacity-80">{todos.length || ''}</span></>}
        texto="Matéria-prima, peças, insumos e ferramentas. O custo médio daqui é o que vai para o orçamento."
        acoes={<Button variante="primario" icone={Plus} to="/itens/novo">Novo item</Button>}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi tom="steel" icone={<Boxes className="size-5" aria-hidden />} valor={todos.length} rotulo="itens ativos" />
        <Kpi tom="primary" icone={<Wallet className="size-5" aria-hidden />} valor={brl(valor)} rotulo="valor em estoque" />
        <Kpi tom={baixos.length ? 'warn' : 'ok'} icone={<AlertTriangle className="size-5" aria-hidden />} valor={baixos.length} rotulo="abaixo do mínimo" />
      </div>
      <Listagem<Filtro>
        rotulo="Lista de itens"
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar por código ou descrição"
        filtros={[{ valor: 'todos' as Filtro, rotulo: 'Todos', n: todos.length }, { valor: 'baixo' as Filtro, rotulo: 'Abaixo do mínimo', n: baixos.length }, ...tipos.map((t) => ({ valor: t as Filtro, rotulo: TIPO_ITEM[t], n: todos.filter((i) => i.tipo === t).length }))]}
        filtro={filtro}
        onFiltro={setFiltro}
        carregando={q.isLoading}
        erro={q.error}
        tentar={() => q.refetch()}
        vazio={q.isSuccess && todos.length === 0 ? <EmptyState ilustracao="prancheta" titulo="Nenhum item cadastrado" texto="Comece pela matéria-prima que mais aparece nos orçamentos: com o custo médio certo, o preço sai certo." acao={<Button variante="primario" icone={Plus} to="/itens/novo">Novo item</Button>} /> : null}
        semResultado={linhas.length === 0}
        total={todos.length}
        mostrando={linhas.length}
      >
        {linhas.length > 0 && (
          <DataTable<Item>
            rotulo="Itens"
            linhas={linhas}
            chave={(i) => i.id}
            href={(i) => `/itens/${i.id}`}
            rotuloLinha={(i) => i.descricao}
            colunas={[
              { chave: 'd', titulo: 'Item', principal: true, render: (i) => (
                <span className="flex flex-col min-w-0">
                  <Link to={`/itens/${i.id}`} className="font-semibold text-ink-1 no-underline hover:underline">{i.descricao}</Link>
                  <span className="mono text-caption text-ink-3">{i.codigo}{i.rastreavel ? ' · rastreável' : ''}</span>
                </span>
              ) },
              { chave: 't', titulo: 'Tipo', render: (i) => TIPO_ITEM[i.tipo] ?? i.tipo },
              { chave: 's', titulo: 'Disponível', alinhar: 'right', mono: true, render: (i) => `${num(i.saldo?.disponivel ?? 0, 2)} ${i.unidadeConsumo}` },
              { chave: 'm', titulo: 'Mín · máx', alinhar: 'right', mono: true, render: (i) => `${num(i.estoqueMinimo, 0)} · ${num(i.estoqueMaximo, 0)}` },
              { chave: 'c', titulo: 'Custo médio', alinhar: 'right', mono: true, render: (i) => <strong>{brl(i.custoMedio)}<span className="text-ink-3 text-[12px] font-normal">/{i.unidadeConsumo}</span></strong> },
              { chave: 'a', titulo: 'ABC', render: (i) => (i.classeABC ? <Pill tom={i.classeABC === 'A' ? 'primary' : i.classeABC === 'B' ? 'info' : 'neutral'}>{i.classeABC}</Pill> : <span className="text-ink-3">—</span>) },
              { chave: 'x', titulo: 'Situação', render: (i) => (i.tipo === 'SERVICO_EXTERNO' ? <span className="text-ink-3">—</span> : <SituacaoPill s={situacaoItem(i)} />) }
            ]}
          />
        )}
      </Listagem>
    </>
  );
}
