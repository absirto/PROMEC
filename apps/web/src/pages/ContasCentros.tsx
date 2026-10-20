import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, ArrowRight, Banknote, CheckCircle2, CircleSlash, Landmark, Lock, Pencil, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Categoria, Centro, CentroCusto, ComponenteDireto, ContaFin, Lista } from '../lib/types';
import { brl, data, toNum } from '../lib/format';
import { useAcao, useCentros } from '../lib/queries';
import { CATEGORIA } from '../lib/rotulos';
import { HeroBand, HeroKpi } from '../components/HeroBand';
import { Card } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { NumberField, Segmented, SelectField, TextArea, TextField, Toggle } from '../components/Field';
import { Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { Abas, useAba } from '../components/Abas';
import { useTitulo } from '../layout/titulo';

const ABAS = ['contas', 'centros'] as const;
type Aba = (typeof ABAS)[number];
const comoLista = <T,>(d: T[] | Lista<T> | null | undefined): T[] => (!d ? [] : Array.isArray(d) ? d : d.itens ?? []);
const hoje = () => new Date().toISOString().slice(0, 10);

const COMPONENTE: Record<ComponenteDireto, string> = { manutencao: 'Manutenção', insumos: 'Insumos', energia: 'Energia', outros: 'Outros' };
const CATEGORIAS = (Object.keys(CATEGORIA) as Categoria[]).map((k) => ({ valor: k, rotulo: CATEGORIA[k] }));

const useContas = () => useQuery({ queryKey: ['financeiro', 'contas'], queryFn: () => api<ContaFin[] | Lista<ContaFin>>('/financeiro/contas'), select: comoLista });
const useCentrosCusto = () => useQuery({ queryKey: ['financeiro', 'centros-custo'], queryFn: () => api<CentroCusto[] | Lista<CentroCusto>>('/financeiro/centros-custo'), select: comoLista });
const useCentrosTrabalho = () => {
  const q = useCentros();
  return comoLista<Centro>(q.data as Centro[] | Lista<Centro> | undefined);
};

export default function ContasCentros() {
  const { pode: podeFn_ } = useAuth();
  const podeGerir = podeFn_('financeiro.gerenciar');
  useTitulo('Contas e centros de custo');
  const [aba, setAba] = useAba<Aba>('contas', ABAS);
  const contas = useContas();
  const centros = useCentrosCusto();
  const [conta, setConta] = useState<ContaFin | 'nova' | null>(null);
  const [centro, setCentro] = useState<CentroCusto | 'novo' | null>(null);
  const [transferir, setTransferir] = useState(false);
  const ativas = (contas.data ?? []).filter((c) => c.ativa);
  const saldo = ativas.reduce((a, c) => a + toNum(c.saldoAtual), 0);
  const cc = centros.data ?? [];

  return (
    <>
      <HeroBand
        ilustracao="cofre"
        titulo="Contas e centros de custo"
        texto="Onde o dinheiro está e para onde ele vai. As contas guardam o saldo; os centros de custo dizem o que cada gasto representa para a oficina."
        acoes={
          aba === 'contas' ? (
            <>
              {podeGerir && <Button variante="vidro" icone={ArrowLeftRight} disabled={ativas.length < 2} onClick={() => setTransferir(true)}>Transferir</Button>}
              {podeGerir && <Button variante="primario" icone={Plus} onClick={() => setConta('nova')}>Nova conta</Button>}
            </>
          ) : (
            podeGerir && <Button variante="primario" icone={Plus} onClick={() => setCentro('novo')}>Novo centro de custo</Button>
          )
        }
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <HeroKpi destaque rotulo="Saldo em contas ativas" valor={contas.data ? brl(saldo) : '—'} sub={`${ativas.length} ${ativas.length === 1 ? 'conta' : 'contas'}`} />
          <HeroKpi rotulo="Centros que compõem o custo fixo" valor={centros.data ? cc.filter((c) => c.compoeCustoFixo).length : '—'} sub={`de ${cc.length} centros de custo`} />
        </div>
      </HeroBand>

      <Abas<Aba> rotulo="Cadastros do financeiro" valor={aba} onChange={setAba} abas={[
        { valor: 'contas', rotulo: 'Contas bancárias', n: contas.data?.length },
        { valor: 'centros', rotulo: 'Centros de custo', n: centros.data?.length }
      ]} />

      {aba === 'contas' && <Contas q={contas} saldo={saldo} onEditar={setConta} />}
      {aba === 'centros' && <Centros q={centros} onEditar={setCentro} />}

      {conta && <FormConta inicial={conta === 'nova' ? null : conta} onFechar={() => setConta(null)} />}
      {transferir && <Transferencia contas={ativas} onFechar={() => setTransferir(false)} />}
      {centro && <FormCentro inicial={centro === 'novo' ? null : centro} onFechar={() => setCentro(null)} />}
    </>
  );
}

function Contas({ q, saldo, onEditar }: { q: ReturnType<typeof useContas>; saldo: number; onEditar: (c: ContaFin | 'nova') => void }) {
  if (q.isLoading) return <Card><Carregando /></Card>;
  if (q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  const contas = q.data ?? [];
  if (!contas.length)
    return (
      <Card>
        <EmptyState ilustracao="cofre" titulo="Nenhuma conta cadastrada" texto="Cadastre o banco e o caixa da oficina com o saldo de hoje. É de lá que saem as baixas e o fluxo de caixa."
          acao={<Button icone={Plus} onClick={() => onEditar('nova')}>Cadastrar conta</Button>} />
      </Card>
    );
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
        {contas.map((c) => {
          const Icone = c.tipo === 'CAIXA' ? Banknote : Landmark;
          const dados = [c.banco, c.agencia && `ag. ${c.agencia}`, c.numero && `c/c ${c.numero}`].filter(Boolean).join(' · ');
          return (
            <Card key={c.id} as="article" className={`p-5 flex flex-col gap-3 ${c.ativa ? '' : 'opacity-70'}`} aria-label={c.nome}>
              <div className="flex items-start gap-3">
                <span className="size-10 rounded-control bg-steel-soft text-steel grid place-items-center flex-none"><Icone className="size-5" aria-hidden /></span>
                <div className="flex-1 min-w-0 flex flex-col">
                  <h2 className="m-0 font-sans text-headline truncate">{c.nome}</h2>
                  <span className="text-[13px] text-ink-3">{c.tipo === 'CAIXA' ? 'Caixa físico' : 'Conta bancária'}</span>
                </div>
                <IconButton icone={Pencil} rotulo={`Editar ${c.nome}`} onClick={() => onEditar(c)} className="size-9" />
              </div>
              <span className={`mono text-[30px] font-bold leading-none tracking-[-.02em] ${toNum(c.saldoAtual) < 0 ? 'text-bad' : ''}`}>{brl(c.saldoAtual)}</span>
              <span className="text-[13px] text-ink-2">
                {dados && <span className="mono block">{dados}</span>}
                saldo inicial <span className="mono">{brl(c.saldoInicial)}</span> em <span className="mono">{data(c.dataSaldoInicial)}</span>
              </span>
              <span>{c.ativa ? <Pill tom="ok" icone={CheckCircle2}>Ativa</Pill> : <Pill icone={CircleSlash}>Inativa</Pill>}</span>
            </Card>
          );
        })}
      </div>
      <Card className="flex items-center justify-between gap-3 px-5 py-4 border-t-2 border-ink-1">
        <span className="text-ink-2">Total nas contas ativas</span>
        <span className="mono text-[22px] font-bold">{brl(saldo)}</span>
      </Card>
    </>
  );
}

function FormConta({ inicial, onFechar }: { inicial: ContaFin | null; onFechar: () => void }) {
  const [f, setF] = useState({
    nome: inicial?.nome ?? '', tipo: inicial?.tipo ?? ('BANCO' as ContaFin['tipo']), banco: inicial?.banco ?? '', agencia: inicial?.agencia ?? '', numero: inicial?.numero ?? '',
    saldoInicial: inicial?.saldoInicial ?? '', dataSaldoInicial: inicial?.dataSaldoInicial?.slice(0, 10) ?? hoje(), ativa: inicial?.ativa ?? true
  });
  const [tentou, setTentou] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const erroNome = !f.nome.trim() ? 'Como a equipe chama essa conta? Ex.: "Banco do Brasil".' : null;
  const erroData = !f.dataSaldoInicial ? 'Em que dia o saldo era esse?' : null;
  const salvar = useAcao(
    () => {
      const banco = f.tipo === 'BANCO';
      const body = {
        nome: f.nome.trim(), tipo: f.tipo, banco: banco ? f.banco.trim() || null : null, agencia: banco ? f.agencia.trim() || null : null, numero: banco ? f.numero.trim() || null : null,
        saldoInicial: f.saldoInicial || '0', dataSaldoInicial: f.dataSaldoInicial, ativa: f.ativa
      };
      return inicial ? api(`/financeiro/contas/${inicial.id}`, { method: 'PATCH', body }) : api('/financeiro/contas', { method: 'POST', body });
    },
    { invalida: [['financeiro'], ['painel']], sucesso: inicial ? 'Conta atualizada. O saldo foi recalculado.' : 'Conta cadastrada. Já dá para baixar títulos nela.', onSuccess: onFechar }
  );
  const enviar = () => {
    setTentou(true);
    if (!erroNome && !erroData) salvar.mutate(undefined);
  };
  return (
    <Modal aberto onFechar={onFechar} largura={560} titulo={inicial ? 'Editar conta' : 'Nova conta'}
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" carregando={salvar.isPending} onClick={enviar}>{inicial ? 'Salvar' : 'Cadastrar'}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField className="sm:col-span-2" label="Nome" required value={f.nome} onChange={(v) => set('nome', v)} erro={tentou ? erroNome : null} />
        <div className="sm:col-span-2">
          <Segmented<ContaFin['tipo']> label="Tipo" value={f.tipo} onChange={(v) => set('tipo', v)} opcoes={[{ valor: 'BANCO', rotulo: 'Conta bancária' }, { valor: 'CAIXA', rotulo: 'Caixa físico' }]} />
        </div>
        {f.tipo === 'BANCO' && (
          <>
            <TextField className="sm:col-span-2" label="Banco" value={f.banco} onChange={(v) => set('banco', v)} placeholder="Ex.: Banco do Brasil" />
            <TextField label="Agência" mono value={f.agencia} onChange={(v) => set('agencia', v)} />
            <TextField label="Número da conta" mono value={f.numero} onChange={(v) => set('numero', v)} />
          </>
        )}
        <NumberField label="Saldo inicial" prefixo="R$" value={f.saldoInicial} onChange={(v) => set('saldoInicial', v)} hint="O que tinha na conta no dia ao lado." />
        <TextField label="Data do saldo" type="date" required value={f.dataSaldoInicial} onChange={(v) => set('dataSaldoInicial', v)} erro={tentou ? erroData : null} />
        <div className="sm:col-span-2">
          <Toggle label="Ativa" descricao="Inativa, some das baixas e do fluxo de caixa. O histórico continua." value={f.ativa} onChange={(v) => set('ativa', v)} />
        </div>
      </div>
    </Modal>
  );
}

function Transferencia({ contas, onFechar }: { contas: ContaFin[]; onFechar: () => void }) {
  const [f, setF] = useState({ origemId: contas[0]?.id ?? '', destinoId: contas[1]?.id ?? '', valor: '', data: hoje(), observacao: '' });
  const [tentou, setTentou] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const origem = contas.find((c) => c.id === f.origemId);
  const destino = contas.find((c) => c.id === f.destinoId);
  const valor = toNum(f.valor);
  const erros = {
    destino: !f.destinoId ? 'Para qual conta vai o dinheiro?' : f.destinoId === f.origemId ? 'Origem e destino precisam ser contas diferentes.' : null,
    valor: !(valor > 0) ? 'Informe quanto vai passar de uma conta para a outra.' : null,
    data: !f.data ? 'Em que dia foi feita?' : null
  };
  const valido = !!f.origemId && Object.values(erros).every((e) => !e);
  const acao = useAcao(
    () => api('/financeiro/transferencias', { method: 'POST', body: { origemId: f.origemId, destinoId: f.destinoId, valor: f.valor, data: f.data, observacao: f.observacao.trim() || null } }),
    { invalida: [['financeiro'], ['painel']], sucesso: `Transferência de ${brl(valor)} registrada. Os dois saldos já estão atualizados.`, onSuccess: onFechar }
  );
  const enviar = () => {
    setTentou(true);
    if (valido) acao.mutate(undefined);
  };
  const opcoes = contas.map((c) => ({ valor: c.id, rotulo: c.nome }));
  const depois = (c: ContaFin | undefined, sinal: 1 | -1) => (c ? toNum(c.saldoAtual) + sinal * valor : null);
  const saiOrigem = depois(origem, -1);

  return (
    <Modal aberto onFechar={onFechar} largura={600} titulo="Transferir entre contas"
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" icone={ArrowLeftRight} carregando={acao.isPending} onClick={enviar}>Transferir</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SelectField label="Sai de" value={f.origemId} onChange={(v) => setF({ ...f, origemId: v, destinoId: v === f.destinoId ? '' : f.destinoId })} opcoes={opcoes} />
        <SelectField label="Vai para" value={f.destinoId} onChange={(v) => set('destinoId', v)} vazio="Escolha" opcoes={opcoes.filter((o) => o.valor !== f.origemId)} erro={tentou ? erros.destino : null} />
        <NumberField label="Valor" required prefixo="R$" value={f.valor} onChange={(v) => set('valor', v)} erro={tentou ? erros.valor : null} />
        <TextField label="Data" type="date" required value={f.data} onChange={(v) => set('data', v)} erro={tentou ? erros.data : null} />
        <TextArea className="sm:col-span-2" label="Observação" rows={2} value={f.observacao} onChange={(v) => set('observacao', v)} hint="Ex.: reforço do caixa para as compras da semana." />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 p-3 rounded-field bg-surface-2 border border-border" aria-live="polite" aria-label="Saldos depois da transferência">
        {[{ c: origem, d: saiOrigem }, null, { c: destino, d: depois(destino, 1) }].map((x, i) =>
          x === null ? (
            <ArrowRight key={i} className="size-5 text-ink-3" aria-hidden />
          ) : (
            <div key={i} className="flex flex-col min-w-0">
              <span className="text-[13px] text-ink-3 truncate">{x.c?.nome ?? 'Escolha a conta'}</span>
              <span className="mono text-[13px] text-ink-3">{x.c ? `hoje ${brl(x.c.saldoAtual)}` : '—'}</span>
              <span className={`mono text-[18px] font-bold ${x.d !== null && x.d < 0 ? 'text-bad' : ''}`}>{x.d === null ? '—' : brl(x.d)}</span>
            </div>
          )
        )}
      </div>
      {saiOrigem !== null && saiOrigem < 0 && valor > 0 && (
        <p role="status" className="m-0 p-3 rounded-field bg-warn-soft text-[14px]">{origem?.nome} fica negativa depois disso. Se for o cheque especial, tudo bem; senão, confira o valor.</p>
      )}
    </Modal>
  );
}

function Centros({ q, onEditar }: { q: ReturnType<typeof useCentrosCusto>; onEditar: (c: CentroCusto | 'novo') => void }) {
  const trabalho = useCentrosTrabalho();
  const nomeCentro = new Map(trabalho.map((c) => [c.id, c.nome]));
  if (q.isLoading) return <Card><Carregando /></Card>;
  if (q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  const centros = [...(q.data ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!centros.length)
    return (
      <Card>
        <EmptyState titulo="Nenhum centro de custo" texto="Todo título a pagar precisa de um centro de custo. Comece pelos do custo fixo: aluguel, luz, contabilidade."
          acao={<Button icone={Plus} onClick={() => onEditar('novo')}>Cadastrar centro de custo</Button>} />
      </Card>
    );
  return (
    <Card className="overflow-hidden" aria-label="Centros de custo">
      <ul className="list-none m-0 p-0">
        {centros.map((c) => (
          <li key={c.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 border-t border-border first:border-0 ${c.ativo === false ? 'opacity-70' : ''}`}>
            <span className="flex-[1_1_200px] min-w-0 flex flex-col gap-1.5">
              <span className="font-medium">{c.nome}</span>
              <span className="flex flex-wrap gap-1.5">
                <Pill tom={c.tipo === 'FIXO' ? 'steel' : 'info'}>{c.tipo === 'FIXO' ? 'Fixo' : 'Variável'}</Pill>
                {c.compoeCustoFixo && <Pill tom="primary">Compõe custo fixo{c.categoriaCustoFixo ? ` · ${CATEGORIA[c.categoriaCustoFixo]}` : ''}</Pill>}
                {c.custoDiretoCentro && (
                  <Pill tom="run">Custo direto · {nomeCentro.get(c.custoDiretoCentro.centroTrabalhoId) ?? 'centro'} · {COMPONENTE[c.custoDiretoCentro.componente]}</Pill>
                )}
                {c.ativo === false && <Pill icone={CircleSlash}>Inativo</Pill>}
              </span>
            </span>
            {c.papel && !c.papel.startsWith('CF:') ? (
              <Pill tom="neutral" icone={Lock} titulo="Usado pelo próprio ProMEC (receita, comissões, compras); não dá para editar.">do sistema</Pill>
            ) : (
              <IconButton icone={Pencil} rotulo={`Editar ${c.nome}`} onClick={() => onEditar(c)} className="size-9" />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FormCentro({ inicial, onFechar }: { inicial: CentroCusto | null; onFechar: () => void }) {
  const trabalho = useCentrosTrabalho();
  const [f, setF] = useState({
    nome: inicial?.nome ?? '', tipo: inicial?.tipo ?? ('FIXO' as CentroCusto['tipo']), compoeCustoFixo: inicial?.compoeCustoFixo ?? false,
    categoriaCustoFixo: (inicial?.categoriaCustoFixo ?? '') as Categoria | '', direto: !!inicial?.custoDiretoCentro,
    centroTrabalhoId: inicial?.custoDiretoCentro?.centroTrabalhoId ?? '', componente: inicial?.custoDiretoCentro?.componente ?? ('manutencao' as ComponenteDireto),
    ativo: inicial?.ativo ?? true
  });
  const [tentou, setTentou] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const erros = {
    nome: !f.nome.trim() ? 'Dê um nome, como "Aluguel" ou "Manutenção do torno CNC".' : null,
    categoria: f.compoeCustoFixo && !f.categoriaCustoFixo ? 'Em qual linha do custo fixo esse gasto entra?' : null,
    centro: f.direto && !f.centroTrabalhoId ? 'De qual máquina é esse gasto?' : null
  };
  const valido = Object.values(erros).every((e) => !e);
  const salvar = useAcao(
    () => {
      const body = {
        nome: f.nome.trim(), tipo: f.tipo, compoeCustoFixo: f.compoeCustoFixo, categoriaCustoFixo: f.compoeCustoFixo ? f.categoriaCustoFixo : null,
        custoDiretoCentro: f.direto ? { centroTrabalhoId: f.centroTrabalhoId, componente: f.componente } : null, ativo: f.ativo
      };
      return inicial ? api(`/financeiro/centros-custo/${inicial.id}`, { method: 'PATCH', body }) : api('/financeiro/centros-custo', { method: 'POST', body });
    },
    { invalida: [['financeiro']], sucesso: inicial ? 'Centro de custo atualizado. Vale para os próximos títulos.' : 'Centro de custo cadastrado. Já aparece nos lançamentos.', onSuccess: onFechar }
  );
  const enviar = () => {
    setTentou(true);
    if (valido) salvar.mutate(undefined);
  };
  return (
    <Modal aberto onFechar={onFechar} largura={600} titulo={inicial ? 'Editar centro de custo' : 'Novo centro de custo'}
      rodape={<><Button onClick={onFechar}>Cancelar</Button><Button variante="primario" carregando={salvar.isPending} onClick={enviar}>{inicial ? 'Salvar' : 'Cadastrar'}</Button></>}>
      <TextField label="Nome" required value={f.nome} onChange={(v) => set('nome', v)} erro={tentou ? erros.nome : null} />
      <Segmented<CentroCusto['tipo']> label="Tipo" value={f.tipo} onChange={(v) => set('tipo', v)} opcoes={[{ valor: 'FIXO', rotulo: 'Fixo' }, { valor: 'VARIAVEL', rotulo: 'Variável' }]} />
      <Toggle
        label="Compõe o custo fixo"
        descricao="Os títulos deste centro entram no custo fixo realizado da competência, pagos ou não, e são comparados com o custo fixo da Tabela de Custos."
        value={f.compoeCustoFixo}
        onChange={(v) => set('compoeCustoFixo', v)}
      />
      {f.compoeCustoFixo && (
        <SelectField label="Categoria do custo fixo" value={f.categoriaCustoFixo} onChange={(v) => set('categoriaCustoFixo', v as Categoria)} vazio="Escolha" opcoes={CATEGORIAS} erro={tentou ? erros.categoria : null} />
      )}
      <Toggle
        label="Custo direto de um centro de trabalho"
        descricao="Os títulos daqui vão para o histórico de custos da máquina, que sugere os valores de manutenção, insumos e energia no cadastro do centro."
        value={f.direto}
        onChange={(v) => set('direto', v)}
      />
      {f.direto && (
        <div className="grid grid-cols-1 gap-3">
          <SelectField label="Centro de trabalho" value={f.centroTrabalhoId} onChange={(v) => set('centroTrabalhoId', v)} vazio="Escolha a máquina" erro={tentou ? erros.centro : null}
            opcoes={trabalho.map((c) => ({ valor: c.id, rotulo: `${c.codigo} · ${c.nome}` }))} />
          <Segmented<ComponenteDireto> label="Componente" value={f.componente} onChange={(v) => set('componente', v)}
            opcoes={(Object.keys(COMPONENTE) as ComponenteDireto[]).map((k) => ({ valor: k, rotulo: COMPONENTE[k] }))} />
        </div>
      )}
      <Toggle label="Ativo" descricao="Inativo, não aparece em lançamentos novos. Os títulos antigos continuam com ele." value={f.ativo} onChange={(v) => set('ativo', v)} />
    </Modal>
  );
}
