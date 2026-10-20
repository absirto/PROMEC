import { mascaraDocumento } from '../lib/documento';
import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { data, num } from '../lib/format';
import { SEGMENTO } from '../lib/rotulos';
import type { Segmento } from '../lib/types';
import { Button, classeBotao } from '../components/Button';
import { LogoProMEC } from '../components/Illustrations';
import { Carregando, ErroEstado } from '../components/EmptyState';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Solto = Record<string, any>;

const ESTILO = `
@page { size: A4; margin: 14mm; }
.laudo-folha table { width: 100%; border-collapse: collapse; font-size: 13px; }
.laudo-folha th { text-align: left; font-weight: 600; color: #4E473D; border-bottom: 1.5px solid #1E1B16; padding: 6px 8px; white-space: nowrap; }
.laudo-folha td { border-bottom: 1px solid #E2DACD; padding: 6px 8px; vertical-align: top; }
@media print {
  html, body, #root { background: #fff !important; background-image: none !important; }
  .laudo-barra { display: none !important; }
  .laudo-fundo { background: #fff !important; padding: 0 !important; min-height: 0 !important; }
  .laudo-folha { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; max-width: none !important; padding: 0 !important; margin: 0 !important; }
  .laudo-folha tr, .laudo-bloco { break-inside: avoid; page-break-inside: avoid; }
  .laudo-folha thead { display: table-header-group; }
  .laudo-folha .laudo-rolagem { overflow: visible !important; }
  .laudo-folha * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const nomeDe = (x: unknown): string | null => (x == null ? null : typeof x === 'string' ? x : (x as Solto).nome ?? (x as Solto).razaoSocial ?? null);
const casasDe = (...v: unknown[]) => Math.max(2, ...v.map((t) => String(t ?? '').split('.')[1]?.length ?? 0));
const sinal = (v: unknown, c: number) => `${Number(v ?? 0) < 0 ? '−' : '+'}${num(Math.abs(Number(v ?? 0)), c)}`;
const ehNumero = (v: unknown) => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v));

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="laudo-bloco flex flex-col gap-2">
      <h2 className="m-0 text-[15px] font-bold text-[#235C8F]">{titulo}</h2>
      {children}
    </section>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col min-w-0">
      <dt className="text-[11.5px] text-[#6E6557]">{rotulo}</dt>
      <dd className="m-0 text-[14px] break-words">{children ?? '—'}</dd>
    </div>
  );
}

export default function Laudo() {
  const { id } = useParams();
  const { usuario } = useAuth();
  const q = useQuery({ queryKey: ['ordens-servico', id, 'laudo'], queryFn: () => api<Solto>(`/ordens-servico/${id}/laudo`), enabled: !!id });

  useEffect(() => {
    const el = document.documentElement;
    const anterior = el.dataset.theme;
    el.dataset.theme = 'claro';
    return () => {
      if (anterior) el.dataset.theme = anterior;
      else delete el.dataset.theme;
    };
  }, []);

  const r = q.data ?? {};
  const os: Solto = r.os ?? r.ordemServico ?? r;
  useEffect(() => {
    document.title = os.numero ? `Laudo ${os.numero} · ProMEC` : 'Laudo de inspeção · ProMEC';
  }, [os.numero]);

  const barra = (
    <div className="laudo-barra w-full max-w-[210mm] flex flex-wrap items-center justify-between gap-2">
      <Link to={id ? `/ordens-servico/${id}` : '/ordens-servico'} className={classeBotao('secundario')}>
        <ArrowLeft className="size-[18px]" aria-hidden /> Voltar para a OS
      </Link>
      <Button variante="primario" icone={Printer} onClick={() => window.print()} disabled={!q.data}>Imprimir</Button>
    </div>
  );

  if (q.isLoading || q.isError) {
    return (
      <div className="laudo-fundo min-h-screen bg-surface-3 px-4 py-6 flex flex-col items-center gap-4">
        {barra}
        <div className="w-full max-w-[210mm] bg-white rounded-[12px] shadow-2">
          {q.isLoading ? <Carregando linhas={8} rotulo="Montando o laudo" /> : <ErroEstado erro={q.error} tentar={() => q.refetch()} />}
        </div>
      </div>
    );
  }

  const cliente: Solto = r.cliente ?? os.cliente ?? {};
  const inspecao: Solto | null = r.inspecao ?? (Array.isArray(r.inspecoes) ? r.inspecoes.at(-1) : null) ?? (Array.isArray(os.inspecoes) ? os.inspecoes.at(-1) : null) ?? null;
  const medicoes: Solto[] = (Array.isArray(inspecao?.medicoes) ? inspecao.medicoes : Array.isArray(inspecao?.itens) ? inspecao.itens : Array.isArray(r.medicoes) ? r.medicoes : []) as Solto[];
  const lotes: Solto[] = Array.isArray(r.lotes) ? r.lotes : [];
  const certificadosSoltos: Solto[] = Array.isArray(r.certificados) ? r.certificados.filter((c: Solto) => !lotes.some((l) => (l.certificado ?? l.lote?.certificado)?.numero === c.numero)) : [];
  const termo = r.termoGarantia ?? r.termo ?? r.garantia;
  const textoTermo: string | null = typeof termo === 'string' ? termo : termo?.texto ?? null;
  const diasGarantia = typeof termo === 'object' ? termo?.dias ?? termo?.garantiaDias : r.garantiaDias;
  const validade = typeof termo === 'object' ? termo?.validoAte ?? termo?.validaAte ?? termo?.validade : null;
  const empresa = nomeDe(r.empresa) ?? r.nomeEmpresa ?? usuario?.empresa?.nome ?? '';
  const emissao = r.emitidoEm ?? r.data ?? inspecao?.data ?? inspecao?.criadaEm ?? new Date().toISOString();
  const aprovada: boolean | null = inspecao ? inspecao.aprovada ?? (medicoes.length ? medicoes.every((m) => m.conforme !== false) : null) : r.aprovada ?? null;
  const obj: Solto = os.objeto ?? {};
  const inspetor = nomeDe(inspecao?.inspetor) ?? inspecao?.inspetorNome ?? null;

  return (
    <div className="laudo-fundo min-h-screen bg-surface-3 px-3 sm:px-4 py-6 flex flex-col items-center gap-4">
      <style>{ESTILO}</style>
      {barra}
      <article className="laudo-folha w-full max-w-[210mm] min-w-0 bg-white text-[#1E1B16] rounded-[12px] shadow-2 border border-[#E2DACD] px-5 py-6 sm:px-[14mm] sm:py-[12mm] flex flex-col gap-6" aria-label="Laudo de inspeção">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <LogoProMEC className="size-11" />
              <div className="flex flex-col min-w-0">
                <span className="font-display text-[22px] font-bold leading-none">ProMEC</span>
                {empresa && <span className="text-[13px] text-[#4E473D] break-words">{empresa}</span>}
              </div>
            </div>
            <div className="flex flex-col sm:items-end">
              <h1 className="m-0 font-display text-[26px] font-bold leading-tight">Laudo de inspeção</h1>
              <span className="text-[13px] text-[#4E473D]">
                <span className="mono font-semibold">{os.numero ?? '—'}</span> · emitido em <span className="mono">{data(emissao)}</span>
              </span>
            </div>
          </div>
          <div className="flex h-[5px] rounded-full overflow-hidden" aria-hidden>
            <span className="flex-1 bg-[#235C8F]" />
            <span className="w-14 bg-[#E35D14]" />
          </div>
        </header>

        <Secao titulo="Cliente e peça">
          <dl className="m-0 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
            <Dado rotulo="Cliente">{nomeDe(cliente)}</Dado>
            {cliente.documento && <Dado rotulo="CNPJ/CPF"><span className="mono">{mascaraDocumento(String(cliente.documento).replace(/\D/g, '').length > 11 ? 'PJ' : 'PF', String(cliente.documento))}</span></Dado>}
            <Dado rotulo="Serviço">{os.titulo}</Dado>
            {os.segmento && <Dado rotulo="Segmento">{SEGMENTO[os.segmento as Segmento] ?? os.segmento}</Dado>}
            {os.lote != null && <Dado rotulo="Quantidade"><span className="mono">{num(os.lote, 0)}</span> {Number(os.lote) === 1 ? 'peça' : 'peças'}</Dado>}
            {obj.desenho && <Dado rotulo="Desenho"><span className="mono">{obj.desenho}{obj.revisao ? ` rev. ${obj.revisao}` : ''}</span></Dado>}
            {obj.material && <Dado rotulo="Material">{obj.material}</Dado>}
            {obj.veiculo && <Dado rotulo="Veículo">{obj.veiculo}</Dado>}
            {obj.placa && <Dado rotulo="Placa"><span className="mono">{String(obj.placa).toUpperCase()}</span></Dado>}
            {obj.projeto && <Dado rotulo="Projeto">{obj.projeto}</Dado>}
            {(os.entregueEm ?? os.dataEntrega) && <Dado rotulo="Entrega"><span className="mono">{data(os.entregueEm ?? os.dataEntrega)}</span></Dado>}
          </dl>
        </Secao>

        <Secao titulo="Resultado">
          {aprovada === null ? (
            <p className="m-0 text-[15px] text-[#4E473D]">Esta OS ainda não tem inspeção registrada. Registre a inspeção na OS antes de entregar o laudo ao cliente.</p>
          ) : (
            <div className={`rounded-[10px] border-2 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 ${aprovada ? 'border-[#0F7A55] bg-[#DDF3E9]' : 'border-[#C0352B] bg-[#FBE2DF]'}`}>
              <strong className={`font-display text-[30px] leading-none ${aprovada ? 'text-[#0F7A55]' : 'text-[#C0352B]'}`}>{aprovada ? 'Aprovada' : 'Reprovada'}</strong>
              <span className="text-[13.5px]">
                <span className="mono">{medicoes.filter((m) => m.conforme !== false).length}</span> de <span className="mono">{medicoes.length}</span> itens conformes
                {inspecao?.planoVersao != null && <> · plano v<span className="mono">{inspecao.planoVersao}</span></>}
              </span>
            </div>
          )}
          {inspecao?.observacao && <p className="m-0 text-[13.5px]">Observação: {inspecao.observacao}</p>}
        </Secao>

        {medicoes.length > 0 && (
          <Secao titulo="Medições">
            <div className="laudo-rolagem overflow-x-auto">
              <table>
                <thead>
                  <tr><th scope="col">Característica</th><th scope="col">Especificado</th><th scope="col" style={{ textAlign: 'right' }}>Medido</th><th scope="col">Resultado</th></tr>
                </thead>
                <tbody>
                  {medicoes.map((m, i) => {
                    const c = casasDe(m.nominal, m.tolInferior, m.tolSuperior, m.medido);
                    const un = m.unidade ?? (ehNumero(m.nominal) ? 'mm' : '');
                    return (
                      <tr key={m.id ?? i}>
                        <td>{m.descricao}{m.instrumento && <span className="block text-[11.5px] text-[#6E6557]">{m.instrumento}</span>}</td>
                        <td className="mono whitespace-nowrap">
                          {ehNumero(m.nominal) ? <>{num(m.nominal, c)} <span className="text-[#6E6557]">{sinal(m.tolSuperior, c)}/{sinal(m.tolInferior, c)}</span> {un}</> : m.esperado ?? '—'}
                        </td>
                        <td className="mono whitespace-nowrap" style={{ textAlign: 'right' }}>{ehNumero(m.medido) ? `${num(m.medido, c)}${un ? ` ${un}` : ''}` : m.medido ?? '—'}</td>
                        <td className={`font-semibold whitespace-nowrap ${m.conforme === false ? 'text-[#C0352B]' : 'text-[#0F7A55]'}`}>{m.conforme === false ? 'Não conforme' : m.conforme ? 'Conforme' : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Secao>
        )}

        {(lotes.length > 0 || certificadosSoltos.length > 0) && (
          <Secao titulo="Lotes e certificados de material">
            <div className="laudo-rolagem overflow-x-auto">
              <table>
                <thead>
                  <tr><th scope="col">Lote</th><th scope="col">Material</th><th scope="col">Fornecedor</th><th scope="col">Certificado</th><th scope="col">Corrida</th><th scope="col">Norma</th></tr>
                </thead>
                <tbody>
                  {lotes.map((l, i) => {
                    const lote: Solto = l.lote ?? l;
                    const cert: Solto = l.certificado ?? lote.certificado ?? {};
                    return (
                      <tr key={lote.id ?? i}>
                        <td className="mono">{lote.codigo ?? '—'}</td>
                        <td>{nomeDe(l.item) ?? l.item?.descricao ?? l.descricao ?? '—'}</td>
                        <td>{nomeDe(l.fornecedor ?? lote.fornecedor) ?? '—'}</td>
                        <td className="mono">{cert.numero ?? '—'}</td>
                        <td className="mono">{cert.corrida ?? '—'}</td>
                        <td>{cert.norma ?? '—'}</td>
                      </tr>
                    );
                  })}
                  {certificadosSoltos.map((c, i) => (
                    <tr key={`c${i}`}>
                      <td className="mono">{c.lote?.codigo ?? c.loteCodigo ?? '—'}</td>
                      <td>{c.material ?? c.descricao ?? '—'}</td>
                      <td>{nomeDe(c.fornecedor) ?? '—'}</td>
                      <td className="mono">{c.numero ?? '—'}</td>
                      <td className="mono">{c.corrida ?? '—'}</td>
                      <td>{c.norma ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Secao>
        )}

        <Secao titulo="Termo de garantia">
          <p className="m-0 text-[13.5px] leading-relaxed whitespace-pre-line">
            {textoTermo ?? (diasGarantia ? `Garantia de ${diasGarantia} dias a partir da entrega, nas condições combinadas no orçamento.` : 'Garantia nas condições combinadas no orçamento.')}
          </p>
          {validade && <p className="m-0 text-[13px] text-[#4E473D]">Válida até <span className="mono">{data(validade)}</span>.</p>}
        </Secao>

        <section className="laudo-bloco grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8 pt-8">
          {[
            ['Inspetor responsável', inspetor],
            ['Recebido por (cliente)', os.recebidoPor ?? null]
          ].map(([rotulo, nome]) => (
            <div key={rotulo} className="flex flex-col gap-1">
              <span className="h-10 border-b border-[#1E1B16]" aria-hidden />
              <span className="text-[13px]">{nome ?? ' '}</span>
              <span className="text-[11.5px] text-[#6E6557]">{rotulo}</span>
            </div>
          ))}
        </section>
      </article>
    </div>
  );
}
