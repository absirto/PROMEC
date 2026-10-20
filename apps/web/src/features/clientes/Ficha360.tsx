import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { brl, data, pct } from '../../lib/format';
import type { StatusOrcamento } from '../../lib/types';
import { Card, CardHeader } from '../../components/Card';
import { Abas } from '../../components/Abas';
import { Pill, StatusOrcamentoPill } from '../../components/Pill';
import { Carregando, ErroEstado } from '../../components/EmptyState';
import { PlacaMercosul } from '../os/componentes';

interface Ref { id: string; nome: string }
interface TituloF { id: string; numero: string; descricao?: string | null; vencimento: string; saldo: string; diasAtraso: number }
export interface Ficha {
  resumo: { orcamentos: number; taxaConversao: string | null; valorAprovado12m: string; margemMedia: string | null; ticketMedio: string | null; ultimaInteracao: string | null; nps?: { media: string; respostas: number } | null };
  orcamentos: { id: string; numero: string; titulo: string; status: StatusOrcamento; precoFinalLote: string | null; validade?: string | null; atualizadoEm: string }[];
  os: { id: string; numero: string; titulo: string; status: string; prazo?: string | null; entregueEm?: string | null }[];
  titulos: { abertos: TituloF[]; vencidos: TituloF[] };
  veiculos: { placa: string; veiculo?: string | null; ultimaOs?: string | null }[];
  ncs: { id: string; numero: string; status: string; descricao: string; os?: string | null }[];
  garantias: { id: string; numero: string; status: string; relato: string; os?: string | null }[];
  atividades: { id: string; tipo: string; assunto: string; data: string; concluida: boolean; resultado?: string | null; responsavel?: Ref | null }[];
  oportunidades: { id: string; titulo: string; etapa: string; valorEstimado: string; responsavel?: Ref | null }[];
  mensagens: { id: string; canal: string; assunto?: string | null; corpo?: string | null; data: string }[];
  avaliacoes?: { os?: string | null; nota: number; comentario?: string | null; data: string }[];
}

type Aba = 'comercial' | 'producao' | 'financeiro' | 'relacionamento';
const ETAPA: Record<string, string> = { LEAD: 'Lead', CONTATO: 'Contato', ORCAMENTO_ENVIADO: 'Orçamento enviado', NEGOCIACAO: 'Negociação', GANHO: 'Ganho', PERDIDO: 'Perdido' };
const CANAL: Record<string, string> = { EMAIL: 'E-mail', WHATSAPP: 'WhatsApp', PORTAL: 'Portal', SISTEMA: 'Sistema' };

function Lista({ titulo, vazio, children, n }: { titulo: string; vazio: string; children: ReactNode; n: number }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <h3 className="m-0 text-[15px] font-semibold">{titulo} <span className="text-ink-3 font-normal mono">{n}</span></h3>
      {n === 0 ? <p className="m-0 text-[14px] text-ink-3">{vazio}</p> : <ul className="m-0 p-0 list-none flex flex-col">{children}</ul>}
    </div>
  );
}
function Kpi({ rotulo, valor, sub, tom }: { rotulo: string; valor: ReactNode; sub?: ReactNode; tom?: 'ok' | 'bad' | 'steel' }) {
  return (
    <div className="p-3 rounded-[16px] bg-surface-1 border border-border min-w-0">
      <span className="block text-caption text-ink-3">{rotulo}</span>
      <span className={`mono block text-[16px] sm:text-[20px] font-bold whitespace-nowrap ${tom === 'ok' ? 'text-ok' : tom === 'bad' ? 'text-bad' : ''}`}>{valor}</span>
      {sub && <span className="block text-[12.5px] text-ink-3">{sub}</span>}
    </div>
  );
}
const li = 'flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-t border-border first:border-0 text-[14px] min-w-0';

/** Ficha 360° do cliente: comercial, produção, financeiro e relacionamento num lugar só. */
export function Ficha360({ clienteId }: { clienteId: string }) {
  const q = useQuery({ queryKey: ['clientes', clienteId, 'ficha'], queryFn: () => api<Ficha>(`/clientes/${clienteId}/ficha`) });
  const [aba, setAba] = useState<Aba>('comercial');
  if (q.isLoading) return <Card className="p-5"><Carregando linhas={4} /></Card>;
  if (q.isError || !q.data) return <Card className="p-5"><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  const f = q.data;
  const r = f.resumo;
  const devido = f.titulos.abertos.reduce((a, t) => a + Number(t.saldo), 0);
  return (
    <Card className="p-5 flex flex-col gap-4" aria-labelledby="h-ficha">
      <CardHeader id="h-ficha" titulo="Ficha 360°" sub={r.ultimaInteracao ? `Última interação em ${data(r.ultimaInteracao)}.` : 'Nenhuma interação registrada ainda.'} />
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
        <Kpi rotulo="Aprovado em 12 meses" valor={brl(r.valorAprovado12m)} tom="ok" />
        <Kpi rotulo="Conversão" valor={r.taxaConversao != null ? pct(r.taxaConversao, 0) : '—'} sub={`${r.orcamentos} ${r.orcamentos === 1 ? 'orçamento' : 'orçamentos'}`} />
        <Kpi rotulo="Ticket médio" valor={r.ticketMedio != null ? brl(r.ticketMedio) : '—'} />
        <Kpi rotulo="Margem média" valor={r.margemMedia != null ? pct(r.margemMedia) : '—'} />
        <Kpi rotulo="Em aberto" valor={brl(devido)} tom={f.titulos.vencidos.length ? 'bad' : 'steel'} sub={f.titulos.vencidos.length ? `${f.titulos.vencidos.length} vencido${f.titulos.vencidos.length > 1 ? 's' : ''}` : 'nada vencido'} />
        {r.nps && <Kpi rotulo="Nota média" valor={`${r.nps.media.replace('.', ',')} / 10`} sub={`${r.nps.respostas} ${r.nps.respostas === 1 ? 'resposta' : 'respostas'}`} />}
      </div>
      <Abas<Aba> rotulo="Partes da ficha" valor={aba} onChange={setAba} abas={[
        { valor: 'comercial', rotulo: 'Comercial', n: f.orcamentos.length + f.oportunidades.length },
        { valor: 'producao', rotulo: 'Produção', n: f.os.length },
        { valor: 'financeiro', rotulo: 'Financeiro', n: f.titulos.abertos.length },
        { valor: 'relacionamento', rotulo: 'Relacionamento', n: f.atividades.length + f.mensagens.length }
      ]} />
      <div role="tabpanel" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-5">
        {aba === 'comercial' && (
          <>
            <Lista titulo="Orçamentos" n={f.orcamentos.length} vazio="Nenhum orçamento ainda.">
              {f.orcamentos.slice(0, 12).map((o) => (
                <li key={o.id} className={li}>
                  <Link to={`/orcamentos/${o.id}`} className="mono text-info">{o.numero}</Link>
                  <span className="flex-1 min-w-[120px] truncate">{o.titulo}</span>
                  <span className="mono">{o.precoFinalLote ? brl(o.precoFinalLote) : '—'}</span>
                  <StatusOrcamentoPill status={o.status} />
                </li>
              ))}
            </Lista>
            <Lista titulo="Oportunidades" n={f.oportunidades.length} vazio="Nenhuma oportunidade no funil.">
              {f.oportunidades.map((o) => (
                <li key={o.id} className={li}>
                  <Link to={`/crm?oportunidade=${o.id}`} className="flex-1 min-w-[120px] truncate text-info">{o.titulo}</Link>
                  <span className="mono">{brl(o.valorEstimado)}</span>
                  <Pill tom={o.etapa === 'GANHO' ? 'ok' : o.etapa === 'PERDIDO' ? 'bad' : 'info'}>{ETAPA[o.etapa] ?? o.etapa}</Pill>
                </li>
              ))}
            </Lista>
          </>
        )}
        {aba === 'producao' && (
          <>
            <Lista titulo="Ordens de serviço" n={f.os.length} vazio="Nenhuma OS ainda.">
              {f.os.slice(0, 12).map((o) => (
                <li key={o.id} className={li}>
                  <Link to={`/ordens-servico/${o.id}`} className="mono text-info">{o.numero}</Link>
                  <span className="flex-1 min-w-[120px] truncate">{o.titulo}</span>
                  <span className="text-ink-2 text-[13px]">{o.entregueEm ? `entregue ${data(o.entregueEm)}` : o.prazo ? `prazo ${data(o.prazo)}` : ''}</span>
                  <Pill>{o.status.replace(/_/g, ' ').toLowerCase()}</Pill>
                </li>
              ))}
            </Lista>
            {f.veiculos.length > 0 && (
              <Lista titulo="Veículos atendidos" n={f.veiculos.length} vazio="">
                {f.veiculos.map((v) => (
                  <li key={v.placa} className={li}><PlacaMercosul placa={v.placa} /><span className="flex-1">{v.veiculo ?? ''}</span>{v.ultimaOs && <span className="mono text-ink-3 text-[13px]">{v.ultimaOs}</span>}</li>
                ))}
              </Lista>
            )}
            <Lista titulo="Não conformidades e garantias" n={f.ncs.length + f.garantias.length} vazio="Nenhuma reclamação registrada. Bom sinal.">
              {f.ncs.map((n) => <li key={n.id} className={li}><Link to="/qualidade?aba=ncs" className="mono text-info">{n.numero}</Link><span className="flex-1 min-w-[120px] truncate">{n.descricao}</span><Pill tom={n.status === 'ENCERRADA' ? 'ok' : 'warn'}>{n.status.toLowerCase()}</Pill></li>)}
              {f.garantias.map((g) => <li key={g.id} className={li}><Link to="/qualidade?aba=garantias" className="mono text-info">{g.numero}</Link><span className="flex-1 min-w-[120px] truncate">{g.relato}</span><Pill tom="steel">garantia · {g.status.toLowerCase()}</Pill></li>)}
            </Lista>
          </>
        )}
        {aba === 'financeiro' && (
          <Lista titulo="Títulos em aberto" n={f.titulos.abertos.length} vazio="Nada em aberto.">
            {f.titulos.abertos.map((t) => (
              <li key={t.id} className={li}>
                <Link to={`/financeiro/receber?titulo=${t.id}`} className="mono text-info">{t.numero}</Link>
                <span className="flex-1 min-w-[120px] truncate">{t.descricao ?? ''}</span>
                <span className="mono">{brl(t.saldo)}</span>
                {t.diasAtraso > 0 ? <Pill tom="bad">{t.diasAtraso} {t.diasAtraso === 1 ? 'dia' : 'dias'} de atraso</Pill> : <Pill>vence {data(t.vencimento)}</Pill>}
              </li>
            ))}
          </Lista>
        )}
        {aba === 'relacionamento' && (
          <>
            <Lista titulo="Atividades" n={f.atividades.length} vazio="Nenhuma ligação, visita ou tarefa registrada.">
              {f.atividades.slice(0, 15).map((a) => (
                <li key={a.id} className={li}>
                  <span className="mono text-ink-3 text-[13px] w-[78px]">{data(a.data)}</span>
                  <span className="flex-1 min-w-[140px]">{a.assunto}{a.resultado ? <span className="text-ink-2"> · {a.resultado}</span> : null}</span>
                  <Pill tom={a.concluida ? 'ok' : 'info'}>{a.concluida ? 'feita' : 'pendente'}</Pill>
                </li>
              ))}
            </Lista>
            <Lista titulo="Mensagens enviadas" n={f.mensagens.length} vazio="Nenhuma mensagem enviada pelo sistema.">
              {f.mensagens.slice(0, 15).map((m) => (
                <li key={m.id} className={li}>
                  <span className="mono text-ink-3 text-[13px] w-[78px]">{data(m.data)}</span>
                  <span className="flex-1 min-w-[140px] truncate">{m.assunto ?? m.corpo ?? ''}</span>
                  <Pill tom="steel">{CANAL[m.canal] ?? m.canal}</Pill>
                </li>
              ))}
            </Lista>
            {(f.avaliacoes?.length ?? 0) > 0 && (
              <Lista titulo="Avaliações" n={f.avaliacoes!.length} vazio="">
                {f.avaliacoes!.map((a, i) => (
                  <li key={i} className={li}>
                    <span className={`mono font-bold ${a.nota >= 9 ? 'text-ok' : a.nota >= 7 ? 'text-warn' : 'text-bad'}`}>{a.nota}</span>
                    <span className="flex-1 min-w-[140px]">{a.comentario || 'Sem comentário.'}</span>
                    {a.os && <span className="mono text-ink-3 text-[13px]">{a.os}</span>}
                  </li>
                ))}
              </Lista>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
