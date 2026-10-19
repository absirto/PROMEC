import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FilePlus2, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import type { TabelaDetalhe, TabelaResumo } from '../lib/types';
import { brl, competenciaAtual, competenciaLonga, data, somarMes } from '../lib/format';
import { HeroBand } from '../components/HeroBand';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill, StatusTabelaPill } from '../components/Pill';
import { CompetenciaPicker } from '../components/CompetenciaPicker';
import { useAcao } from '../lib/queries';
import { useTitulo } from '../layout/titulo';

export default function TabelasCustos() {
  useTitulo('Tabela de Custos');
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['tabelas-custos', 'lista'], queryFn: () => api<TabelaResumo[] | { itens: TabelaResumo[] }>('/tabelas-custos') });
  const lista = Array.isArray(q.data) ? q.data : q.data?.itens ?? [];
  const [comp, setComp] = useState(() => somarMes(competenciaAtual(), 0));
  const criar = useAcao((c: string) => api<TabelaDetalhe>('/tabelas-custos', { method: 'POST', body: { competencia: c } }), {
    invalida: [['tabelas-custos']],
    sucesso: (_r, c) => `Rascunho de ${competenciaLonga(c)} criado com os cadastros de hoje. Confira e publique quando estiver tudo certo.`,
    onSuccess: (r) => r?.id && navigate(`/tabelas-custos/${r.id}`)
  });
  const vigente = lista.find((t) => t.status === 'VIGENTE');

  return (
    <>
      <HeroBand
        ilustracao="engrenagens"
        titulo="Tabela de Custos"
        texto={
          vigente
            ? `Os orçamentos de hoje usam a tabela de ${competenciaLonga(vigente.competencia)}, versão ${vigente.versao}. Nada muda neles até você publicar outra.`
            : 'Cada versão é uma foto dos custos do mês: custo fixo, máquinas e pessoas viram custo-hora. Publique uma para os orçamentos usarem.'
        }
        acoes={
          <>
            <CompetenciaPicker escuro valor={comp} onChange={setComp} />
            <Button variante="primario" icone={FilePlus2} carregando={criar.isPending} onClick={() => criar.mutate(comp)}>
              Criar rascunho
            </Button>
          </>
        }
      />
      <Card className="overflow-hidden" aria-label="Versões da Tabela de Custos">
        {q.isLoading && <Carregando />}
        {q.isError && <ErroEstado erro={q.error} tentar={() => q.refetch()} />}
        {q.isSuccess && lista.length === 0 && (
          <EmptyState
            ilustracao="engrenagens"
            titulo="Nenhuma versão por aqui ainda"
            texto="Escolha o mês acima e crie o rascunho: o ProMEC junta o custo fixo, as máquinas e as pessoas e calcula quanto custa cada hora."
          />
        )}
        {lista.length > 0 && (
          <ul className="list-none m-0 p-0">
            {lista.map((t) => (
              <li key={t.id} className="border-b border-border last:border-0">
                <Link to={`/tabelas-custos/${t.id}`} className="no-underline text-ink-1 flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-surface-2 transition-colors">
                  <span className="flex flex-col min-w-[200px] flex-[1_1_220px]">
                    <span className="font-display text-[22px] font-bold leading-tight">
                      {competenciaLonga(t.competencia)} <span className="mono text-[15px] font-medium text-ink-3">v{t.versao}</span>
                    </span>
                    <span className="text-caption text-ink-3">
                      {t.publicadaEm ? `publicada em ${data(t.publicadaEm)}` : `criada em ${data(t.criadaEm)}`}
                    </span>
                  </span>
                  <StatusTabelaPill status={t.status} desatualizada={t.desatualizada} />
                  <span className="flex flex-col text-right min-w-[110px]">
                    <span className="mono font-semibold">{brl(t.resumo.cheioMedio)}<span className="text-ink-3 text-[12px]">/h</span></span>
                    <span className="text-caption text-ink-3">custo-hora médio</span>
                  </span>
                  <span className="flex flex-col text-right min-w-[110px]">
                    <span className="mono font-semibold">{brl(t.resumo.custoFixo)}</span>
                    <span className="text-caption text-ink-3">custo fixo · {t.resumo.centros} centros</span>
                  </span>
                  {t.resumo.bloqueios > 0 ? (
                    <Pill tom="bad" icone={ShieldAlert}>{t.resumo.bloqueios} {t.resumo.bloqueios === 1 ? 'bloqueio' : 'bloqueios'}</Pill>
                  ) : (
                    <span className="w-[96px] max-sm:hidden" />
                  )}
                  <ChevronRight className="size-[18px] text-ink-3 ml-auto" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
