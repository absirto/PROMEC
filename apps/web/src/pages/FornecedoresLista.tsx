import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Star, Truck } from 'lucide-react';
import { api } from '../lib/api';
import type { Fornecedor, Lista, StatusCliente } from '../lib/types';
import { mascaraDocumento } from '../lib/documento';
import { num, toNum } from '../lib/format';
import { HeroBand } from '../components/HeroBand';
import { Kpi } from '../components/Card';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { StatusClientePill } from '../components/Pill';
import { Listagem } from '../components/Listagem';
import { Estrelas } from '../components/Estrelas';
import { TIPO_ITEM } from '../features/suprimentos/sup';
import { useTitulo } from '../layout/titulo';

type Filtro = 'todos' | StatusCliente;

export default function FornecedoresLista() {
  useTitulo('Fornecedores');
  const [busca, setBusca] = useState('');
  const termo = useDeferredValue(busca.trim());
  const q = useQuery({ queryKey: ['fornecedores', termo], queryFn: () => api<Lista<Fornecedor> | Fornecedor[]>('/fornecedores', { query: { q: termo } }), placeholderData: (p) => p });
  const todos = Array.isArray(q.data) ? q.data : q.data?.itens ?? [];
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const n = (s: Filtro) => (s === 'todos' ? todos.length : todos.filter((f) => f.status === s).length);
  const linhas = todos.filter((f) => filtro === 'todos' || f.status === filtro);
  const media = todos.length ? todos.reduce((a, f) => a + toNum(f.avaliacao), 0) / todos.length : 0;
  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        titulo={<>Fornecedores <span className="mono text-[22px] font-medium opacity-80">{todos.length || ''}</span></>}
        texto="Quem entrega material e serviço. A nota sobe com entrega no prazo e cai com divergência e não-conformidade."
        acoes={<Button variante="primario" icone={Plus} to="/fornecedores/novo">Novo fornecedor</Button>}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi tom="steel" icone={<Truck className="size-5" aria-hidden />} valor={n('ATIVO')} rotulo="fornecedores ativos" />
        <Kpi tom="warn" icone={<Star className="size-5" aria-hidden />} valor={num(media, 1)} rotulo="avaliação média" />
      </div>
      <Listagem<Filtro>
        rotulo="Lista de fornecedores"
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar por nome, CNPJ ou cidade"
        filtros={[{ valor: 'todos', rotulo: 'Todos', n: n('todos') }, { valor: 'ATIVO', rotulo: 'Ativos', n: n('ATIVO') }, { valor: 'BLOQUEADO', rotulo: 'Bloqueados', n: n('BLOQUEADO') }, { valor: 'INATIVO', rotulo: 'Inativos', n: n('INATIVO') }]}
        filtro={filtro}
        onFiltro={setFiltro}
        carregando={q.isLoading}
        erro={q.error}
        tentar={() => q.refetch()}
        vazio={q.isSuccess && todos.length === 0 && !termo ? <EmptyState ilustracao="prancheta" titulo="Nenhum fornecedor" texto="Cadastre quem entrega a matéria-prima principal: o comparativo de cotação começa por ele." acao={<Button variante="primario" icone={Plus} to="/fornecedores/novo">Novo fornecedor</Button>} /> : null}
        semResultado={linhas.length === 0}
        total={todos.length}
        mostrando={linhas.length}
      >
        {linhas.length > 0 && (
          <DataTable<Fornecedor>
            rotulo="Fornecedores"
            linhas={linhas}
            chave={(f) => f.id}
            href={(f) => `/fornecedores/${f.id}`}
            rotuloLinha={(f) => f.nome}
            colunas={[
              { chave: 'n', titulo: 'Fornecedor', principal: true, render: (f) => (
                <span className="flex flex-col min-w-0">
                  <Link to={`/fornecedores/${f.id}`} className="font-semibold text-ink-1 no-underline hover:underline">{f.fantasia || f.nome}</Link>
                  <span className="text-caption text-ink-3 truncate">{(f.categorias ?? []).map((c) => TIPO_ITEM[c] ?? c).join(', ')}</span>
                </span>
              ) },
              { chave: 'd', titulo: 'CPF ou CNPJ', mono: true, render: (f) => mascaraDocumento(f.tipo, f.documento ?? '') },
              { chave: 'c', titulo: 'Cidade', render: (f) => (f.cidade ? `${f.cidade}${f.uf ? `/${f.uf}` : ''}` : '—') },
              { chave: 'p', titulo: 'Prazo médio', alinhar: 'right', mono: true, render: (f) => `${f.prazoMedioDias ?? '—'} dias` },
              { chave: 'a', titulo: 'Avaliação', render: (f) => <span className="inline-flex items-center gap-2"><Estrelas valor={f.avaliacao} tamanho={14} /><span className="text-caption text-ink-3">{f.entregas} entregas</span></span> },
              { chave: 's', titulo: 'Situação', render: (f) => <StatusClientePill status={f.status} /> }
            ]}
          />
        )}
      </Listagem>
    </>
  );
}
