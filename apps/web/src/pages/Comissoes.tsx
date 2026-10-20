import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleDot, Lock } from 'lucide-react';
import { api } from '../lib/api';
import type { Comissoes as DadosComissoes } from '../lib/types';
import { brl, competenciaAtual, competenciaLonga, iniciais, mesNome, pct, toNum } from '../lib/format';
import { useAcao } from '../lib/queries';
import { useAuth } from '../lib/auth';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Aviso, Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { CompetenciaPicker } from '../components/CompetenciaPicker';
import { useTitulo } from '../layout/titulo';

type Vendedor = DadosComissoes['vendedores'][number];
type ItemComissao = Vendedor['itens'][number];

const percentual = (v: string) => {
  const n = toNum(v);
  return pct(n > 1 ? n / 100 : n, 2);
};
const referencia = (i: ItemComissao) => [typeof i.os === 'string' ? i.os : i.os?.numero, i.tituloNumero ?? i.titulo?.numero, i.cliente].filter(Boolean).join(' · ') || i.descricao || 'Recebimento';

function CartaoVendedor({ v }: { v: Vendedor }) {
  return (
    <Card className="p-5 flex flex-col gap-3" aria-label={`Comissão de ${v.vendedor.nome}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="size-11 rounded-full bg-steel-soft text-steel grid place-items-center font-semibold flex-none" aria-hidden>{iniciais(v.vendedor.nome)}</span>
        <div className="flex-1 min-w-[160px] flex flex-col">
          <h2 className="m-0 font-sans text-headline">{v.vendedor.nome}</h2>
          <span className="text-[13px] text-ink-3">sobre <span className="mono">{brl(v.base)}</span> recebidos</span>
        </div>
        <span className="mono text-[26px] font-bold">{brl(v.valor)}</span>
      </div>
      {v.itens.length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-col" aria-label={`Recebimentos de ${v.vendedor.nome}`}>
          {v.itens.map((i, n) => (
            <li key={i.tituloId ?? n} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-t border-border text-[14px]">
              <span className="flex-[1_1_180px] min-w-0 truncate mono">{referencia(i)}</span>
              <span className="mono text-ink-2">{brl(i.base)}</span>
              <span className="mono text-ink-3 w-[64px] text-right">{percentual(i.percentual)}</span>
              <span className="mono font-semibold w-[110px] text-right">{brl(i.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Comissoes() {
  useTitulo('Comissões');
  const { pode: podeFn } = useAuth();
  const pode = podeFn('financeiro.gerenciar');
  const [sp, setSp] = useSearchParams();
  const comp = sp.get('competencia') ?? competenciaAtual();
  const setComp = (c: string) => setSp({ competencia: c }, { replace: true });
  const [confirmar, setConfirmar] = useState(false);

  const q = useQuery({ queryKey: ['financeiro', 'comissoes', comp], queryFn: () => api<DadosComissoes>('/financeiro/comissoes', { query: { competencia: comp } }) });
  const vendedores = q.data?.vendedores ?? [];
  const total = q.data?.total ?? vendedores.reduce((a, v) => a + toNum(v.valor), 0);
  const fechada = !!q.data?.fechada;

  const fechar = useAcao(() => api('/financeiro/comissoes/fechar', { method: 'POST', body: { competencia: comp } }), {
    invalida: [['financeiro']],
    sucesso: `Comissões de ${mesNome(comp)} fechadas. Os títulos a pagar já estão em Contas a pagar.`,
    onSuccess: () => setConfirmar(false)
  });

  return (
    <>
      <HeroBand
        ilustracao="prancheta"
        titulo="Comissões"
        texto="Calculadas na baixa de cada recebimento de OS, pelo percentual do orçamento. Confira por vendedor e feche o mês para virar conta a pagar."
        acoes={
          <>
            <CompetenciaPicker escuro valor={comp} onChange={setComp} />
            {pode && !fechada && vendedores.length > 0 && (
              <Button variante="primario" icone={Lock} onClick={() => setConfirmar(true)}>Fechar a competência</Button>
            )}
          </>
        }
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <HeroKpi destaque rotulo={`Total de ${competenciaLonga(comp)}`} valor={brl(total)} sub={`${vendedores.length} ${vendedores.length === 1 ? 'vendedor' : 'vendedores'}`} />
          <HeroKpi
            rotulo="Situação"
            valor={q.data ? (fechada ? 'Fechada' : 'Aberta') : '—'}
            sub={fechada ? 'títulos a pagar gerados, mês travado' : 'ainda recebe novas baixas'}
          />
        </div>
      </HeroBand>

      <div className="flex flex-wrap items-center gap-2">
        {q.data && (fechada
          ? <Pill tom="ok" icone={CheckCircle2}>Competência fechada</Pill>
          : <Pill tom="warn" icone={CircleDot}>Competência aberta</Pill>)}
        {!pode && !fechada && vendedores.length > 0 && (
          <span className="text-[13.5px] text-ink-2">O fechamento é feito pelo gestor. Se algo não bate, avise antes do fim do mês.</span>
        )}
      </div>

      {fechada && (
        <Aviso tom="ok" titulo={`${competenciaLonga(comp)} está fechada`}>
          Cada vendedor ganhou um título a pagar no centro de custo Comissões. A competência ficou travada para novas comissões.
        </Aviso>
      )}

      {q.isLoading && <Card><Carregando /></Card>}
      {q.isError && <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>}
      {q.isSuccess && vendedores.length === 0 && (
        <Card>
          <EmptyState
            titulo={`Nenhuma comissão em ${mesNome(comp)}`}
            texto="A comissão nasce quando um recebimento de OS é baixado. Assim que entrar dinheiro de cliente neste mês, ela aparece aqui."
          />
        </Card>
      )}
      {vendedores.map((v) => <CartaoVendedor key={v.vendedor.id} v={v} />)}
      {vendedores.length > 0 && (
        <Card className="flex items-center justify-between gap-3 px-5 py-4 border-t-2 border-ink-1">
          <span className="text-ink-2">Total de comissões do mês</span>
          <span className="mono text-[22px] font-bold">{brl(total)}</span>
        </Card>
      )}

      <Modal
        aberto={confirmar}
        onFechar={() => setConfirmar(false)}
        faixa
        titulo={`Fechar ${competenciaLonga(comp)}?`}
        rodape={
          <>
            <Button onClick={() => setConfirmar(false)}>Ainda não</Button>
            <Button variante="primario" icone={Lock} carregando={fechar.isPending} onClick={() => fechar.mutate(undefined)}>Fechar e gerar títulos</Button>
          </>
        }
      >
        <p className="m-0 text-ink-2">Ao fechar, acontece o seguinte:</p>
        <ul className="m-0 p-0 list-none flex flex-col">
          {vendedores.map((v) => (
            <li key={v.vendedor.id} className="flex justify-between gap-3 py-2 border-t border-border first:border-0 text-[14px]">
              <span>Título a pagar para {v.vendedor.nome}</span>
              <span className="mono font-semibold">{brl(v.valor)}</span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[14px] text-ink-2">
          Todos no centro de custo Comissões, competência {competenciaLonga(comp)}. Depois disso o mês fica travado e as comissões dele não mudam mais.
        </p>
      </Modal>
    </>
  );
}
