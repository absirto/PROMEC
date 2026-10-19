import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Cpu, Plus, TrendingUp, Wrench } from 'lucide-react';
import { useCentros } from '../lib/queries';
import type { Centro } from '../lib/types';
import { brl, horas, toNum } from '../lib/format';
import { TIPO_CENTRO, corTipoCentro } from '../lib/rotulos';
import { HeroBand } from '../components/HeroBand';
import { Kpi } from '../components/Card';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { StatusCentroPill } from '../components/Pill';
import { Listagem, normalizar } from '../components/Listagem';
import { useTitulo } from '../layout/titulo';

type Filtro = 'todos' | Centro['status'];
const horasReais = (c: Centro) => toNum(c.horasExpediente) * toNum(c.eficiencia);

export default function CentrosLista() {
  useTitulo('Centros de trabalho');
  const q = useCentros();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const todos = q.data?.itens ?? [];
  const n = (s: Filtro) => (s === 'todos' ? todos.length : todos.filter((c) => c.status === s).length);
  const termo = normalizar(busca.trim());
  const linhas = todos.filter(
    (c) => (filtro === 'todos' || c.status === filtro) && (!termo || normalizar(`${c.nome} ${c.codigo} ${TIPO_CENTRO[c.tipo]} ${c.operadores.map((o) => o.nome).join(' ')}`).includes(termo))
  );
  const ativos = todos.filter((c) => c.status === 'ativo');
  const comCusto = ativos.filter((c) => c.custoHoraVigente);
  const medio = comCusto.length ? comCusto.reduce((a, c) => a + toNum(c.custoHoraVigente), 0) / comCusto.length : null;

  return (
    <>
      <HeroBand
        ilustracao="torno"
        titulo={<>Centros de trabalho <span className="mono text-[22px] font-medium opacity-80">{todos.length || ''}</span></>}
        texto="Máquinas, boxes, bancadas e células de solda. Cada um tem o seu custo-hora."
        acoes={<Button variante="primario" icone={Plus} to="/centros-trabalho/novo">Novo centro de trabalho</Button>}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi tom="ok" icone={<Cpu className="size-5" aria-hidden />} valor={ativos.length} rotulo="centros produzindo" />
        <Kpi tom="primary" icone={<TrendingUp className="size-5" aria-hidden />} valor={medio === null ? '—' : brl(medio)} rotulo="custo-hora médio na tabela vigente" />
        <Kpi tom="steel" icone={<Clock className="size-5" aria-hidden />} valor={horas(ativos.reduce((a, c) => a + horasReais(c), 0), 0)} rotulo="horas reais por mês" />
        <Kpi tom="warn" icone={<Wrench className="size-5" aria-hidden />} valor={n('manutencao')} rotulo="em manutenção" />
      </div>
      <Listagem<Filtro>
        rotulo="Lista de centros de trabalho"
        busca={busca}
        onBusca={setBusca}
        placeholder="Buscar por nome, código, tipo ou operador"
        filtros={[
          { valor: 'todos', rotulo: 'Todos', n: n('todos') },
          { valor: 'ativo', rotulo: 'Ativos', n: n('ativo') },
          { valor: 'manutencao', rotulo: 'Em manutenção', n: n('manutencao') },
          { valor: 'desativado', rotulo: 'Desativados', n: n('desativado') }
        ]}
        filtro={filtro}
        onFiltro={setFiltro}
        carregando={q.isLoading}
        erro={q.error}
        tentar={() => q.refetch()}
        vazio={
          q.isSuccess && todos.length === 0 ? (
            <EmptyState
              ilustracao="torno"
              titulo="Nenhum centro de trabalho"
              texto="Cadastre a primeira máquina: em três minutos você sabe quanto custa a hora dela."
              acao={<Button variante="primario" icone={Plus} to="/centros-trabalho/novo">Novo centro de trabalho</Button>}
            />
          ) : null
        }
        semResultado={linhas.length === 0}
        total={todos.length}
        mostrando={linhas.length}
      >
        {linhas.length > 0 && (
          <DataTable
            rotulo="Centros de trabalho"
            linhas={linhas}
            chave={(c) => c.id}
            href={(c) => `/centros-trabalho/${c.id}`}
            rotuloLinha={(c) => c.nome}
            colunas={[
              {
                chave: 'nome',
                titulo: 'Centro de trabalho',
                principal: true,
                render: (c) => (
                  <span className="flex items-center gap-3">
                    <span className="size-[38px] rounded-control grid place-items-center text-white font-display font-bold text-[15px] flex-none" style={{ background: corTipoCentro[c.tipo] }}>
                      {c.nome.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <Link to={`/centros-trabalho/${c.id}`} className="font-semibold text-ink-1 no-underline hover:underline">{c.nome}</Link>
                      <span className="mono text-caption text-ink-3">{c.codigo}</span>
                    </span>
                  </span>
                )
              },
              { chave: 'tipo', titulo: 'Tipo', render: (c) => TIPO_CENTRO[c.tipo] },
              { chave: 'op', titulo: 'Operador', render: (c) => (c.operadores.length ? c.operadores.map((o) => o.nome.split(' ')[0]).join(', ') : <span className="text-ink-3">ninguém alocado</span>) },
              { chave: 'h', titulo: 'Horas reais', alinhar: 'right', mono: true, render: (c) => horas(horasReais(c), 0) },
              { chave: 'ch', titulo: 'Custo-hora cheio', alinhar: 'right', mono: true, render: (c) => (c.custoHoraVigente ? <strong>{brl(c.custoHoraVigente)}</strong> : <span className="text-ink-3">sem tabela</span>) },
              { chave: 's', titulo: 'Situação', render: (c) => <StatusCentroPill status={c.status} /> }
            ]}
          />
        )}
      </Listagem>
    </>
  );
}
