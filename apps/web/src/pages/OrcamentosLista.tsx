import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, TrendingDown, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import type { ListaOrcamentos, OrcamentoResumo, StatusOrcamento } from '../lib/types';
import { brl, data, pct, toNum } from '../lib/format';
import { HeroBand } from '../components/HeroBand';
import { Kpi } from '../components/Card';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { MargemPill, rotuloOrcamento, StatusOrcamentoPill } from '../components/Pill';
import { Listagem } from '../components/Listagem';
import { useTitulo } from '../layout/titulo';

type Filtro = 'todos' | StatusOrcamento;
const STATUS: StatusOrcamento[] = ['RASCUNHO', 'ENVIADO', 'EM_NEGOCIACAO', 'APROVADO', 'RECUSADO', 'EXPIRADO', 'CONVERTIDO'];

export default function OrcamentosLista() {
  useTitulo('Orçamentos');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const termo = useDeferredValue(busca.trim());
  const q = useQuery({
    queryKey: ['orcamentos', 'lista', filtro, termo],
    queryFn: () => api<ListaOrcamentos>('/orcamentos', { query: { status: filtro === 'todos' ? undefined : filtro, q: termo } }),
    placeholderData: (p) => p
  });
  const itens = q.data?.itens ?? [];
  const cont = q.data?.contagem ?? {};
  const totalGeral = STATUS.reduce((a, s) => a + (cont[s] ?? 0), 0);
  const abertos = itens.filter((o) => o.status === 'ENVIADO' || o.status === 'EM_NEGOCIACAO');
  const abaixo = itens.filter((o) => o.situacaoMargem === 'perigo' && (o.status === 'RASCUNHO' || o.status === 'EM_NEGOCIACAO')).length;

  return (
    <>
      <HeroBand
        ilustracao="paquimetro"
        titulo="Orçamentos"
        texto="Cada preço com a conta aberta: material, hora de máquina, setup, rateio e margem. Nada de número tirado da cartola."
        acoes={<Button variante="primario" icone={Plus} to="/orcamentos/novo">Novo orçamento</Button>}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi tom="steel" icone={<FileText className="size-5" aria-hidden />} valor={(cont.ENVIADO ?? 0) + (cont.EM_NEGOCIACAO ?? 0)} rotulo="esperando o cliente" />
        <Kpi tom="primary" icone={<Wallet className="size-5" aria-hidden />} valor={brl(abertos.reduce((a, o) => a + toNum(o.precoFinalLote), 0))} rotulo="em aberto nesta lista" />
        <Kpi tom="bad" icone={<TrendingDown className="size-5" aria-hidden />} valor={abaixo} rotulo="com margem abaixo do mínimo" />
      </div>
      <Listagem<Filtro>
        rotulo="Lista de orçamentos"
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar por número, peça ou cliente"
        filtros={[{ valor: 'todos' as Filtro, rotulo: 'Todos', n: totalGeral }, ...STATUS.filter((s) => cont[s]).map((s) => ({ valor: s as Filtro, rotulo: rotuloOrcamento(s), n: cont[s] }))]}
        filtro={filtro}
        onFiltro={setFiltro}
        carregando={q.isLoading}
        erro={q.error}
        tentar={() => q.refetch()}
        vazio={
          q.isSuccess && totalGeral === 0 && itens.length === 0 && !termo ? (
            <EmptyState
              ilustracao="paquimetro"
              titulo="Nenhum orçamento ainda"
              texto="Monte o primeiro: escolha o cliente, coloque o material e as operações, e o preço aparece enquanto você digita."
              acao={<Button variante="primario" icone={Plus} to="/orcamentos/novo">Novo orçamento</Button>}
            />
          ) : null
        }
        semResultado={itens.length === 0}
        total={filtro === 'todos' ? q.data?.total ?? 0 : cont[filtro] ?? q.data?.total ?? 0}
        mostrando={itens.length}
      >
        {itens.length > 0 && (
          <DataTable<OrcamentoResumo>
            rotulo="Orçamentos"
            linhas={itens}
            chave={(o) => o.id}
            href={(o) => `/orcamentos/${o.id}`}
            rotuloLinha={(o) => o.numero}
            colunas={[
              {
                chave: 't',
                titulo: 'Orçamento',
                principal: true,
                render: (o) => (
                  <span className="flex flex-col min-w-0">
                    <span className="mono text-caption text-ink-3">{o.numero} · v{o.versao}</span>
                    <Link to={`/orcamentos/${o.id}`} className="font-semibold text-ink-1 no-underline hover:underline">{o.titulo}</Link>
                    <span className="text-caption text-ink-2">{o.cliente?.nome}</span>
                  </span>
                )
              },
              { chave: 'l', titulo: 'Lote', alinhar: 'right', mono: true, render: (o) => `${o.lote} pç` },
              { chave: 'p', titulo: 'Preço do lote', alinhar: 'right', mono: true, render: (o) => <strong>{brl(o.precoFinalLote)}</strong> },
              { chave: 'm', titulo: 'Margem', render: (o) => <MargemPill situacao={o.situacaoMargem}><span className="mono">{pct(o.margemEfetiva)}</span></MargemPill> },
              { chave: 's', titulo: 'Situação', render: (o) => <StatusOrcamentoPill status={o.status} /> },
              { chave: 'v', titulo: 'Validade', mono: true, render: (o) => data(o.validade) }
            ]}
          />
        )}
      </Listagem>
    </>
  );
}
