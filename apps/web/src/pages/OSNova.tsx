import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FilePlus2, Plus, Save, Trash2 } from 'lucide-react';
import { calcularCustoReal, type EntradaCustoAvulso } from '@promec/motor';
import { api, ApiError } from '../lib/api';
import type { ObjetoOS, OrdemServico, Segmento } from '../lib/types';
import { brl, pct, toNum } from '../lib/format';
import { useAcao, useClientes, useParametros, useTabelaVigente } from '../lib/queries';
import { SEGMENTO } from '../lib/rotulos';
import { FormHeader, Secao, span } from '../components/Form';
import { NumberField, Segmented, Select, SelectField, TextArea, TextField } from '../components/Field';
import { Button, IconButton } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { MarginRuler } from '../components/MarginRuler';
import { Aviso } from '../components/EmptyState';
import { useTitulo } from '../layout/titulo';

interface Op { descricao: string; centroId: string; setupOrcadoHoras: string; cicloOrcadoHorasPorPeca: string }
interface Custo { descricao: string; categoria: EntradaCustoAvulso['categoria']; orcado: string }
const CATS: { valor: Custo['categoria']; rotulo: string }[] = [
  { valor: 'material', rotulo: 'Material' },
  { valor: 'ferramental', rotulo: 'Ferramental' },
  { valor: 'terceiros', rotulo: 'Terceiros' },
  { valor: 'frete', rotulo: 'Frete' }
];
const hojeMais = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

export function CamposObjeto({ segmento, objeto, onChange }: { segmento: Segmento; objeto: ObjetoOS; onChange: (o: ObjetoOS) => void }) {
  const set = (k: keyof ObjetoOS, v: string) => onChange({ ...objeto, [k]: v });
  if (segmento === 'OFICINA')
    return (
      <>
        <TextField className={span(2)} label="Placa" mono value={String(objeto.placa ?? '')} onChange={(v) => set('placa', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))} placeholder="ABC1D23" />
        <TextField className={span(2)} label="Veículo" value={String(objeto.veiculo ?? '')} onChange={(v) => set('veiculo', v)} placeholder="Honda CG 160 2022" />
        <NumberField className={span(2)} label="Km de entrada" sufixo="km" value={objeto.kmEntrada ?? ''} onChange={(v) => set('kmEntrada', v)} />
      </>
    );
  if (segmento === 'CALDEIRARIA') return <TextField className={span(6)} label="Projeto" value={String(objeto.projeto ?? '')} onChange={(v) => set('projeto', v)} placeholder="Suporte soldado chapa 3/16 · PRJ-118" />;
  return (
    <>
      <TextField className={span(2)} label="Desenho" mono value={String(objeto.desenho ?? '')} onChange={(v) => set('desenho', v)} placeholder="BUC-H7-020" />
      <TextField className={span(2)} label="Revisão" mono value={String(objeto.revisao ?? '')} onChange={(v) => set('revisao', v.toUpperCase())} placeholder="C" />
      <TextField className={span(2)} label="Material" value={String(objeto.material ?? '')} onChange={(v) => set('material', v)} placeholder="Latão C360 Ø25" />
    </>
  );
}

export default function OSNova() {
  useTitulo('Serviço rápido');
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const clientes = useClientes('');
  const params = useParametros();
  const vigente = useTabelaVigente();
  const [f, setF] = useState({ clienteId: sp.get('cliente') ?? '', titulo: '', segmento: 'OFICINA' as Segmento, lote: '1', prazo: hojeMais(2), precoFinalLote: '', observacoes: '' });
  const [objeto, setObjeto] = useState<ObjetoOS>({});
  const [ops, setOps] = useState<Op[]>([{ descricao: '', centroId: '', setupOrcadoHoras: '', cicloOrcadoHorasPorPeca: '' }]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [tentou, setTentou] = useState(false);
  const [exige, setExige] = useState<string | null>(null);

  const centros = vigente.data?.resultado.centros ?? [];
  const p = params.data as (typeof params.data & { limiteServicoRapido?: string }) | undefined;
  const limite = toNum(p?.limiteServicoRapido ?? 1500);
  const lote = Math.max(1, Math.floor(toNum(f.lote)) || 1);

  const previa = useMemo(() => {
    try {
      return calcularCustoReal({
        lote,
        precoFinalLote: f.precoFinalLote || '0',
        impostos: p?.impostosPadrao ?? '0',
        comissao: p?.comissaoPadrao ?? '0',
        operacoes: ops.map((o, i) => ({
          id: String(i), descricao: o.descricao || `Operação ${(i + 1) * 10}`, custoHora: centros.find((c) => c.id === o.centroId)?.cheioHora ?? '0',
          setupOrcadoHoras: o.setupOrcadoHoras || '0', cicloOrcadoHorasPorPeca: o.cicloOrcadoHorasPorPeca || '0', setupRealHoras: '0', producaoRealHoras: '0', quantidadeBoa: 0
        })),
        custos: custos.map((c, i) => ({ id: `c${i}`, descricao: c.descricao || 'Custo', categoria: c.categoria, orcado: c.orcado || '0', real: null }))
      });
    } catch {
      return null;
    }
  }, [lote, f.precoFinalLote, p, ops, custos, centros]);

  const criar = useAcao(
    () =>
      api<OrdemServico>('/ordens-servico', {
        method: 'POST',
        body: {
          ...f, lote, objeto,
          operacoes: ops.filter((o) => o.centroId).map((o, i) => ({ ...o, sequencia: (i + 1) * 10, setupOrcadoHoras: o.setupOrcadoHoras || '0', cicloOrcadoHorasPorPeca: o.cicloOrcadoHorasPorPeca || '0' })),
          custos: custos.map((c) => ({ ...c, orcado: c.orcado || '0' }))
        }
      }),
    { invalida: [['ordens-servico'], ['painel']], sucesso: (r) => `${r?.numero ?? 'OS'} aberta. Libere para a fila quando o material estiver separado.`, onSuccess: (r) => r?.id && navigate(`/ordens-servico/${r.id}`, { replace: true }) }
  );

  const erroCliente = tentou && !f.clienteId ? 'Para quem é o serviço? Escolha o cliente.' : null;
  const erroTitulo = tentou && !f.titulo.trim() ? 'Diga em poucas palavras o que vai ser feito.' : null;
  const erroPreco = tentou && !(toNum(f.precoFinalLote) > 0) ? 'Informe o preço combinado com o cliente.' : null;
  const enviar = () => {
    setTentou(true);
    setExige(null);
    if (!f.clienteId || !f.titulo.trim() || !(toNum(f.precoFinalLote) > 0)) return;
    criar.mutate(undefined, { onError: (e) => e instanceof ApiError && e.codigo === 'EXIGE_ORCAMENTO' && setExige(e.message) });
  };
  const acima = toNum(f.precoFinalLote) > limite;

  return (
    <>
      <FormHeader
        voltar={{ to: '/ordens-servico', rotulo: 'Ordens de Serviço' }}
        iniciais="OS"
        cor="linear-gradient(135deg, #5B6B7F, #15395A)"
        titulo="Serviço rápido"
        lead={`Para o serviço pequeno, que se resolve no balcão. Até ${brl(limite)} dá para abrir a OS direto; acima disso, o caminho é um orçamento.`}
        acoes={<Button variante="primario" icone={Save} carregando={criar.isPending} onClick={enviar}>Abrir OS</Button>}
      />
      {exige && (
        <Aviso tom="bad" faixa titulo="Esse serviço pede um orçamento" acao={<Button icone={FilePlus2} to={`/orcamentos/novo${f.clienteId ? `?cliente=${f.clienteId}` : ''}`}>Montar um orçamento</Button>}>
          {exige}
        </Aviso>
      )}
      <div className="flex flex-wrap gap-5 items-start">
        <form className="flex-[999_1_480px] min-w-0 flex flex-col gap-[18px]" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate>
          <Secao id="o-que" titulo="O que vai ser feito">
            <SelectField className={span(3)} label="Cliente" required value={f.clienteId} onChange={(v) => setF({ ...f, clienteId: v })} vazio="Escolha o cliente" erro={erroCliente}
              opcoes={(clientes.data?.itens ?? []).filter((c) => c.status === 'ATIVO').map((c) => ({ valor: c.id, rotulo: c.fantasia || c.nome }))} />
            <TextField className={span(3)} label="Serviço" required value={f.titulo} onChange={(v) => setF({ ...f, titulo: v })} erro={erroTitulo} placeholder="Troca de pastilhas e regulagem do freio" />
            <div className={span(6)}>
              <Segmented<Segmento> label="Segmento" value={f.segmento} onChange={(v) => { setF({ ...f, segmento: v }); setObjeto({}); }} opcoes={(Object.keys(SEGMENTO) as Segmento[]).map((k) => ({ valor: k, rotulo: SEGMENTO[k] }))} />
            </div>
            <CamposObjeto segmento={f.segmento} objeto={objeto} onChange={setObjeto} />
            <NumberField className={span(2)} label="Quantidade" sufixo="pç" value={f.lote} onChange={(v) => setF({ ...f, lote: v })} />
            <TextField className={span(2)} label="Prazo" type="date" mono value={f.prazo} onChange={(v) => setF({ ...f, prazo: v })} />
            <NumberField className={span(2)} label="Preço combinado" prefixo="R$" value={f.precoFinalLote} onChange={(v) => setF({ ...f, precoFinalLote: v })} erro={erroPreco}
              hint={acima ? `Passa do limite de ${brl(limite)}: o ProMEC vai pedir um orçamento.` : undefined} />
          </Secao>
          <Secao id="ops" titulo="Onde e quanto tempo" descricao="O custo-hora vem da Tabela de Custos vigente.">
            <div className={`${span(6)} flex flex-col gap-3`}>
              {ops.map((o, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3 p-3 rounded-field bg-surface-2 border border-border">
                  <TextField className="flex-[2_1_200px]" label="Operação" value={o.descricao} onChange={(v) => setOps(ops.map((x, j) => (j === i ? { ...x, descricao: v } : x)))} />
                  <label className="flex flex-col gap-1.5 flex-[2_1_200px] min-w-0">
                    <span className="text-[13.5px] font-medium text-ink-2">Centro</span>
                    <Select value={o.centroId} vazio="Escolha o centro" onChange={(v) => setOps(ops.map((x, j) => (j === i ? { ...x, centroId: v } : x)))} opcoes={centros.map((c) => ({ valor: c.id, rotulo: `${c.nome} · ${brl(c.cheioHora)}/h` }))} />
                  </label>
                  <NumberField className="flex-[1_1_110px]" label="Setup" sufixo="h" value={o.setupOrcadoHoras} onChange={(v) => setOps(ops.map((x, j) => (j === i ? { ...x, setupOrcadoHoras: v } : x)))} />
                  <NumberField className="flex-[1_1_110px]" label="Por peça" sufixo="h" value={o.cicloOrcadoHorasPorPeca} onChange={(v) => setOps(ops.map((x, j) => (j === i ? { ...x, cicloOrcadoHorasPorPeca: v } : x)))} />
                  <IconButton icone={Trash2} rotulo="Remover operação" onClick={() => setOps(ops.filter((_, j) => j !== i))} />
                </div>
              ))}
              <Button icone={Plus} className="self-start" onClick={() => setOps([...ops, { descricao: '', centroId: '', setupOrcadoHoras: '', cicloOrcadoHorasPorPeca: '' }])}>Adicionar operação</Button>
            </div>
          </Secao>
          <Secao id="custos" titulo="Peças e terceiros" descricao="O que vai ser comprado ou usado, pelo valor previsto.">
            <div className={`${span(6)} flex flex-col gap-3`}>
              {custos.length === 0 && <p className="m-0 text-[14px] text-ink-2">Nenhuma peça ainda. Pastilha, rolamento, retífica de fora: tudo entra aqui.</p>}
              {custos.map((c, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3 p-3 rounded-field bg-surface-2 border border-border">
                  <TextField className="flex-[3_1_200px]" label="Descrição" value={c.descricao} onChange={(v) => setCustos(custos.map((x, j) => (j === i ? { ...x, descricao: v } : x)))} />
                  <SelectField className="flex-[1_1_140px]" label="Tipo" value={c.categoria} onChange={(v) => setCustos(custos.map((x, j) => (j === i ? { ...x, categoria: v as Custo['categoria'] } : x)))} opcoes={CATS} />
                  <NumberField className="flex-[1_1_130px]" label="Valor previsto" prefixo="R$" value={c.orcado} onChange={(v) => setCustos(custos.map((x, j) => (j === i ? { ...x, orcado: v } : x)))} />
                  <IconButton icone={Trash2} rotulo="Remover custo" onClick={() => setCustos(custos.filter((_, j) => j !== i))} />
                </div>
              ))}
              <Button icone={Plus} className="self-start" onClick={() => setCustos([...custos, { descricao: '', categoria: 'material', orcado: '' }])}>Adicionar peça ou terceiro</Button>
            </div>
            <TextArea className={span(6)} label="Observações" value={f.observacoes} onChange={(v) => setF({ ...f, observacoes: v })} />
          </Secao>
        </form>
        <GlassPanel placa="aco" className="flex-[1_1_300px] max-w-full lg:max-w-[360px] lg:sticky lg:top-24" aria-label="Conta do serviço">
          <h2 className="m-0 text-[24px] font-bold">A conta fecha?</h2>
          {previa ? (
            <>
              <div className="grid grid-cols-2 gap-2" aria-live="polite">
                <div className="p-3 rounded-[16px] bg-surface-1"><span className="block text-caption text-ink-3">Custo previsto</span><span className="mono text-[20px] font-bold">{brl(previa.custoOrcado)}</span></div>
                <div className="p-3 rounded-[16px] bg-surface-1"><span className="block text-caption text-ink-3">Horas</span><span className="mono text-[20px] font-bold">{toNum(previa.horasOrcadas).toFixed(2).replace('.', ',')} h</span></div>
              </div>
              {toNum(f.precoFinalLote) > 0 && (
                <div className="p-3.5 rounded-[18px] bg-surface-1 flex flex-col gap-2">
                  <div className="flex justify-between items-baseline"><span className="text-[14px] font-medium">Margem que sobra</span><span className="mono text-[24px] font-bold">{pct(previa.margemOrcada)}</span></div>
                  <MarginRuler efetiva={previa.margemOrcada} minima={p?.margemMinima ?? '0.15'} alvo={p?.margemAlvo ?? '0.2'} />
                </div>
              )}
            </>
          ) : (
            <p className="m-0 text-[14px] text-ink-2">Preencha o tempo e o preço para ver a margem.</p>
          )}
          {vigente.isError && <p className="m-0 text-caption text-ink-2">Sem Tabela de Custos vigente, as horas entram sem custo.</p>}
        </GlassPanel>
      </div>
    </>
  );
}
