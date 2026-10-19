import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, CheckCircle2, FilePlus2, Save } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Cliente, StatusCliente, TipoCliente } from '../lib/types';
import { brl, iniciais } from '../lib/format';
import { documentoValido, mascaraDocumento, mascaraTelefone, soDigitos } from '../lib/documento';
import { useAcao } from '../lib/queries';
import { FormHeader, NavSecoes, Secao, span } from '../components/Form';
import { Field, Segmented, SelectField, TextArea, TextField } from '../components/Field';
import { Button } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { Card } from '../components/Card';
import { Carregando, ErroEstado } from '../components/EmptyState';
import { StatusClientePill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { useTitulo } from '../layout/titulo';

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
type Form = Omit<Cliente, 'id' | 'resumo'>;
const VAZIO: Form = { tipo: 'PJ', documento: '', nome: '', fantasia: '', email: '', telefone: '', cidade: '', uf: 'SC', status: 'ATIVO', observacoes: '' };
const emailOk = (e: string) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function ClienteForm() {
  const { id = 'novo' } = useParams();
  const novo = id === 'novo';
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['clientes', 'item', id], queryFn: () => api<Cliente>(`/clientes/${id}`), enabled: !novo });
  const [f, setF] = useState<Form | null>(novo ? VAZIO : null);
  const [tentou, setTentou] = useState(false);
  const [erroDoc, setErroDoc] = useState<string | null>(null);
  const [inativar, setInativar] = useState(false);
  useEffect(() => {
    if (q.data) {
      const { id: _i, resumo: _r, ...resto } = q.data;
      setF({ ...VAZIO, ...resto, fantasia: resto.fantasia ?? '', email: resto.email ?? '', telefone: resto.telefone ?? '', cidade: resto.cidade ?? '', uf: resto.uf ?? '', observacoes: resto.observacoes ?? '' });
    }
  }, [q.data]);
  useTitulo(novo ? 'Novo cliente' : q.data?.fantasia || q.data?.nome || 'Cliente');

  const salvar = useAcao(
    (x: Form) => api<Cliente>(novo ? '/clientes' : `/clientes/${id}`, { method: novo ? 'POST' : 'PATCH', body: { ...x, documento: soDigitos(x.documento), telefone: soDigitos(x.telefone), nome: x.nome.trim(), fantasia: x.tipo === 'PJ' ? x.fantasia.trim() : '' } }),
    {
      invalida: [['clientes']],
      sucesso: (_r, x) => `${x.fantasia || x.nome} está na carteira. Já dá para montar um orçamento.`,
      onSuccess: (r) => novo && r?.id && navigate(`/clientes/${r.id}`, { replace: true })
    }
  );
  const del = useAcao(() => api(`/clientes/${id}`, { method: 'DELETE' }), { invalida: [['clientes']], sucesso: 'Cliente inativado. O histórico continua guardado.', onSuccess: () => navigate('/clientes') });

  if (!novo && q.isLoading) return <Card><Carregando /></Card>;
  if (!novo && q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  if (!f) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const digitos = soDigitos(f.documento);
  const completo = digitos.length === (f.tipo === 'PF' ? 11 : 14);
  const docOk = completo && documentoValido(f.tipo, digitos);
  const erroDocumento =
    erroDoc ??
    (completo && !docOk
      ? `Esse ${f.tipo === 'PF' ? 'CPF' : 'CNPJ'} não fecha nos dígitos verificadores. Confira o número no cartão ou na nota.`
      : tentou && !completo
        ? `Informe o ${f.tipo === 'PF' ? 'CPF com 11' : 'CNPJ com 14'} dígitos.`
        : null);
  const erroNome = tentou && !f.nome.trim() ? (f.tipo === 'PJ' ? 'Informe a razão social, como está no CNPJ.' : 'Informe o nome completo.') : null;
  const erroEmail = !emailOk(f.email) ? 'Esse e-mail parece incompleto. Confira o @ e o domínio.' : null;

  const enviar = () => {
    setTentou(true);
    if (!docOk || !f.nome.trim() || erroEmail) return;
    salvar.mutate(f, {
      onError: (e) => {
        if (e instanceof ApiError && e.codigo === 'DOCUMENTO_DUPLICADO') setErroDoc(e.message);
      }
    });
  };

  const r = q.data?.resumo;
  return (
    <>
      <FormHeader
        voltar={{ to: '/clientes', rotulo: 'Clientes' }}
        iniciais={iniciais(f.fantasia || f.nome || 'Novo')}
        cor={f.tipo === 'PJ' ? 'linear-gradient(135deg, #2A6AA3, #15395A)' : 'linear-gradient(135deg, #7C5CC4, #15395A)'}
        titulo={novo ? 'Novo cliente' : f.fantasia || f.nome}
        lead={novo ? 'Com o CPF ou CNPJ certo, o orçamento sai com os dados certos.' : f.fantasia ? f.nome : 'Dados de contato e situação do cliente.'}
        pills={!novo && <StatusClientePill status={f.status} />}
        acoes={
          <>
            {!novo && f.status !== 'INATIVO' && <Button variante="perigo" icone={Ban} onClick={() => setInativar(true)}>Inativar</Button>}
            <Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={enviar}>Salvar</Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-5 items-start">
        <NavSecoes secoes={[{ id: 'quem', titulo: 'Quem é', completa: docOk && !!f.nome.trim() }, { id: 'contato', titulo: 'Contato', completa: !!(f.email || f.telefone) }, { id: 'situacao', titulo: 'Situação', completa: true }]} />
        <form className="flex-[999_1_480px] min-w-0 flex flex-col gap-[18px]" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate>
          <Secao id="quem" titulo="Quem é">
            <div className={span(6)}>
              <Segmented<TipoCliente>
                label="Tipo"
                value={f.tipo}
                onChange={(v) => setF({ ...f, tipo: v, documento: mascaraDocumento(v, f.documento) })}
                opcoes={[{ valor: 'PJ', rotulo: 'Empresa (CNPJ)' }, { valor: 'PF', rotulo: 'Pessoa física (CPF)' }]}
              />
            </div>
            <Field className={span(2)} label={f.tipo === 'PF' ? 'CPF' : 'CNPJ'} obrigatorio erro={erroDocumento} hint={docOk ? 'Dígitos conferidos.' : undefined}>
              {({ id: fid, describedBy, invalido }) => (
                <div className="campo" data-erro={invalido}>
                  <input
                    id={fid}
                    inputMode="numeric"
                    className="mono"
                    value={f.documento}
                    placeholder={f.tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                    onChange={(e) => { setErroDoc(null); set('documento', mascaraDocumento(f.tipo, e.target.value)); }}
                    aria-invalid={invalido || undefined}
                    aria-describedby={describedBy}
                    required
                  />
                  {docOk && <CheckCircle2 className="size-[18px] text-ok" aria-label="válido" />}
                </div>
              )}
            </Field>
            <TextField className={span(4)} label={f.tipo === 'PJ' ? 'Razão social' : 'Nome completo'} required value={f.nome} onChange={(v) => set('nome', v)} erro={erroNome} />
            {f.tipo === 'PJ' && <TextField className={span(3)} label="Nome fantasia" value={f.fantasia} onChange={(v) => set('fantasia', v)} hint="Como a oficina chama o cliente no dia a dia." />}
          </Secao>
          <Secao id="contato" titulo="Contato" descricao="Para onde vai o orçamento.">
            <TextField className={span(3)} label="E-mail" type="email" value={f.email} onChange={(v) => set('email', v.trim())} erro={erroEmail} placeholder="compras@empresa.com.br" />
            <TextField className={span(3)} label="Telefone" mono inputMode="tel" value={mascaraTelefone(f.telefone)} onChange={(v) => set('telefone', v)} placeholder="(47) 3333-0000" />
            <TextField className={span(4)} label="Cidade" value={f.cidade} onChange={(v) => set('cidade', v)} />
            <SelectField className={span(2)} label="UF" value={f.uf} onChange={(v) => set('uf', v)} opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))} vazio="—" />
          </Secao>
          <Secao id="situacao" titulo="Situação">
            <div className={span(6)}>
              <Segmented<StatusCliente> label="Situação" value={f.status} onChange={(v) => set('status', v)} opcoes={[{ valor: 'ATIVO', rotulo: 'Ativo' }, { valor: 'BLOQUEADO', rotulo: 'Bloqueado' }, { valor: 'INATIVO', rotulo: 'Inativo' }]} />
            </div>
            <TextArea className={span(6)} label="Observações" value={f.observacoes} onChange={(v) => set('observacoes', v)} hint="Quem aprova, como prefere receber, cuidados na entrega." />
          </Secao>
        </form>
        <GlassPanel placa="aco" className="flex-[1_1_300px] max-w-full lg:max-w-[360px] lg:sticky lg:top-24" aria-label="Ficha do cliente">
          <h2 className="m-0 text-[24px] font-bold">Ficha do cliente</h2>
          {r ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-[16px] bg-surface-1"><span className="block text-caption text-ink-3">Orçamentos</span><span className="mono text-[20px] font-bold">{r.orcamentos}</span></div>
              <div className="p-3 rounded-[16px] bg-surface-1"><span className="block text-caption text-ink-3">Aprovados</span><span className="mono text-[20px] font-bold">{r.aprovados}</span></div>
              <div className="col-span-2 p-3 rounded-[16px] bg-surface-1"><span className="block text-caption text-ink-3">Valor aprovado</span><span className="mono text-[24px] font-bold text-ok">{brl(r.valorAprovado)}</span></div>
            </div>
          ) : (
            <p className="m-0 text-[14px] text-ink-2">Depois de salvo, aqui aparecem os orçamentos, o que foi aprovado e quanto isso rendeu.</p>
          )}
          {!novo && <Button icone={FilePlus2} to={`/orcamentos/novo?cliente=${id}`}>Novo orçamento para este cliente</Button>}
        </GlassPanel>
      </div>
      <Modal
        aberto={inativar}
        onFechar={() => setInativar(false)}
        titulo="Inativar este cliente?"
        rodape={<><Button onClick={() => setInativar(false)}>Manter</Button><Button variante="perigo" icone={Ban} carregando={del.isPending} onClick={() => del.mutate(undefined)}>Inativar</Button></>}
      >
        <p className="m-0 text-ink-2">Ele deixa de aparecer na hora de orçar. Orçamentos e histórico continuam guardados.</p>
      </Modal>
    </>
  );
}
