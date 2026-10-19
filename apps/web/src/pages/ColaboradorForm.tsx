import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Save, UserX } from 'lucide-react';
import { dec } from '@promec/motor';
import { api } from '../lib/api';
import type { Colaborador, Vinculo } from '../lib/types';
import { brl, iniciais, pct, toNum } from '../lib/format';
import { useAcao } from '../lib/queries';
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

interface Form { nome: string; funcao: string; vinculo: Vinculo; salario: string; encargos: string; beneficios: string; jornadaHoras: string; ativo: boolean }
const VAZIO: Form = { nome: '', funcao: '', vinculo: 'CLT', salario: '', encargos: '', beneficios: '', jornadaHoras: '220', ativo: true };
const z = (v: string) => (v === '' || !Number.isFinite(Number(v)) ? '0' : v);

export default function ColaboradorForm() {
  const { id = 'novo' } = useParams();
  const novo = id === 'novo';
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['colaboradores', id], queryFn: () => api<Colaborador>(`/colaboradores/${id}`), enabled: !novo });
  const [f, setF] = useState<Form | null>(novo ? VAZIO : null);
  const [tentou, setTentou] = useState(false);
  const [inativar, setInativar] = useState(false);
  useEffect(() => {
    if (q.data) {
      const c = q.data;
      setF({ nome: c.nome, funcao: c.funcao ?? '', vinculo: c.vinculo, salario: c.salario, encargos: c.encargos, beneficios: c.beneficios, jornadaHoras: c.jornadaHoras, ativo: c.ativo });
    }
  }, [q.data]);
  useTitulo(novo ? 'Novo funcionário' : q.data?.nome ?? 'Funcionário');

  const inval = [['colaboradores'], ['centros-trabalho'], ['tabelas-custos'], ['painel']];
  const salvar = useAcao((x: Form) => api<Colaborador>(novo ? '/colaboradores' : `/colaboradores/${id}`, {
    method: novo ? 'POST' : 'PATCH',
    body: { ...x, nome: x.nome.trim(), funcao: x.funcao.trim(), salario: z(x.salario), encargos: z(x.encargos), beneficios: z(x.beneficios), jornadaHoras: z(x.jornadaHoras) }
  }), {
    invalida: inval,
    sucesso: (_r, x) => `Pronto! ${x.nome.split(' ')[0]} está cadastrado. Aloque num centro para o custo entrar no custo-hora.`,
    onSuccess: (r) => novo && r?.id && navigate(`/colaboradores/${r.id}`, { replace: true })
  });
  const del = useAcao(() => api(`/colaboradores/${id}`, { method: 'DELETE' }), { invalida: inval, sucesso: 'Funcionário inativado. Ele sai dos próximos cálculos de custo.', onSuccess: () => navigate('/colaboradores') });

  if (!novo && q.isLoading) return <Card><Carregando /></Card>;
  if (!novo && q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  if (!f) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const mensal = dec(z(f.salario)).plus(z(f.encargos)).plus(z(f.beneficios));
  const jornada = dec(z(f.jornadaHoras));
  const custoHora = jornada.gt(0) ? mensal.div(jornada) : dec(0);
  const encPct = toNum(f.salario) > 0 ? toNum(f.encargos) / toNum(f.salario) : 0;
  const erroNome = tentou && !f.nome.trim() ? 'Como a equipe chama essa pessoa? O nome completo ajuda nos relatórios.' : null;
  const erroJornada = toNum(f.jornadaHoras) <= 0 ? 'Informe a jornada do mês; sem ela não dá para chegar no custo-hora.' : null;
  const enviar = () => {
    setTentou(true);
    if (!f.nome.trim() || erroJornada) return;
    salvar.mutate(f);
  };

  return (
    <>
      <FormHeader
        voltar={{ to: '/colaboradores', rotulo: 'Funcionários' }}
        iniciais={iniciais(f.nome || 'Novo')}
        cor="linear-gradient(135deg, #2A6AA3, #15395A)"
        titulo={novo ? 'Novo funcionário' : f.nome}
        lead="Salário, encargos e benefícios viram custo-hora na hora. O valor entra nos centros onde a pessoa trabalha."
        pills={!novo && <>{f.ativo ? <Pill tom="ok">Ativo</Pill> : <Pill tom="neutral">Inativo</Pill>}<Pill tom="neutral">{VINCULO[f.vinculo]}</Pill></>}
        acoes={
          <>
            {!novo && f.ativo && <Button variante="perigo" icone={UserX} onClick={() => setInativar(true)}>Inativar</Button>}
            <Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={enviar}>Salvar</Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-5 items-start">
        <NavSecoes secoes={[{ id: 'quem', titulo: 'Quem é', completa: !!f.nome.trim() }, { id: 'custo', titulo: 'Quanto custa', completa: toNum(f.salario) > 0 && !erroJornada }]} />
        <form className="flex-[999_1_480px] min-w-0 flex flex-col gap-[18px]" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate>
          <Secao id="quem" titulo="Quem é">
            <TextField className={span(4)} label="Nome" required value={f.nome} onChange={(v) => set('nome', v)} erro={erroNome} autoComplete="off" />
            <TextField className={span(2)} label="Função" value={f.funcao} onChange={(v) => set('funcao', v)} placeholder="Operador de torno CNC" />
            <div className={span(6)}>
              <Segmented<Vinculo> label="Vínculo" value={f.vinculo} onChange={(v) => set('vinculo', v)} opcoes={(Object.keys(VINCULO) as Vinculo[]).map((k) => ({ valor: k, rotulo: VINCULO[k] }))} />
            </div>
            <div className={span(6)}>
              <Toggle label="Ativo" descricao="Inativos não entram nos próximos cálculos de custo." value={f.ativo} onChange={(v) => set('ativo', v)} />
            </div>
          </Secao>
          <Secao id="custo" titulo="Quanto custa" descricao="Valores mensais. Para horista, use a média do mês.">
            <NumberField className={span(2)} label={f.vinculo === 'PJ' || f.vinculo === 'SOCIO' ? 'Valor mensal' : 'Salário'} prefixo="R$" value={f.salario} onChange={(v) => set('salario', v)} />
            <NumberField className={span(2)} label="Encargos" prefixo="R$" value={f.encargos} onChange={(v) => set('encargos', v)} hint={encPct ? `${pct(encPct)} do salário` : 'INSS, FGTS, férias e 13º provisionados'} />
            <NumberField className={span(2)} label="Benefícios" prefixo="R$" value={f.beneficios} onChange={(v) => set('beneficios', v)} hint="Vale-refeição, transporte, plano de saúde" />
            <NumberField className={span(2)} label="Jornada no mês" sufixo="h" value={f.jornadaHoras} onChange={(v) => set('jornadaHoras', v)} erro={erroJornada} />
          </Secao>
        </form>
        <GlassPanel placa="aco" className="flex-[1_1_320px] max-w-full lg:max-w-[380px] lg:sticky lg:top-24" aria-label="Custo ao vivo">
          <h2 className="m-0 text-[24px] font-bold">Quanto essa pessoa custa</h2>
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <div className="p-3 rounded-[16px] bg-surface-1">
              <span className="block text-caption text-ink-3">Custo mensal</span>
              <span className="mono text-[20px] font-bold">{brl(mensal.toString())}</span>
            </div>
            <div className="p-3 rounded-[16px] bg-surface-1">
              <span className="block text-caption text-ink-3">Custo-hora</span>
              <span className="mono text-[20px] font-bold text-primary-text">{brl(custoHora.toString())}</span>
              <span className="block text-[12px] text-ink-2">mensal ÷ {toNum(f.jornadaHoras)} h</span>
            </div>
          </div>
          <CompositionBar
            rotulo="Composição do custo mensal"
            itens={[
              { chave: 's', rotulo: 'Salário', valor: z(f.salario), cor: 'var(--pm-chart-material)' },
              { chave: 'e', rotulo: 'Encargos', valor: z(f.encargos), cor: 'var(--pm-chart-rateio)' },
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
        </GlassPanel>
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
