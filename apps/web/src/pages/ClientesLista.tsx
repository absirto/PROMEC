import { useAuth } from '../lib/auth';
import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, ShieldAlert, ThumbsUp, UserRound } from 'lucide-react';
import { useClientes } from '../lib/queries';
import type { Cliente, StatusCliente } from '../lib/types';
import { brl, iniciais, toNum } from '../lib/format';
import { mascaraDocumento, mascaraTelefone } from '../lib/documento';
import { HeroBand } from '../components/HeroBand';
import { Kpi } from '../components/Card';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { StatusClientePill } from '../components/Pill';
import { Listagem } from '../components/Listagem';
import { useTitulo } from '../layout/titulo';

type Filtro = 'todos' | StatusCliente;

export default function ClientesLista() {
  const { pode: podeFn_ } = useAuth();
  const podeGerir = podeFn_('cadastros.gerenciar');
  useTitulo('Clientes');
  const [busca, setBusca] = useState('');
  const termo = useDeferredValue(busca.trim());
  const q = useClientes(termo);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const todos = q.data?.itens ?? [];
  const n = (s: Filtro) => (s === 'todos' ? todos.length : todos.filter((c) => c.status === s).length);
  const linhas = todos.filter((c) => filtro === 'todos' || c.status === filtro);
  const aprovado = todos.reduce((a, c) => a + toNum(c.resumo?.valorAprovado), 0);

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        titulo={<>Clientes <span className="mono text-[22px] font-medium opacity-80">{q.data?.total ?? ''}</span></>}
        texto="Quem confia o serviço à oficina. Cada cliente guarda os orçamentos, o que foi aprovado e quanto isso rendeu."
        acoes={podeGerir && <Button variante="primario" icone={Plus} to="/clientes/novo">Novo cliente</Button>}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi tom="ok" icone={<Building2 className="size-5" aria-hidden />} valor={n('ATIVO')} rotulo="clientes ativos" />
        <Kpi tom="primary" icone={<ThumbsUp className="size-5" aria-hidden />} valor={brl(aprovado)} rotulo="aprovado no total" />
        <Kpi tom="bad" icone={<ShieldAlert className="size-5" aria-hidden />} valor={n('BLOQUEADO')} rotulo="bloqueados" />
      </div>
      <Listagem<Filtro>
        rotulo="Lista de clientes"
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar por nome, fantasia, CNPJ ou cidade"
        filtros={[
          { valor: 'todos', rotulo: 'Todos', n: n('todos') },
          { valor: 'ATIVO', rotulo: 'Ativos', n: n('ATIVO') },
          { valor: 'BLOQUEADO', rotulo: 'Bloqueados', n: n('BLOQUEADO') },
          { valor: 'INATIVO', rotulo: 'Inativos', n: n('INATIVO') }
        ]}
        filtro={filtro}
        onFiltro={setFiltro}
        carregando={q.isLoading}
        erro={q.error}
        tentar={() => q.refetch()}
        vazio={
          q.isSuccess && todos.length === 0 && !termo ? (
            <EmptyState
              ilustracao="prancheta"
              titulo="Nenhum cliente por aqui"
              texto="Cadastre quem mais pede serviço. Com o CNPJ em mãos, leva um minuto."
              acao={podeGerir && <Button variante="primario" icone={Plus} to="/clientes/novo">Novo cliente</Button>}
            />
          ) : null
        }
        semResultado={linhas.length === 0}
        total={todos.length}
        mostrando={linhas.length}
      >
        {linhas.length > 0 && (
          <DataTable<Cliente>
            rotulo="Clientes"
            linhas={linhas}
            chave={(c) => c.id}
            href={(c) => `/clientes/${c.id}`}
            rotuloLinha={(c) => c.nome}
            colunas={[
              {
                chave: 'nome',
                titulo: 'Cliente',
                principal: true,
                render: (c) => (
                  <span className="flex items-center gap-3">
                    <span className={`size-[38px] rounded-control grid place-items-center text-white font-bold text-[13px] flex-none ${c.tipo === 'PJ' ? 'bg-steel' : 'bg-[#7C5CC4]'}`}>
                      {c.tipo === 'PJ' ? iniciais(c.fantasia || c.nome) : <UserRound className="size-[18px]" aria-label="Pessoa física" />}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <Link to={`/clientes/${c.id}`} className="font-semibold text-ink-1 no-underline hover:underline">{c.fantasia || c.nome}</Link>
                      {c.fantasia && <span className="text-caption text-ink-3 truncate">{c.nome}</span>}
                    </span>
                  </span>
                )
              },
              { chave: 'doc', titulo: 'CPF ou CNPJ', mono: true, render: (c) => mascaraDocumento(c.tipo, c.documento) },
              { chave: 'cid', titulo: 'Cidade', render: (c) => (c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ''}` : '—') },
              { chave: 'ct', titulo: 'Contato', render: (c) => <span className="flex flex-col"><span className="truncate max-w-[220px]">{c.email || '—'}</span><span className="mono text-caption text-ink-3">{c.telefone ? mascaraTelefone(c.telefone) : ''}</span></span> },
              { chave: 'orc', titulo: 'Orçamentos', alinhar: 'right', mono: true, render: (c) => (c.resumo ? `${c.resumo.orcamentos} · ${c.resumo.aprovados} aprov.` : '—') },
              { chave: 'v', titulo: 'Aprovado', alinhar: 'right', mono: true, render: (c) => (c.resumo ? brl(c.resumo.valorAprovado) : '—') },
              { chave: 's', titulo: 'Situação', render: (c) => <StatusClientePill status={c.status} /> }
            ]}
          />
        )}
      </Listagem>
    </>
  );
}

