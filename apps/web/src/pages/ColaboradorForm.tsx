import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, RefreshCw, Save, ShieldPlus, UserX } from 'lucide-react';
import { dec } from '@promec/motor';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Vinculo } from '../lib/types';
import { brl, competenciaAtual, competenciaLonga, data, iniciais, mesNome, pct, toNum } from '../lib/format';
import { useAcao, useCentros, useParametros } from '../lib/queries';
import { VINCULO } from '../lib/rotulos';
import { FormHeader, NavSecoes, Secao, span } from '../components/Form';
import { NumberField, Segmented, TextField, Toggle } from '../components/Field';
import { Button } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { CompositionBar } from '../components/CompositionBar';
import { Card } from '../components/Card';
import { Carregando, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { useTitulo } from '../layout/titulo';
import { Mascara } from '../components/Mascara';
import {
  DIAS_SEMANA, TIPO_AUSENCIA, custoAoVivo, encargosDoVinculo, h, hojeISO, horasNoMes, periodo, previaEncargos, somarDias,
  type Ausencia, type ColaboradorRH, type Habilitacao, type ParametrosRH
} from '../features/rh/rh';
import { useAusencias, useHabilitacoes } from '../features/rh/queries';
import { AusenciaModal, HabilitacaoModal, SituacaoHabPill, TipoAusenciaPill } from '../features/rh/componentes';

type ModoEncargos = 'percentual' | 'valor';
interface Form {
  nome: string; funcao: string; vinculo: Vinculo; salario: string;
  modoEncargos: ModoEncargos; encargos: string; encargosPercentual: string;
  beneficios: string; jornadaHoras: string; turno: string; diasSemana: number[]; ativo: boolean;
}
const UTEIS = [1, 2, 3, 4, 5];
const VAZIO: Form = { nome: '', funcao: '', vinculo: 'CLT', salario: '', modoEncargos: 'percentual', encargos: '', encargosPercentual: '', beneficios: '', jornadaHoras: '220', turno: '', diasSemana: UTEIS, ativo: true };
const z = (v: string) => (v === '' || !Number.isFinite(Number(v)) ? '0' : v);
const DICA_SALARIO = 'Você não tem permissão para ver salários';
const mesmosDias = (a: number[], b?: number[]) => [...a].sort().join() === [...(b?.length ? b : UTEIS)].sort().join();

export default function ColaboradorForm() {
  const { pode } = useAuth();
  const podeGerir = pode('cadastros.gerenciar') || pode('rh.gerenciar');
  const podeRh = pode('rh.gerenciar');
  const verSalario = pode('rh.ver_salario');
  const verRh = pode('rh.visualizar');
  const { id = 'novo' } = useParams();
  const novo = id === 'novo';
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['colaboradores', id], queryFn: () => api<ColaboradorRH>(`/colaboradores/${id}`), enabled: !novo });
  const params = useParametros();
  const porVinculo = (params.data as ParametrosRH | undefined)?.encargosPorVinculo;
  const [f, setF] = useState<Form | null>(novo ? VAZIO : null);
  const [tentou, setTentou] = useState(false);
  const [inativar, setInativar] = useState(false);
  useEffect(() => {
    if (q.data) {
      const c = q.data;
      setF({
        nome: c.nome, funcao: c.funcao ?? '', vinculo: c.vinculo, salario: c.salario ?? '',
        modoEncargos: c.encargosPercentual != null ? 'percentual' : 'valor', encargos: c.encargos ?? '', encargosPercentual: c.encargosPercentual ?? '',
        beneficios: c.beneficios ?? '', jornadaHoras: c.jornadaHoras, turno: c.turno ?? '', diasSemana: c.diasSemana?.length ? c.diasSemana : UTEIS, ativo: c.ativo
      });
    }
  }, [q.data]);
  useTitulo(novo ? 'Novo funcionário' : q.data?.nome ?? 'Funcionário');
  // Sem rh.ver_salario a API devolve os valores nulos (mascarado) e recusa gravá-los: não mostra nem envia.
  const salarioOculto = !verSalario || (!novo && !!q.data && (q.data.mascarado === true || q.data.salario == null));

  const mes = competenciaAtual();
  const aus = useAusencias({ colaboradorId: id }, !novo && verRh);
  const habs = useHabilitacoes(undefined, !novo && verRh);
  const centros = useCentros();

  const inval = [['colaboradores'], ['centros-trabalho'], ['tabelas-custos'], ['painel'], ['rh']];
  const salvar = useAcao((x: Form) => {
    const base = { nome: x.nome.trim(), funcao: x.funcao.trim(), vinculo: x.vinculo, jornadaHoras: z(x.jornadaHoras), turno: x.turno.trim() || null, diasSemana: x.diasSemana, ativo: x.ativo };
    const pctEfetivo = x.encargosPercentual !== '' ? x.encargosPercentual : encargosDoVinculo(x.vinculo, porVinculo);
    const salarial = x.modoEncargos === 'percentual'
      ? { salario: z(x.salario), beneficios: z(x.beneficios), encargosPercentual: pctEfetivo }
      : { salario: z(x.salario), beneficios: z(x.beneficios), encargos: z(x.encargos), ...(novo ? {} : { encargosPercentual: null }) };
    return api<ColaboradorRH>(novo ? '/colaboradores' : `/colaboradores/${id}`, { method: novo ? 'POST' : 'PATCH', body: salarioOculto ? base : { ...base, ...salarial } });
  }, {
    invalida: inval,
    sucesso: (_r, x) => (novo ? `Pronto! ${x.nome.split(' ')[0]} está cadastrado. Aloque num centro para o custo entrar no custo-hora.` : `Alterações de ${x.nome.split(' ')[0]} salvas.`),
    onSuccess: (r) => novo && r?.id && navigate(`/colaboradores/${r.id}`, { replace: true })
  });
  const del = useAcao(() => api(`/colaboradores/${id}`, { method: 'DELETE' }), { invalida: inval, sucesso: 'Funcionário inativado. Ele sai dos próximos cálculos de custo.', onSuccess: () => navigate('/colaboradores') });

  const minhasAus = useMemo(() => aus.data?.itens ?? [], [aus.data]);
  const disp = useMemo(
    () => (f ? horasNoMes({ competencia: mes, jornadaHoras: z(f.jornadaHoras), diasSemana: f.diasSemana, ausencias: minhasAus }) : null),
    [f?.jornadaHoras, f?.diasSemana, minhasAus, mes]
  );

  if (!novo && q.isLoading) return <Card><Carregando /></Card>;
  if (!novo && q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  if (!f || !disp) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const padrao = encargosDoVinculo(f.vinculo, porVinculo);
  const setVinculo = (v: Vinculo) => {
    // Quem segue o padrão do vínculo continua seguindo o padrão do novo vínculo.
    const seguePadrao = f.encargosPercentual === '' || Number(f.encargosPercentual) === Number(padrao);
    setF({ ...f, vinculo: v, encargosPercentual: seguePadrao ? '' : f.encargosPercentual });
  };
  const pctEfetivo = f.encargosPercentual !== '' ? f.encargosPercentual : padrao;
  const previa = previaEncargos({ salario: z(f.salario), percentual: pctEfetivo, vinculo: VINCULO[f.vinculo] });

  // Horas do mês: a da API (com feriados) enquanto jornada e dias forem os salvos; senão, o motor aqui.
  const salvoIgual = !!q.data && Number(q.data.jornadaHoras) === Number(z(f.jornadaHoras)) && mesmosDias(f.diasSemana, q.data.diasSemana) && q.data.horasDisponiveisMes != null;
  const horasDisp = salvoIgual ? q.data!.horasDisponiveisMes! : disp.horasDisponiveis;
  const custo = custoAoVivo({ salario: z(f.salario), encargos: z(f.encargos), percentual: f.modoEncargos === 'percentual' ? pctEfetivo : null, beneficios: z(f.beneficios), horasDisponiveis: horasDisp });
  const mensal = dec(custo.custoMensal);
  const encPct = toNum(f.salario) > 0 ? toNum(f.encargos) / toNum(f.salario) : 0;

  const erroNome = tentou && !f.nome.trim() ? 'Como a equipe chama essa pessoa? O nome completo ajuda nos relatórios.' : null;
  const erroJornada = toNum(f.jornadaHoras) <= 0 ? 'Informe a jornada do mês; sem ela não dá para chegar no custo-hora.' : null;
  const erroPct = !salarioOculto && f.modoEncargos === 'percentual' && f.encargosPercentual !== '' && (toNum(f.encargosPercentual) < 0 || toNum(f.encargosPercentual) > 1) ? 'Use um percentual entre 0% e 100%.' : null;
  const erroDias = f.diasSemana.length === 0 ? 'Marque ao menos um dia de trabalho.' : null;
  const enviar = () => {
    setTentou(true);
    if (!f.nome.trim() || erroJornada || erroPct || erroDias) return;
    salvar.mutate(f);
  };
  const alternarDia = (n: number) => set('diasSemana', f.diasSemana.includes(n) ? f.diasSemana.filter((d) => d !== n) : [...f.diasSemana, n].sort());

  const secoes = [
    { id: 'quem', titulo: 'Quem é', completa: !!f.nome.trim() },
    { id: 'escala', titulo: 'Escala', completa: !erroJornada && !erroDias },
    { id: 'custo', titulo: 'Quanto custa', completa: salarioOculto || toNum(f.salario) > 0 },
    ...(!novo && verRh ? [{ id: 'habilitacoes', titulo: 'Habilitações', completa: (habs.data?.itens ?? []).some((x) => x.colaboradorId === id) }, { id: 'ausencias', titulo: 'Ausências', completa: true }] : []),
    ...(!novo && q.data?.usuario ? [{ id: 'comissoes', titulo: 'Comissões', completa: true }] : [])
  ];

  return (
    <>
      <FormHeader
        voltar={{ to: '/colaboradores', rotulo: 'Funcionários' }}
        iniciais={iniciais(f.nome || 'Novo')}
        cor="linear-gradient(135deg, #2A6AA3, #15395A)"
        titulo={novo ? 'Novo funcionário' : f.nome}
        lead="Salário, encargos e benefícios viram custo-hora na hora. O valor entra nos centros onde a pessoa trabalha."
        pills={!novo && <>{f.ativo ? <Pill tom="ok">Ativo</Pill> : <Pill tom="neutral">Inativo</Pill>}<Pill tom="neutral">{VINCULO[f.vinculo]}</Pill>{f.turno && <Pill tom="steel">{f.turno}</Pill>}</>}
        acoes={
          <>
            {!novo && f.ativo && <Button variante="perigo" icone={UserX} onClick={() => setInativar(true)}>Inativar</Button>}
            {podeGerir && <Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={enviar}>Salvar</Button>}
          </>
        }
      />
      <div className="flex flex-wrap gap-5 items-start">
        <NavSecoes secoes={secoes} />
        <div className="flex-[999_1_480px] min-w-0 flex flex-col gap-[18px]">
          <form className="flex flex-col gap-[18px]" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate>
            <Secao id="quem" titulo="Quem é">
              <TextField className={span(4)} label="Nome" required value={f.nome} onChange={(v) => set('nome', v)} erro={erroNome} autoComplete="off" />
              <TextField className={span(2)} label="Função" value={f.funcao} onChange={(v) => set('funcao', v)} placeholder="Operador de torno CNC" />
              <div className={span(6)}>
                <Segmented<Vinculo> label="Vínculo" value={f.vinculo} onChange={setVinculo} opcoes={(Object.keys(VINCULO) as Vinculo[]).map((k) => ({ valor: k, rotulo: VINCULO[k] }))} />
              </div>
              <div className={span(6)}>
                <Toggle label="Ativo" descricao="Inativos não entram nos próximos cálculos de custo." value={f.ativo} onChange={(v) => set('ativo', v)} />
              </div>
            </Secao>
            <Secao id="escala" titulo="Escala" descricao="Jornada, turno e dias de trabalho. As horas disponíveis do mês descontam ausências e feriados.">
              <NumberField className={span(2)} label="Jornada no mês" sufixo="h" value={f.jornadaHoras} onChange={(v) => set('jornadaHoras', v)} erro={erroJornada} />
              <TextField className={span(2)} label="Turno" value={f.turno} onChange={(v) => set('turno', v)} placeholder="Manhã, 7h às 16h" />
              <div className={`${span(2)} flex flex-col gap-1.5 min-w-0`}>
                <span className="text-[13.5px] font-medium text-ink-2">Horas disponíveis em {mesNome(mes)}</span>
                <span className="mono h-11 flex items-center text-[18px] font-bold text-primary-text" aria-live="polite">{h(horasDisp)}</span>
                <span className="text-caption text-ink-3">
                  {disp.diasAusente ? `${disp.diasAusente} ${disp.diasAusente === 1 ? 'dia' : 'dias'} fora de ${disp.diasUteis} úteis` : `${disp.diasUteis} dias úteis`}
                  {!salvoIgual && ' · prévia sem feriados'}
                </span>
              </div>
              <fieldset className={`${span(6)} m-0 p-0 border-0 flex flex-col gap-1.5 min-w-0`}>
                <legend className="text-[13.5px] font-medium text-ink-2 mb-1.5">Dias de trabalho</legend>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((d) => {
                    const on = f.diasSemana.includes(d.n);
                    return (
                      <button key={d.n} type="button" aria-pressed={on} aria-label={d.nome} title={d.nome} onClick={() => alternarDia(d.n)}
                        className={`size-11 rounded-full border font-semibold text-[14px] transition duration-micro ${on ? 'bg-ink-1 text-surface-1 border-ink-1' : 'bg-surface-2 text-ink-2 border-border-strong hover:border-ink-3'}`}>
                        {d.curto}
                      </button>
                    );
                  })}
                </div>
                {erroDias && <span className="text-caption text-bad font-medium" role="alert">{erroDias}</span>}
              </fieldset>
            </Secao>
            <Secao id="custo" titulo="Quanto custa" descricao="Valores mensais. Para horista, use a média do mês.">
              {salarioOculto ? (
                <p className={`${span(6)} m-0 text-[14px] text-ink-2 flex items-center gap-2`}><Mascara dica={DICA_SALARIO} /> Salário, encargos e benefícios ficam ocultos para o seu perfil. Dá para mudar o resto.</p>
              ) : (<>
                <NumberField className={span(3)} label={f.vinculo === 'PJ' || f.vinculo === 'SOCIO' ? 'Valor mensal' : 'Salário'} prefixo="R$" value={f.salario} onChange={(v) => set('salario', v)} />
                <NumberField className={span(3)} label="Benefícios" prefixo="R$" value={f.beneficios} onChange={(v) => set('beneficios', v)} hint="Vale-refeição, transporte, plano de saúde" />
                <div className={span(6)}>
                  <Segmented<ModoEncargos> label="Encargos" tamanho="sm" value={f.modoEncargos} onChange={(v) => set('modoEncargos', v)} opcoes={[{ valor: 'percentual', rotulo: '% do salário' }, { valor: 'valor', rotulo: 'Valor em R$' }]} />
                </div>
                {f.modoEncargos === 'percentual' ? (
                  <>
                    <NumberField className={span(3)} label="Percentual de encargos" percentual value={f.encargosPercentual} onChange={(v) => set('encargosPercentual', v)} placeholder={String(Math.round(toNum(padrao) * 1000) / 10).replace('.', ',')} erro={erroPct}
                      hint={f.encargosPercentual === '' ? `Vazio usa o padrão do vínculo (${pct(padrao, 0)}).` : 'INSS, FGTS, férias e 13º provisionados'} />
                    <div className={`${span(3)} flex flex-col gap-1.5 justify-center`}>
                      <span className="text-[13.5px] font-medium text-ink-2">Prévia</span>
                      <span className="mono text-[15px] font-semibold" aria-live="polite">{previa.texto}</span>
                      {f.encargosPercentual !== '' && Number(f.encargosPercentual) !== Number(padrao) && (
                        <button type="button" className="self-start text-caption font-semibold text-primary-text hover:underline" onClick={() => set('encargosPercentual', '')}>Voltar ao padrão {VINCULO[f.vinculo]} ({pct(padrao, 0)})</button>
                      )}
                    </div>
                  </>
                ) : (
                  <NumberField className={span(3)} label="Encargos" prefixo="R$" value={f.encargos} onChange={(v) => set('encargos', v)} hint={encPct ? `${pct(encPct)} do salário · padrão ${VINCULO[f.vinculo]} ${pct(padrao, 0)}` : 'INSS, FGTS, férias e 13º provisionados'} />
                )}
              </>)}
            </Secao>
          </form>

          {!novo && verRh && (
            <SecaoHabilitacoes colaboradorId={id} nome={f.nome} habs={(habs.data?.itens ?? []).filter((x) => x.colaboradorId === id)} carregando={habs.isLoading} erro={habs.isError}
              centros={(centros.data?.itens ?? []).map((c) => ({ id: c.id, nome: c.nome }))} podeGerir={podeRh} />
          )}
          {!novo && verRh && <SecaoAusencias colaboradorId={id} nome={f.nome} ausencias={minhasAus} carregando={aus.isLoading} erro={aus.isError} podeGerir={podeRh} />}
          {!novo && q.data?.usuario && (
            <Secao id="comissoes" titulo="Comissões" descricao={`Comissões de venda de ${q.data.usuario.nome}, vindas do Financeiro. Somente leitura.`}>
              {!q.data.comissoes?.length ? (
                <p className={`${span(6)} m-0 text-[14px] text-ink-2`}>Nenhuma comissão lançada ainda.</p>
              ) : (
                <ul className={`${span(6)} m-0 p-0 list-none flex flex-col gap-1.5`}>
                  {q.data.comissoes.map((c) => (
                    <li key={c.competencia} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[14px] bg-surface-2">
                      <span className="text-[14px] capitalize">{competenciaLonga(c.competencia)}</span>
                      <span className="mono text-[14px] font-semibold">{brl(c.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          )}
        </div>
        {!salarioOculto && <GlassPanel placa="aco" className="flex-[1_1_320px] max-w-full lg:max-w-[380px] lg:sticky lg:top-24" aria-label="Custo ao vivo">
          <h2 className="m-0 text-[24px] font-bold">Quanto essa pessoa custa</h2>
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <div className="p-3 rounded-[16px] bg-surface-1">
              <span className="block text-caption text-ink-3">Custo mensal</span>
              <span className="mono text-[20px] font-bold">{brl(custo.custoMensal)}</span>
            </div>
            <div className="p-3 rounded-[16px] bg-surface-1">
              <span className="block text-caption text-ink-3">Custo-hora</span>
              <span className="mono text-[20px] font-bold text-primary-text">{custo.custoHora ? brl(custo.custoHora) : '—'}</span>
              <span className="block text-[12px] text-ink-2">mensal ÷ {h(horasDisp)} de {mesNome(mes)}</span>
            </div>
          </div>
          <CompositionBar
            rotulo="Composição do custo mensal"
            itens={[
              { chave: 's', rotulo: 'Salário', valor: z(f.salario), cor: 'var(--pm-chart-material)' },
              { chave: 'e', rotulo: 'Encargos', valor: custo.encargos, cor: 'var(--pm-chart-rateio)' },
              { chave: 'b', rotulo: 'Benefícios', valor: z(f.beneficios), cor: 'var(--pm-chart-hora)' }
            ].filter((x) => toNum(x.valor) > 0)}
          />
          {!novo && q.data && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink-2">Onde trabalha</span>
              {q.data.alocacoes.length === 0 ? (
                <span className="text-[13.5px] text-ink-2">Ainda não está em nenhum centro. Aloque pela ficha do centro de trabalho.</span>
              ) : (
                q.data.alocacoes.map((a) => (
                  <Link key={a.centroId} to={`/centros-trabalho/${a.centroId}`} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-[14px] bg-surface-1 no-underline text-ink-1">
                    <span className="truncate text-[14px] font-medium">{a.centroNome}</span>
                    <span className="mono text-[13px]">{pct(a.alocacao, 0)} · {brl(mensal.times(z(a.alocacao)).toString())}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </GlassPanel>}
      </div>
      <Modal
        aberto={inativar}
        onFechar={() => setInativar(false)}
        titulo={`Inativar ${f.nome.split(' ')[0]}?`}
        rodape={<><Button onClick={() => setInativar(false)}>Manter ativo</Button><Button variante="perigo" icone={UserX} carregando={del.isPending} onClick={() => del.mutate(undefined)}>Inativar</Button></>}
      >
        <p className="m-0 text-ink-2">O cadastro fica guardado, mas sai dos próximos cálculos. A Tabela de Custos vigente fica marcada como desatualizada.</p>
      </Modal>
    </>
  );
}

function SecaoHabilitacoes({ colaboradorId, nome, habs, carregando, erro, centros, podeGerir }: { colaboradorId: string; nome: string; habs: Habilitacao[]; carregando: boolean; erro: boolean; centros: { id: string; nome: string }[]; podeGerir: boolean }) {
  const [modal, setModal] = useState<{ hab?: Habilitacao; renovar?: boolean } | null>(null);
  return (
    <Secao id="habilitacoes" titulo="Habilitações" descricao="Sem habilitação válida no centro, a alocação, a agenda e o apontamento recusam a pessoa.">
      <div className={`${span(6)} flex flex-col gap-2`}>
        {carregando ? <p className="m-0 text-ink-2">Carregando habilitações…</p> : erro ? <p className="m-0 text-bad">Não deu para carregar as habilitações agora.</p> : habs.length === 0 ? (
          <p className="m-0 text-[14px] text-ink-2">{nome.split(' ')[0] || 'Essa pessoa'} ainda não tem habilitações cadastradas.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
            {habs.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 rounded-[14px] bg-surface-2">
                <span className="flex-[1_1_200px] min-w-0 flex flex-col">
                  <span className="font-medium break-words">{x.descricao}</span>
                  <span className="text-caption text-ink-3">{x.centroNome ?? 'Centro'} · vale até <span className="mono">{data(x.validade)}</span></span>
                </span>
                <SituacaoHabPill situacao={x.situacao} />
                {podeGerir && <Button tamanho="sm" icone={RefreshCw} onClick={() => setModal({ hab: x, renovar: true })}>Renovar</Button>}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {podeGerir && <Button tamanho="sm" icone={ShieldPlus} onClick={() => setModal({})}>Adicionar habilitação</Button>}
          <Button tamanho="sm" variante="terciario" to="/rh?aba=habilitacoes">Ver matriz completa</Button>
        </div>
      </div>
      {modal && <HabilitacaoModal habilitacao={modal.hab} renovar={modal.renovar} colaboradorId={colaboradorId} colaboradores={[{ id: colaboradorId, nome }]} centros={centros} onFechar={() => setModal(null)} />}
    </Secao>
  );
}

function SecaoAusencias({ colaboradorId, nome, ausencias, carregando, erro, podeGerir }: { colaboradorId: string; nome: string; ausencias: Ausencia[]; carregando: boolean; erro: boolean; podeGerir: boolean }) {
  const [modal, setModal] = useState<{ ausencia?: Ausencia } | null>(null);
  const corte = somarDias(hojeISO(), -90);
  const recentes = ausencias.filter((a) => a.fim >= corte).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const hoje = hojeISO();
  return (
    <Secao id="ausencias" titulo="Ausências" descricao="Férias, afastamentos, treinamentos, faltas e folgas dos últimos 90 dias e as próximas.">
      <div className={`${span(6)} flex flex-col gap-2`}>
        {carregando ? <p className="m-0 text-ink-2">Carregando ausências…</p> : erro ? <p className="m-0 text-bad">Não deu para carregar as ausências agora.</p> : recentes.length === 0 ? (
          <p className="m-0 text-[14px] text-ink-2">Nenhuma ausência recente ou marcada.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
            {recentes.map((a) => (
              <li key={a.id}>
                <button type="button" disabled={!podeGerir} onClick={() => setModal({ ausencia: a })} className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 rounded-[14px] bg-surface-2 text-left enabled:hover:shadow-1 disabled:cursor-default" aria-label={`${TIPO_AUSENCIA[a.tipo]?.rotulo ?? a.tipo} ${periodo(a)}${podeGerir ? ', editar' : ''}`}>
                  <TipoAusenciaPill tipo={a.tipo} />
                  <span className="mono text-[13.5px]">{periodo(a)}</span>
                  {a.inicio <= hoje && a.fim >= hoje && <Pill tom="warn">Hoje</Pill>}
                  {a.inicio > hoje && <Pill tom="info">Marcada</Pill>}
                  {a.observacao && <span className="basis-full text-caption text-ink-3 break-words">{a.observacao}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {podeGerir && <Button tamanho="sm" icone={CalendarPlus} onClick={() => setModal({})}>Registrar ausência</Button>}
          <Button tamanho="sm" variante="terciario" to="/rh?aba=ausencias">Ver calendário da equipe</Button>
        </div>
      </div>
      {modal && <AusenciaModal ausencia={modal.ausencia} inicial={{ colaboradorId }} colaboradores={[{ id: colaboradorId, nome }]} onFechar={() => setModal(null)} />}
    </Secao>
  );
}
