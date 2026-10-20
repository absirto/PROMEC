import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, CheckCircle2, CircleSlash, Pencil, Plus, Repeat } from 'lucide-react';
import { api } from '../lib/api';
import type { CentroCusto, Fornecedor, Lista, Recorrencia } from '../lib/types';
import { brl, competenciaAtual, competenciaLonga, data, mesNome, toNum } from '../lib/format';
import { useAcao } from '../lib/queries';
import { CATEGORIA } from '../lib/rotulos';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card, CardHeader } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { NumberField, SelectField, TextField, Toggle } from '../components/Field';
import { Busca, DataTable, FiltroChips, type Coluna } from '../components/DataTable';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { CompetenciaPicker } from '../components/CompetenciaPicker';
import { normalizar } from '../components/Listagem';
import { useTitulo } from '../layout/titulo';

const comoLista = <T,>(d: T[] | Lista<T> | null | undefined): T[] => (!d ? [] : Array.isArray(d) ? d : d.itens ?? []);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
type Filtro = 'ativas' | 'inativas' | 'todas';

const vigente = (r: Recorrencia, comp: string) => r.ativa && r.inicio.slice(0, 7) <= comp && (!r.fim || r.fim.slice(0, 7) >= comp);

const contarGerados = (r: unknown): number | undefined => {
  if (typeof r === 'number') return r;
  if (Array.isArray(r)) return r.length;
  if (r && typeof r === 'object') {
    for (const k of ['geradas', 'gerados', 'titulos', 'criados', 'total'] as const) {
      const v = (r as Record<string, unknown>)[k];
      if (typeof v === 'number') return v;
      if (Array.isArray(v)) return v.length;
    }
  }
  return undefined;
};

function useCentrosCusto() {
  return useQuery({ queryKey: ['financeiro', 'centros-custo'], queryFn: () => api<CentroCusto[] | Lista<CentroCusto>>('/financeiro/centros-custo'), select: comoLista, staleTime: 60_000 });
}

export default function Recorrencias() {
  useTitulo('Recorrências');
  const [editando, setEditando] = useState<Recorrencia | 'nova' | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('ativas');
  const [busca, setBusca] = useState('');
  const [comp, setComp] = useState(competenciaAtual());

  const q = useQuery({ queryKey: ['financeiro', 'recorrencias'], queryFn: () => api<Recorrencia[] | Lista<Recorrencia>>('/financeiro/recorrencias') });
  const fq = useQuery({ queryKey: ['fornecedores'], queryFn: () => api<Fornecedor[] | Lista<Fornecedor>>('/fornecedores') });
  const centros = useCentrosCusto();
  const todas = comoLista(q.data);
  const nomeForn = new Map(comoLista(fq.data).map((f) => [f.id, f.fantasia || f.nome]));
  const centroDe = new Map((centros.data ?? []).map((c) => [c.id, c]));

  const doMes = todas.filter((r) => vigente(r, comp));
  const totalMes = doMes.reduce((a, r) => a + toNum(r.valor), 0);
  const fixoMes = doMes.filter((r) => r.compoeCustoFixo ?? centroDe.get(r.centroCustoId)?.compoeCustoFixo).reduce((a, r) => a + toNum(r.valor), 0);

  const termo = normalizar(busca.trim());
  const visiveis = todas
    .filter((r) => (filtro === 'todas' ? true : filtro === 'ativas' ? r.ativa : !r.ativa))
    .filter((r) => !termo || normalizar(`${r.descricao} ${r.fornecedor?.nome ?? nomeForn.get(r.fornecedorId ?? '') ?? ''}`).includes(termo))
    .sort((a, b) => a.diaVencimento - b.diaVencimento);

  const gerar = useAcao(() => api<unknown>('/financeiro/recorrencias/gerar', { method: 'POST', body: { competencia: comp } }), {
    invalida: [['financeiro']],
    sucesso: (r) => {
      const n = contarGerados(r);
      if (n === undefined) return `Títulos de ${mesNome(comp)} conferidos. O que faltava já está em Contas a pagar.`;
      if (n === 0) return `Nada novo: os títulos de ${mesNome(comp)} já tinham sido gerados.`;
      return `${plural(n, 'título gerado', 'títulos gerados')} para ${mesNome(comp)}. Estão em Contas a pagar.`;
    }
  });

  const colunas: Coluna<Recorrencia>[] = [
    {
      chave: 'descricao', titulo: 'Descrição', principal: true,
      render: (r) => {
        const cc = centroDe.get(r.centroCustoId);
        const fixo = r.compoeCustoFixo ?? cc?.compoeCustoFixo;
        return (
          <span className="flex flex-col gap-1">
            <span className="font-medium">{r.descricao}</span>
            <span className="flex flex-wrap gap-1.5">
              {r.ativa ? <Pill tom="ok" icone={CheckCircle2}>Ativa</Pill> : <Pill icone={CircleSlash}>Inativa</Pill>}
              {fixo && <Pill tom="steel">Compõe custo fixo{cc?.categoriaCustoFixo ? ` · ${CATEGORIA[cc.categoriaCustoFixo]}` : ''}</Pill>}
            </span>
          </span>
        );
      }
    },
    { chave: 'fornecedor', titulo: 'Fornecedor', render: (r) => r.fornecedor?.nome ?? nomeForn.get(r.fornecedorId ?? '') ?? '—' },
    { chave: 'centro', titulo: 'Centro de custo', render: (r) => r.centroCusto?.nome ?? centroDe.get(r.centroCustoId)?.nome ?? '—' },
    { chave: 'dia', titulo: 'Vence', mono: true, alinhar: 'right', render: (r) => `dia ${r.diaVencimento}` },
    { chave: 'vigencia', titulo: 'Vigência', mono: true, render: (r) => `${data(r.inicio)} a ${r.fim ? data(r.fim) : 'sem fim'}` },
    { chave: 'valor', titulo: 'Valor', mono: true, alinhar: 'right', render: (r) => <strong>{brl(r.valor)}</strong> },
    { chave: 'acao', titulo: 'Editar', alinhar: 'right', render: (r) => <IconButton icone={Pencil} rotulo={`Editar ${r.descricao}`} onClick={() => setEditando(r)} className="size-9" /> }
  ];

  return (
    <>
      <HeroBand
        ilustracao="cofre"
        titulo="Recorrências"
        texto="Aluguel, sistemas, seguros: o que se repete todo mês vira título a pagar sozinho, já com centro de custo. O custo fixo do mês fica quase pronto."
        acoes={<Button variante="primario" icone={Plus} onClick={() => setEditando('nova')}>Nova recorrência</Button>}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <HeroKpi destaque rotulo={`Total de ${competenciaLonga(comp)}`} valor={brl(totalMes)} sub={plural(doMes.length, 'recorrência vigente', 'recorrências vigentes')} />
          <HeroKpi rotulo="Entra no custo fixo" valor={brl(fixoMes)} sub="conta na competência mesmo antes de pagar" />
        </div>
      </HeroBand>

      <Card className="p-5 flex flex-col gap-3" aria-labelledby="h-gerar">
        <CardHeader id="h-gerar" titulo="Gerar os títulos do mês" sub="A rotina diária já faz isso no mês corrente. Use aqui para adiantar um mês ou conferir; nada é duplicado." />
        <div className="flex flex-wrap items-center gap-2">
          <CompetenciaPicker valor={comp} onChange={setComp} />
          <Button icone={CalendarPlus} carregando={gerar.isPending} onClick={() => gerar.mutate(undefined)}>Gerar {mesNome(comp)}</Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Busca valor={busca} onChange={setBusca} placeholder="Buscar por descrição ou fornecedor" rotulo="Buscar recorrência" />
        <FiltroChips<Filtro> rotulo="Situação" valor={filtro} onChange={setFiltro} opcoes={[
          { valor: 'ativas', rotulo: 'Ativas', n: todas.filter((r) => r.ativa).length },
          { valor: 'inativas', rotulo: 'Inativas', n: todas.filter((r) => !r.ativa).length },
          { valor: 'todas', rotulo: 'Todas', n: todas.length }
        ]} />
      </div>

      <Card className="overflow-hidden" aria-label="Recorrências">
        {q.isLoading && <Carregando />}
        {q.isError && <ErroEstado erro={q.error} tentar={() => q.refetch()} />}
        {q.isSuccess && todas.length === 0 && (
          <EmptyState
            ilustracao="cofre"
            titulo="Nenhuma recorrência ainda"
            texto="Cadastre o aluguel primeiro. Todo mês ele vira um título a pagar no dia certo, sem ninguém precisar lembrar."
            acao={<Button icone={Repeat} onClick={() => setEditando('nova')}>Cadastrar a primeira</Button>}
          />
        )}
        {q.isSuccess && todas.length > 0 && visiveis.length === 0 && (
          <p className="m-0 p-6 text-center text-ink-2">Nada com esse filtro. Troque a situação ou limpe a busca.</p>
        )}
        {visiveis.length > 0 && <DataTable rotulo="Recorrências" colunas={colunas} linhas={visiveis} chave={(r) => r.id} />}
        {visiveis.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t-2 border-ink-1">
            <span className="text-ink-2">Vigentes em {mesNome(comp)}</span>
            <span className="mono text-[22px] font-bold">{brl(totalMes)}</span>
          </div>
        )}
      </Card>

      {editando && (
        <FormRecorrencia
          inicial={editando === 'nova' ? null : editando}
          fornecedores={comoLista(fq.data)}
          centros={centros.data ?? []}
          onFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}

function FormRecorrencia({ inicial, fornecedores, centros, onFechar }: { inicial: Recorrencia | null; fornecedores: Fornecedor[]; centros: CentroCusto[]; onFechar: () => void }) {
  const [f, setF] = useState({
    descricao: inicial?.descricao ?? '',
    fornecedorId: inicial?.fornecedorId ?? '',
    centroCustoId: inicial?.centroCustoId ?? '',
    valor: inicial?.valor ?? '',
    diaVencimento: inicial ? String(inicial.diaVencimento) : '10',
    inicio: inicial?.inicio?.slice(0, 10) ?? `${competenciaAtual()}-01`,
    fim: inicial?.fim?.slice(0, 10) ?? '',
    ativa: inicial?.ativa ?? true
  });
  const [tentou, setTentou] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const dia = Number(f.diaVencimento);
  const erros = {
    descricao: !f.descricao.trim() ? 'Dê um nome que todo mundo reconheça, como "Aluguel do galpão".' : null,
    centro: !f.centroCustoId ? 'Escolha o centro de custo: é ele que diz se entra no custo fixo.' : null,
    valor: !(toNum(f.valor) > 0) ? 'Informe o valor mensal.' : null,
    dia: !(Number.isInteger(dia) && dia >= 1 && dia <= 31) ? 'Um dia entre 1 e 31. Em meses curtos, vence no último dia.' : null,
    inicio: !f.inicio ? 'A partir de quando?' : null,
    fim: f.fim && f.fim < f.inicio ? 'O fim precisa vir depois do início.' : null
  };
  const valido = Object.values(erros).every((e) => !e);
  const cc = centros.find((c) => c.id === f.centroCustoId);

  const salvar = useAcao(
    () => {
      const body = {
        descricao: f.descricao.trim(), fornecedorId: f.fornecedorId || null, centroCustoId: f.centroCustoId, valor: f.valor,
        diaVencimento: dia, inicio: f.inicio, fim: f.fim || null, ativa: f.ativa
      };
      return inicial ? api(`/financeiro/recorrencias/${inicial.id}`, { method: 'PATCH', body }) : api('/financeiro/recorrencias', { method: 'POST', body });
    },
    { invalida: [['financeiro']], sucesso: inicial ? 'Recorrência atualizada. Vale a partir do próximo título gerado.' : 'Recorrência cadastrada. Ela vira título a pagar a cada mês.', onSuccess: onFechar }
  );
  const enviar = () => {
    setTentou(true);
    if (valido) salvar.mutate(undefined);
  };
  const e = (k: keyof typeof erros) => (tentou ? erros[k] : null);

  return (
    <Modal aberto onFechar={onFechar} largura={600} titulo={inicial ? 'Editar recorrência' : 'Nova recorrência'}
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" carregando={salvar.isPending} onClick={enviar}>{inicial ? 'Salvar' : 'Cadastrar'}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField className="sm:col-span-2" label="Descrição" required value={f.descricao} onChange={(v) => set('descricao', v)} placeholder="Ex.: aluguel do galpão" erro={e('descricao')} />
        <SelectField label="Fornecedor" value={f.fornecedorId} onChange={(v) => set('fornecedorId', v)} vazio="Sem fornecedor"
          opcoes={fornecedores.map((x) => ({ valor: x.id, rotulo: x.fantasia || x.nome }))} />
        <SelectField label="Centro de custo" required value={f.centroCustoId} onChange={(v) => set('centroCustoId', v)} vazio="Escolha" erro={e('centro')}
          opcoes={centros.filter((c) => c.ativo !== false || c.id === f.centroCustoId).map((c) => ({ valor: c.id, rotulo: c.nome }))}
          hint={cc?.compoeCustoFixo ? `Entra no custo fixo${cc.categoriaCustoFixo ? ` em ${CATEGORIA[cc.categoriaCustoFixo]}` : ''}.` : undefined} />
        <NumberField label="Valor mensal" required prefixo="R$" value={f.valor} onChange={(v) => set('valor', v)} erro={e('valor')} />
        <TextField label="Dia do vencimento" required mono inputMode="numeric" value={f.diaVencimento} onChange={(v) => set('diaVencimento', v.replace(/\D/g, '').slice(0, 2))} erro={e('dia')} />
        <TextField label="Início" type="date" required value={f.inicio} onChange={(v) => set('inicio', v)} erro={e('inicio')} />
        <TextField label="Fim" type="date" value={f.fim} onChange={(v) => set('fim', v)} erro={e('fim')} hint="Deixe em branco se não tem prazo." />
        <div className="sm:col-span-2">
          <Toggle label="Ativa" descricao="Desligada, para de gerar títulos. Os já gerados continuam." value={f.ativa} onChange={(v) => set('ativa', v)} />
        </div>
      </div>
    </Modal>
  );
}
