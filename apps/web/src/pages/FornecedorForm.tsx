import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, CheckCircle2, Save } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Fornecedor, StatusCliente, TipoCliente, TipoItem } from '../lib/types';
import { brl, data, iniciais } from '../lib/format';
import { documentoValido, mascaraDocumento, mascaraTelefone, soDigitos } from '../lib/documento';
import { useAcao } from '../lib/queries';
import { FormHeader, NavSecoes, Secao, span } from '../components/Form';
import { Field, NumberField, Segmented, SelectField, TextField } from '../components/Field';
import { Button } from '../components/Button';
import { GlassPanel } from '../components/GlassPanel';
import { Card } from '../components/Card';
import { Carregando, ErroEstado } from '../components/EmptyState';
import { StatusClientePill } from '../components/Pill';
import { Modal } from '../components/Modal';
import { Estrelas } from '../components/Estrelas';
import { TIPO_ITEM } from '../features/suprimentos/sup';
import { useTitulo } from '../layout/titulo';

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
interface Form { tipo: TipoCliente; documento: string; nome: string; fantasia: string; email: string; telefone: string; cidade: string; uf: string; categorias: TipoItem[]; prazoMedioDias: string; condicaoPagamento: string; status: StatusCliente }
const VAZIO: Form = { tipo: 'PJ', documento: '', nome: '', fantasia: '', email: '', telefone: '', cidade: '', uf: 'SC', categorias: [], prazoMedioDias: '7', condicaoPagamento: '28 dias', status: 'ATIVO' };

export default function FornecedorForm() {
  const { id = 'novo' } = useParams();
  const novo = id === 'novo';
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['fornecedores', 'item', id], queryFn: () => api<Fornecedor>(`/fornecedores/${id}`), enabled: !novo });
  const [f, setF] = useState<Form | null>(novo ? VAZIO : null);
  const [tentou, setTentou] = useState(false);
  const [erroDoc, setErroDoc] = useState<string | null>(null);
  const [inativar, setInativar] = useState(false);
  useEffect(() => {
    if (q.data) {
      const x = q.data;
      setF({ tipo: x.tipo, documento: mascaraDocumento(x.tipo, x.documento ?? ''), nome: x.nome, fantasia: x.fantasia ?? '', email: x.email ?? '', telefone: x.telefone ?? '', cidade: x.cidade ?? '', uf: x.uf ?? '', categorias: x.categorias ?? [], prazoMedioDias: String(x.prazoMedioDias ?? ''), condicaoPagamento: x.condicaoPagamento ?? '', status: x.status });
    }
  }, [q.data]);
  useTitulo(novo ? 'Novo fornecedor' : q.data?.fantasia || q.data?.nome || 'Fornecedor');

  const salvar = useAcao((x: Form) => api<Fornecedor>(novo ? '/fornecedores' : `/fornecedores/${id}`, {
    method: novo ? 'POST' : 'PATCH',
    body: { ...x, documento: soDigitos(x.documento), telefone: soDigitos(x.telefone), nome: x.nome.trim(), fantasia: x.fantasia.trim(), prazoMedioDias: Math.round(Number(x.prazoMedioDias) || 0) }
  }), { invalida: [['fornecedores']], sucesso: (_r, x) => `${x.fantasia || x.nome} salvo. Já pode receber cotações.`, onSuccess: (r) => novo && r?.id && navigate(`/fornecedores/${r.id}`, { replace: true }) });
  const del = useAcao(() => api(`/fornecedores/${id}`, { method: 'DELETE' }), { invalida: [['fornecedores']], sucesso: 'Fornecedor inativado. Pedidos e histórico ficam guardados.', onSuccess: () => navigate('/fornecedores') });

  if (!novo && q.isLoading) return <Card><Carregando /></Card>;
  if (!novo && q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  if (!f) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const dig = soDigitos(f.documento);
  const completo = dig.length === (f.tipo === 'PF' ? 11 : 14);
  const docOk = completo && documentoValido(f.tipo, dig);
  const erroDocumento = erroDoc ?? (completo && !docOk ? 'Esse número não fecha nos dígitos verificadores. Confira na nota do fornecedor.' : tentou && !completo ? `Informe o ${f.tipo === 'PF' ? 'CPF' : 'CNPJ'} completo.` : null);
  const enviar = () => {
    setTentou(true);
    if (!docOk || !f.nome.trim()) return;
    salvar.mutate(f, { onError: (e) => e instanceof ApiError && e.codigo === 'DOCUMENTO_DUPLICADO' && setErroDoc(e.message) });
  };
  const x = q.data;

  return (
    <>
      <FormHeader
        voltar={{ to: '/fornecedores', rotulo: 'Fornecedores' }}
        iniciais={iniciais(f.fantasia || f.nome || 'Novo')}
        cor="linear-gradient(135deg, #0E7C86, #15395A)"
        titulo={novo ? 'Novo fornecedor' : f.fantasia || f.nome}
        lead={novo ? 'Com o CNPJ certo e as categorias, ele aparece na hora de cotar.' : f.fantasia ? f.nome : 'Contato, condições e o histórico de preços.'}
        pills={!novo && <StatusClientePill status={f.status} />}
        acoes={<>{!novo && f.status !== 'INATIVO' && <Button variante="perigo" icone={Ban} onClick={() => setInativar(true)}>Inativar</Button>}<Button variante="primario" icone={Save} carregando={salvar.isPending} onClick={enviar}>Salvar</Button></>}
      />
      <div className="flex flex-wrap gap-5 items-start">
        <NavSecoes secoes={[{ id: 'quem', titulo: 'Quem é', completa: docOk && !!f.nome.trim() }, { id: 'fornece', titulo: 'O que fornece', completa: f.categorias.length > 0 }, { id: 'contato', titulo: 'Contato', completa: !!(f.email || f.telefone) }]} />
        <form className="flex-[999_1_480px] min-w-0 flex flex-col gap-[18px]" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate>
          <Secao id="quem" titulo="Quem é">
            <div className={span(6)}>
              <Segmented<TipoCliente> label="Tipo" value={f.tipo} onChange={(v) => setF({ ...f, tipo: v, documento: mascaraDocumento(v, f.documento) })} opcoes={[{ valor: 'PJ', rotulo: 'Empresa (CNPJ)' }, { valor: 'PF', rotulo: 'Pessoa física (CPF)' }]} />
            </div>
            <Field className={span(2)} label={f.tipo === 'PF' ? 'CPF' : 'CNPJ'} obrigatorio erro={erroDocumento} hint={docOk ? 'Dígitos conferidos.' : undefined}>
              {({ id: fid, describedBy, invalido }) => (
                <div className="campo" data-erro={invalido}>
                  <input id={fid} inputMode="numeric" className="mono" value={f.documento} onChange={(e) => { setErroDoc(null); set('documento', mascaraDocumento(f.tipo, e.target.value)); }} aria-invalid={invalido || undefined} aria-describedby={describedBy} />
                  {docOk && <CheckCircle2 className="size-[18px] text-ok" aria-label="válido" />}
                </div>
              )}
            </Field>
            <TextField className={span(4)} label={f.tipo === 'PJ' ? 'Razão social' : 'Nome completo'} required value={f.nome} onChange={(v) => set('nome', v)} erro={tentou && !f.nome.trim() ? 'Informe o nome como está na nota.' : null} />
            <TextField className={span(3)} label="Nome fantasia" value={f.fantasia} onChange={(v) => set('fantasia', v)} />
            <div className={span(3)}>
              <Segmented<StatusCliente> label="Situação" tamanho="sm" value={f.status} onChange={(v) => set('status', v)} opcoes={[{ valor: 'ATIVO', rotulo: 'Ativo' }, { valor: 'BLOQUEADO', rotulo: 'Bloqueado' }, { valor: 'INATIVO', rotulo: 'Inativo' }]} />
            </div>
          </Secao>
          <Secao id="fornece" titulo="O que fornece e como">
            <div className={`${span(6)} flex flex-col gap-1.5`}>
              <span className="text-[13.5px] font-medium text-ink-2" id="cat-lbl">Categorias</span>
              <div role="group" aria-labelledby="cat-lbl" className="flex flex-wrap gap-2">
                {(Object.keys(TIPO_ITEM) as TipoItem[]).map((t) => {
                  const on = f.categorias.includes(t);
                  return (
                    <button key={t} type="button" aria-pressed={on} onClick={() => set('categorias', on ? f.categorias.filter((c) => c !== t) : [...f.categorias, t])}
                      className={`h-9 px-3.5 rounded-full border text-[13px] font-medium transition ${on ? 'bg-ink-1 text-surface-1 border-ink-1' : 'bg-surface-2 text-ink-2 border-border-strong'}`}>{TIPO_ITEM[t]}</button>
                  );
                })}
              </div>
            </div>
            <NumberField className={span(2)} label="Prazo médio de entrega" sufixo="dias" value={f.prazoMedioDias} onChange={(v) => set('prazoMedioDias', v)} />
            <TextField className={span(4)} label="Condição de pagamento" value={f.condicaoPagamento} onChange={(v) => set('condicaoPagamento', v)} placeholder="28 dias · boleto" hint="Define o vencimento da conta a pagar no recebimento." />
          </Secao>
          <Secao id="contato" titulo="Contato">
            <TextField className={span(3)} label="E-mail" type="email" value={f.email} onChange={(v) => set('email', v.trim())} placeholder="vendas@fornecedor.com.br" />
            <TextField className={span(3)} label="Telefone" mono inputMode="tel" value={mascaraTelefone(f.telefone)} onChange={(v) => set('telefone', v)} />
            <TextField className={span(4)} label="Cidade" value={f.cidade} onChange={(v) => set('cidade', v)} />
            <SelectField className={span(2)} label="UF" value={f.uf} onChange={(v) => set('uf', v)} opcoes={UFS.map((u) => ({ valor: u, rotulo: u }))} vazio="—" />
          </Secao>
        </form>
        <GlassPanel placa="aco" className="flex-[1_1_300px] max-w-full lg:max-w-[360px] lg:sticky lg:top-24" aria-label="Ficha do fornecedor">
          <h2 className="m-0 text-[24px] font-bold">Como ele entrega</h2>
          {x ? (
            <>
              <div className="p-3 rounded-[16px] bg-surface-1 flex flex-col gap-1">
                <Estrelas valor={x.avaliacao} tamanho={20} />
                <span className="text-[13px] text-ink-2">{x.entregas} {x.entregas === 1 ? 'entrega avaliada' : 'entregas avaliadas'}. Atraso, divergência e não-conformidade baixam a nota.</span>
              </div>
              <span className="text-[13px] font-semibold text-ink-2">Últimos preços</span>
              {(x.itens ?? []).length === 0 ? <span className="text-[13.5px] text-ink-3">Nenhuma compra registrada ainda.</span> : (x.itens ?? []).map((i) => (
                <Link key={i.itemId} to={`/itens/${i.itemId}`} className="flex justify-between gap-2 px-3 py-2.5 rounded-[14px] bg-surface-1 no-underline text-ink-1">
                  <span className="truncate text-[14px]">{i.descricao}</span>
                  <span className="mono text-[13px] whitespace-nowrap"><strong>{brl(i.ultimoPreco)}</strong> <span className="text-ink-3">{data(i.data)}</span></span>
                </Link>
              ))}
            </>
          ) : (
            <p className="m-0 text-[14px] text-ink-2">Depois do primeiro recebimento, aqui aparecem a nota e os últimos preços por item.</p>
          )}
        </GlassPanel>
      </div>
      <Modal aberto={inativar} onFechar={() => setInativar(false)} titulo="Inativar este fornecedor?"
        rodape={<><Button onClick={() => setInativar(false)}>Manter</Button><Button variante="perigo" icone={Ban} carregando={del.isPending} onClick={() => del.mutate(undefined)}>Inativar</Button></>}>
        <p className="m-0 text-ink-2">Ele deixa de aparecer nas cotações. Pedidos e preços antigos continuam guardados.</p>
      </Modal>
    </>
  );
}
