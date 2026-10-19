import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, ChevronDown, Plus, Save, Trash2, TriangleAlert } from 'lucide-react';
import { precoDaHora, type ResultadoTabela, type StatusCentro, type TipoCentro } from '@promec/motor';
import { api } from '../lib/api';
import type { Centro } from '../lib/types';
import { brl, competenciaAtual, horas, num, pct, toNum } from '../lib/format';
import { useAcao, useColaboradores, useParametros } from '../lib/queries';
import { CRITERIO, TIPO_CENTRO, corTipoCentro } from '../lib/rotulos';
import { previaCentro, type CentroForm as Form } from '../features/centro/previa';
import { FormHeader, NavSecoes, Secao, span } from '../components/Form';
import { NumberField, Segmented, Select, TextField } from '../components/Field';
import { Button, IconButton } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { CompositionBar, COR_CENTRO, fatias } from '../components/CompositionBar';
import { ExplainTree } from '../components/ExplainTree';
import { Card } from '../components/Card';
import { Carregando, ErroEstado } from '../components/EmptyState';
import { StatusCentroPill, Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { useTitulo } from '../layout/titulo';

const VAZIO: Form = {
  codigo: '', nome: '', tipo: 'maquina', status: 'ativo', horasExpediente: '220', eficiencia: '0.75', manutencao: '', insumos: '', outros: '',
  valorAquisicao: '', valorResidual: '', vidaUtilMeses: '60', potenciaKw: '', fatorCarga: '0.6', tarifaKwh: '', pesoManual: '', areaM2: '', operadores: []
};

const doCentro = (c: Centro): Form => ({
  codigo: c.codigo ?? '', nome: c.nome, tipo: c.tipo, status: c.status, horasExpediente: c.horasExpediente, eficiencia: c.eficiencia,
  manutencao: c.manutencao, insumos: c.insumos, outros: c.outros ?? '', valorAquisicao: c.valorAquisicao ?? '', valorResidual: c.valorResidual ?? '',
  vidaUtilMeses: String(c.vidaUtilMeses ?? ''), potenciaKw: c.potenciaKw ?? '', fatorCarga: c.fatorCarga ?? '', tarifaKwh: c.tarifaKwh ?? '',
  pesoManual: c.pesoManual ?? '', areaM2: c.areaM2 ?? '', operadores: c.operadores.map((o) => ({ ...o }))
});

const z = (v: string) => (v === '' ? '0' : v);

export default function CentroForm() {
  const { id = 'novo' } = useParams();
  const novo = id === 'novo';
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['centros-trabalho', id], queryFn: () => api<Centro>(`/centros-trabalho/${id}`), enabled: !novo });
  const colabs = useColaboradores();
  const params = useParametros();
  const competencia = competenciaAtual();
  const previa = useQuery({ queryKey: ['centros-trabalho', 'previa', competencia], queryFn: () => api<ResultadoTabela>('/centros-trabalho/previa', { query: { competencia } }), retry: false });

  const [f, setF] = useState<Form | null>(novo ? VAZIO : null);
  const [tentou, setTentou] = useState(false);
  const [desativar, setDesativar] = useState(false);
  const [arvore, setArvore] = useState(false);
  useEffect(() => { if (q.data) setF(doCentro(q.data)); }, [q.data]);
  useTitulo(novo ? 'Novo centro de trabalho' : q.data?.nome ?? 'Centro de trabalho');

  const mapaColabs = useMemo(() => new Map((colabs.data?.itens ?? []).map((c) => [c.id, c])), [colabs.data]);
  const calc = useMemo(() => (f ? previaCentro(f, novo ? 'novo' : id, mapaColabs, previa.data) : null), [f, id, novo, mapaColabs, previa.data]);

  const corpo = (x: Form) => ({
    codigo: x.codigo.trim(), nome: x.nome.trim(), tipo: x.tipo, status: x.status,
    horasExpediente: z(x.horasExpediente), eficiencia: z(x.eficiencia), manutencao: z(x.manutencao), insumos: z(x.insumos), outros: z(x.outros),
    valorAquisicao: z(x.valorAquisicao), valorResidual: z(x.valorResidual), vidaUtilMeses: Math.round(toNum(x.vidaUtilMeses)),
    potenciaKw: z(x.potenciaKw), fatorCarga: z(x.fatorCarga), tarifaKwh: z(x.tarifaKwh),
    pesoManual: x.pesoManual === '' ? null : x.pesoManual, areaM2: x.areaM2 === '' ? null : x.areaM2,
    operadores: x.operadores.filter((o) => o.colaboradorId).map((o) => ({ colaboradorId: o.colaboradorId, alocacao: z(o.alocacao) }))
  });
  const inval = [['centros-trabalho'], ['tabelas-custos'], ['colaboradores'], ['painel']];
  const salvar = useAcao((x: Form) => api<Centro>(novo ? '/centros-trabalho' : `/centros-trabalho/${id}`, { method: novo ? 'POST' : 'PATCH', body: corpo(x) }), {
    invalida: inval,
    sucesso: (_r, x) => `${x.nome} salvo. O custo-hora entra no próximo rascunho da Tabela de Custos.`,
    onSuccess: (r) => novo && r?.id && navigate(`/centros-trabalho/${r.id}`, { replace: true })
  });
  const del = useAcao(() => api(`/centros-trabalho/${id}`, { method: 'DELETE' }), {
    invalida: inval,
    sucesso: 'Centro desativado. Ele sai do próximo rascunho da Tabela de Custos.',
    onSuccess: () => navigate('/centros-trabalho')
  });

  if (!novo && q.isLoading) return <Card><Carregando /></Card>;
  if (!novo && q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  if (!f) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const erroNome = tentou && !f.nome.trim() ? 'Dê um nome que a equipe reconheça, como “Torno CNC de entrada”.' : null;
  const erroEf = toNum(f.eficiencia) >= 1 ? 'Nenhuma máquina roda 100% do tempo. Que tal 75,0%, a média do seu apontamento?' : toNum(f.eficiencia) <= 0 ? 'Informe a eficiência: sem ela não há horas reais.' : null;
  const alocErro = (o: Form['operadores'][number]) => {
    const c = mapaColabs.get(o.colaboradorId);
    if (!c) return null;
    const outros = c.alocacoes.filter((a) => a.centroId !== id).reduce((a, x) => a + toNum(x.alocacao), 0);
    return outros + toNum(o.alocacao) > 1.0001 ? `${c.nome.split(' ')[0]} já está ${pct(outros, 0)} em outros centros. Somando, passa de 100%.` : null;
  };
  const enviar = () => {
    setTentou(true);
    if (!f.nome.trim() || erroEf || f.operadores.some(alocErro)) return;
    salvar.mutate(f);
  };

  const c = calc?.centro;
  const criterio = previa.data?.criterioRateio ?? params.data?.criterioRateio ?? 'horas';
  const preco = c && params.data ? (() => { try { return precoDaHora(c.cheioHora, { impostos: params.data.impostosPadrao, comissao: params.data.comissaoPadrao, margem: params.data.margemAlvo }); } catch { return null; } })() : null;
  const usados = new Set(f.operadores.map((o) => o.colaboradorId));
  const secoes = [
    { id: 'o-que-e', titulo: 'O que é', completa: !!f.nome.trim() },
    { id: 'custos', titulo: 'Quanto custa por mês', completa: toNum(f.manutencao) + toNum(f.insumos) + toNum(f.valorAquisicao) > 0 },
    { id: 'operadores', titulo: 'Quem opera', completa: f.operadores.length > 0 },
    { id: 'capacidade', titulo: 'Capacidade e rateio', completa: toNum(f.horasExpediente) > 0 && !erroEf }
  ];

  return (
    <>
      <FormHeader
        voltar={{ to: '/centros-trabalho', rotulo: 'Centros de trabalho' }}
        iniciais={(f.nome || 'CT').split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'CT'}
        cor={`linear-gradient(135deg, ${corTipoCentro[f.tipo]}, #15395A)`}
        titulo={novo ? 'Novo centro de trabalho' : f.nome || 'Centro de trabalho'}
        lead="Mude qualquer número abaixo e o custo-hora ao lado recalcula na hora. Nada muda nos orçamentos até a tabela do mês ser publicada."
        pills={!novo && <><StatusCentroPill status={f.status} /><Pill tom="neutral">{TIPO_CENTRO[f.tipo]}</Pill>{f.codigo && <Pill tom="steel"><span className="mono">{f.codigo}</span></Pill>}</>}
        acoes={
          <>
            {!novo && f.status !== 'desativado' && <Button variante="perigo" icone={Ban} onClick={() => setDesativar(true)}>Desativar</Button>}
            <Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={enviar}>Salvar</Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-5 items-start">
        <NavSecoes secoes={secoes} />
        <form className="flex-[999_1_480px] min-w-0 flex flex-col gap-[18px]" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate>
          <Secao id="o-que-e" titulo="O que é" descricao="Máquina, box, bancada, célula de solda ou mão de obra pura: todos são centros de trabalho.">
            <TextField className={span(4)} label="Nome" required value={f.nome} onChange={(v) => set('nome', v)} erro={erroNome} placeholder="Torno CNC de entrada" />
            <TextField className={span(2)} label="Código" mono value={f.codigo} onChange={(v) => set('codigo', v.toUpperCase())} placeholder="TCNC-01" />
            <div className={span(6)}>
              <Segmented<TipoCentro> label="Tipo" value={f.tipo} onChange={(v) => set('tipo', v)} opcoes={(Object.keys(TIPO_CENTRO) as TipoCentro[]).map((k) => ({ valor: k, rotulo: TIPO_CENTRO[k] }))} />
            </div>
            <div className={span(6)}>
              <Segmented<StatusCentro> label="Situação" value={f.status} onChange={(v) => set('status', v)} opcoes={[{ valor: 'ativo', rotulo: 'Ativo' }, { valor: 'manutencao', rotulo: 'Em manutenção' }, { valor: 'desativado', rotulo: 'Desativado' }]} />
            </div>
          </Secao>

          <Secao id="custos" titulo="Quanto custa por mês" descricao="Gastos que existem só por causa deste centro.">
            <NumberField className={span(2)} label="Valor de aquisição" prefixo="R$" value={f.valorAquisicao} onChange={(v) => set('valorAquisicao', v)} />
            <NumberField className={span(2)} label="Vida útil" sufixo="meses" value={f.vidaUtilMeses} onChange={(v) => set('vidaUtilMeses', v)} erro={toNum(f.valorAquisicao) > 0 && toNum(f.vidaUtilMeses) <= 0 ? 'Sem a vida útil não dá para calcular a depreciação.' : null} />
            <NumberField className={span(2)} label="Valor residual" prefixo="R$" value={f.valorResidual} onChange={(v) => set('valorResidual', v)} />
            <NumberField className={span(2)} label="Manutenção média" prefixo="R$" value={f.manutencao} onChange={(v) => set('manutencao', v)} />
            <NumberField className={span(2)} label="Insumos e ferramentas gerais" prefixo="R$" value={f.insumos} onChange={(v) => set('insumos', v)} />
            <NumberField className={span(2)} label="Outros" prefixo="R$" value={f.outros} onChange={(v) => set('outros', v)} />
            <NumberField className={span(2)} label="Potência do motor" sufixo="kW" value={f.potenciaKw} onChange={(v) => set('potenciaKw', v)} hint="Deixe 0 se não souber. A energia fica de fora." />
            <NumberField className={span(2)} label="Fator de carga" percentual value={f.fatorCarga} onChange={(v) => set('fatorCarga', v)} />
            <NumberField className={span(2)} label="Tarifa de energia" prefixo="R$" sufixo="/kWh" value={f.tarifaKwh} onChange={(v) => set('tarifaKwh', v)} />
          </Secao>

          <Secao id="operadores" titulo="Quem opera" descricao="O custo de cada pessoa entra pela parte do tempo que ela passa aqui.">
            <div className={`${span(6)} flex flex-col gap-3`}>
              {f.operadores.length === 0 && (
                <p className="m-0 text-ink-2 text-[14px]">
                  {f.tipo === 'automatica' || f.tipo === 'externa' ? 'Este tipo pode rodar sem operador.' : 'Ninguém alocado ainda. Se alguém opera este centro, inclua para o custo-hora não sair baixo.'}
                </p>
              )}
              {f.operadores.map((o, i) => {
                const col = mapaColabs.get(o.colaboradorId);
                const erro = alocErro(o);
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-end gap-3 p-3 rounded-field bg-surface-2 border border-border">
                      <label className="flex flex-col gap-1.5 flex-[2_1_220px] min-w-0">
                        <span className="text-[13.5px] font-medium text-ink-2">Pessoa</span>
                        <Select
                          value={o.colaboradorId}
                          vazio="Escolha quem opera"
                          onChange={(v) => set('operadores', f.operadores.map((x, j) => (j === i ? { ...x, colaboradorId: v, nome: mapaColabs.get(v)?.nome ?? '' } : x)))}
                          opcoes={(colabs.data?.itens ?? []).filter((c) => (c.ativo && !usados.has(c.id)) || c.id === o.colaboradorId).map((c) => ({ valor: c.id, rotulo: `${c.nome} · ${c.funcao}` }))}
                        />
                      </label>
                      <NumberField className="flex-[1_1_120px]" label="Tempo aqui" percentual value={o.alocacao} onChange={(v) => set('operadores', f.operadores.map((x, j) => (j === i ? { ...x, alocacao: v } : x)))} />
                      <span className="flex flex-col flex-[1_1_120px] text-right pb-2">
                        <span className="text-caption text-ink-3">custo no centro</span>
                        <span className="mono font-semibold">{col ? brl(toNum(col.custoMensal) * toNum(o.alocacao)) : '—'}</span>
                      </span>
                      <IconButton icone={Trash2} rotulo={`Tirar ${col?.nome ?? 'pessoa'} deste centro`} onClick={() => set('operadores', f.operadores.filter((_, j) => j !== i))} />
                    </div>
                    {erro && <span role="alert" className="text-caption text-bad font-medium">{erro}</span>}
                  </div>
                );
              })}
              <Button icone={Plus} className="self-start" onClick={() => set('operadores', [...f.operadores, { colaboradorId: '', nome: '', alocacao: '1' }])}>Alocar pessoa</Button>
            </div>
          </Secao>

          <Secao id="capacidade" titulo="Capacidade e rateio" descricao="Quantas horas ele produz de verdade e quanto carrega do custo fixo.">
            <NumberField className={span(2)} label="Horas de expediente" sufixo="h/mês" value={f.horasExpediente} onChange={(v) => set('horasExpediente', v)} hint="Dias úteis × turnos × horas, já sem as paradas programadas." />
            <NumberField className={span(2)} label="Eficiência" percentual value={f.eficiencia} onChange={(v) => set('eficiencia', v)} erro={erroEf} />
            <div className={`${span(2)} flex flex-col justify-center p-3 rounded-field bg-surface-2`}>
              <span className="text-caption text-ink-3">Horas reais</span>
              <span className="mono text-[20px] font-bold">{horas(toNum(f.horasExpediente) * Math.min(toNum(f.eficiencia), 1), 1)}</span>
            </div>
            {criterio === 'manual' && <NumberField className={span(3)} label="Peso no rateio" percentual value={f.pesoManual} onChange={(v) => set('pesoManual', v)} hint="Os pesos de todos os centros precisam fechar 100%." />}
            {criterio === 'area' && <NumberField className={span(3)} label="Área ocupada" sufixo="m²" value={f.areaM2} onChange={(v) => set('areaM2', v)} />}
            <p className={`${span(6)} m-0 text-caption text-ink-3`}>Rateio do custo fixo {CRITERIO[criterio]}.</p>
          </Secao>
        </form>

        <GlassPanel placa="aco" className="flex-[1_1_320px] max-w-full lg:max-w-[380px] lg:sticky lg:top-24" aria-label="Custo-hora ao vivo">
          <h2 className="m-0 text-[24px] font-bold">Custo-hora ao vivo</h2>
          {previa.isError && <p className="m-0 text-caption text-ink-2">Sem a prévia da tabela agora; o rateio aparece zerado até ela voltar.</p>}
          {calc?.erro ? (
            <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{calc.erro}</p>
          ) : f.status === 'desativado' ? (
            <p className="m-0 p-3 rounded-field bg-surface-1 text-[14px]">Centro desativado não entra no custo-hora nem no rateio.</p>
          ) : c ? (
            <>
              <div className="grid grid-cols-2 gap-2" aria-live="polite">
                {[
                  ['Custo específico', brl(c.especificoHora), `${brl(c.custoDiretoMensal)} ÷ ${num(c.horasReais, 0)} h`, ''],
                  ['Rateio do custo fixo', brl(c.rateioHora), `peso ${pct(c.pesoRateio)}`, ''],
                  ['Custo-hora cheio', brl(c.cheioHora), 'base do preço', 'text-primary-text'],
                  ['Marginal', brl(c.marginalHora), 'piso para hora parada', 'text-ok']
                ].map(([l, v, s, cor]) => (
                  <div key={l} className="p-3 rounded-[16px] bg-surface-1">
                    <span className="block text-caption text-ink-3">{l}</span>
                    <span className={`mono text-[20px] font-bold ${cor}`}>{v}</span>
                    <span className="block text-[12px] text-ink-2">{s}</span>
                  </div>
                ))}
              </div>
              {q.data?.custoHoraVigente && (
                <span className="text-[13px] text-ink-2">
                  Na tabela vigente: <strong className="mono">{brl(q.data.custoHoraVigente)}/h</strong>
                  {Math.abs(toNum(c.cheioHora) / toNum(q.data.custoHoraVigente) - 1) > 0.0005 && (
                    <span className="mono"> ({toNum(c.cheioHora) > toNum(q.data.custoHoraVigente) ? '+' : ''}{pct(toNum(c.cheioHora) / toNum(q.data.custoHoraVigente) - 1)})</span>
                  )}
                </span>
              )}
              {preco && (
                <div className="p-3 rounded-[16px] bg-surface-1 flex justify-between items-baseline gap-2">
                  <span className="text-[13px] text-ink-2">Preço de venda da hora</span>
                  <span className="mono text-[20px] font-bold">{brl(preco)}</span>
                </div>
              )}
              <CompositionBar itens={fatias(c.composicaoHora as unknown as Record<string, string>, COR_CENTRO)} unidade="R$/h" rotulo="Composição do custo-hora" />
              <button type="button" onClick={() => setArvore(!arvore)} aria-expanded={arvore} className="self-start inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primary-text">
                <ChevronDown className={`size-4 transition-transform ${arvore ? 'rotate-180' : ''}`} aria-hidden /> Como chegamos nesse valor
              </button>
              {arvore && <div className="rounded-field bg-surface-1 p-2"><ExplainTree raiz={c.explicacao} /></div>}
            </>
          ) : (
            <Carregando linhas={3} />
          )}
          {calc?.ocorrencias.map((o, i) => (
            <p key={i} className="m-0 flex gap-2 p-3 rounded-field bg-warn-soft text-[13.5px]">
              <TriangleAlert className="size-4 text-warn flex-none mt-0.5" aria-hidden /> {o.mensagem}
            </p>
          ))}
        </GlassPanel>
      </div>

      <Modal
        aberto={desativar}
        onFechar={() => setDesativar(false)}
        titulo={`Desativar ${f.nome}?`}
        rodape={<><Button onClick={() => setDesativar(false)}>Manter ativo</Button><Button variante="perigo" icone={Ban} carregando={del.isPending} onClick={() => del.mutate(undefined)}>Desativar</Button></>}
      >
        <p className="m-0 text-ink-2">O centro sai do próximo rascunho da Tabela de Custos. Orçamentos e tabelas antigas continuam mostrando o que usaram.</p>
      </Modal>
    </>
  );
}
