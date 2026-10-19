import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Plus, UserCheck, Wallet } from 'lucide-react';
import { useColaboradores } from '../lib/queries';
import { brl, iniciais, pct, toNum } from '../lib/format';
import { VINCULO } from '../lib/rotulos';
import { HeroBand } from '../components/HeroBand';
import { Kpi } from '../components/Card';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Listagem, normalizar } from '../components/Listagem';
import { useTitulo } from '../layout/titulo';

type Filtro = 'todos' | 'ativos' | 'inativos';

export default function ColaboradoresLista() {
  useTitulo('Funcionários');
  const q = useColaboradores();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('ativos');
  const todos = q.data?.itens ?? [];
  const termo = normalizar(busca.trim());
  const ativos = todos.filter((c) => c.ativo);
  const linhas = todos.filter(
    (c) => (filtro === 'todos' || (filtro === 'ativos') === c.ativo) && (!termo || normalizar(`${c.nome} ${c.funcao} ${VINCULO[c.vinculo]}`).includes(termo))
  );
  const folha = ativos.reduce((a, c) => a + toNum(c.custoMensal), 0);
  const horaMedia = ativos.length ? ativos.reduce((a, c) => a + toNum(c.custoHora), 0) / ativos.length : 0;
  const semCentro = ativos.filter((c) => c.alocacoes.length === 0).length;

  return (
    <>
      <HeroBand
        ilustracao="equipe"
        titulo={<>Funcionários <span className="mono text-[22px] font-medium opacity-80">{todos.length || ''}</span></>}
        texto="Quem faz a oficina rodar. O custo de cada pessoa entra no custo-hora dos centros em que ela trabalha."
        acoes={<Button variante="primario" icone={Plus} to="/colaboradores/novo">Novo funcionário</Button>}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi tom="ok" icone={<UserCheck className="size-5" aria-hidden />} valor={ativos.length} rotulo="pessoas ativas" />
        <Kpi tom="primary" icone={<Wallet className="size-5" aria-hidden />} valor={brl(folha)} rotulo="custo mensal com encargos" />
        <Kpi tom="steel" icone={<Clock className="size-5" aria-hidden />} valor={brl(horaMedia)} rotulo="custo-hora médio" />
        <Kpi tom="warn" icone={<UserCheck className="size-5" aria-hidden />} valor={semCentro} rotulo="sem centro de trabalho" />
      </div>
      <Listagem<Filtro>
        rotulo="Lista de funcionários"
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar por nome, função ou vínculo"
        filtros={[
          { valor: 'ativos', rotulo: 'Ativos', n: ativos.length },
          { valor: 'inativos', rotulo: 'Inativos', n: todos.length - ativos.length },
          { valor: 'todos', rotulo: 'Todos', n: todos.length }
        ]}
        filtro={filtro}
        onFiltro={setFiltro}
        carregando={q.isLoading}
        erro={q.error}
        tentar={() => q.refetch()}
        vazio={
          q.isSuccess && todos.length === 0 ? (
            <EmptyState
              ilustracao="equipe"
              titulo="Ninguém cadastrado ainda"
              texto="Comece pelo operador da sua principal máquina: com o salário e os encargos, o custo-hora dela fica completo."
              acao={<Button variante="primario" icone={Plus} to="/colaboradores/novo">Novo funcionário</Button>}
            />
          ) : null
        }
        semResultado={linhas.length === 0}
        total={todos.length}
        mostrando={linhas.length}
      >
        {linhas.length > 0 && (
          <DataTable
            rotulo="Funcionários"
            linhas={linhas}
            chave={(c) => c.id}
            href={(c) => `/colaboradores/${c.id}`}
            rotuloLinha={(c) => c.nome}
            colunas={[
              {
                chave: 'nome',
                titulo: 'Nome',
                principal: true,
                render: (c) => (
                  <span className="flex items-center gap-3">
                    <span className="size-[38px] rounded-full grid place-items-center text-white font-bold text-[13px] flex-none bg-steel-2">{iniciais(c.nome)}</span>
                    <span className="flex flex-col min-w-0">
                      <Link to={`/colaboradores/${c.id}`} className="font-semibold text-ink-1 no-underline hover:underline">{c.nome}</Link>
                      <span className="text-caption text-ink-3">{c.funcao}</span>
                    </span>
                  </span>
                )
              },
              { chave: 'v', titulo: 'Vínculo', render: (c) => VINCULO[c.vinculo] },
              {
                chave: 'cen',
                titulo: 'Centros',
                render: (c) => (c.alocacoes.length ? c.alocacoes.map((a) => `${a.centroNome} (${pct(a.alocacao, 0)})`).join(', ') : <span className="text-ink-3">nenhum</span>)
              },
              { chave: 'cm', titulo: 'Custo mensal', alinhar: 'right', mono: true, render: (c) => brl(c.custoMensal) },
              { chave: 'ch', titulo: 'Custo-hora', alinhar: 'right', mono: true, render: (c) => <strong>{brl(c.custoHora)}</strong> },
              { chave: 's', titulo: 'Situação', render: (c) => (c.ativo ? <Pill tom="ok">Ativo</Pill> : <Pill tom="neutral">Inativo</Pill>) }
            ]}
          />
        )}
      </Listagem>
    </>
  );
}
