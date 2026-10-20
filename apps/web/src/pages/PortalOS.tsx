import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, FileCheck2, Mail, Receipt } from 'lucide-react';
import { Button, classeBotao } from '../components/Button';
import { TextArea } from '../components/Field';
import { Illustration } from '../components/Illustrations';
import { Pill, type Tom } from '../components/Pill';
import { ilustracaoSegmento, PlacaMercosul } from '../features/os/componentes';
import { Avatar, CarregandoPortal, EstadoPortal, FundoPortal } from '../features/portal/Composicao';
import { ErroPortal, etapasOS, faixaNps, nomeDe, portal, primeiroNome, repetirConsulta, useTemaClaro, type Etapa, type FaixaNps, type Solto } from '../features/portal/portal';
import { brl, data, iniciais, num, toNum } from '../lib/format';

const STATUS_PLANO: Record<string, string> = {
  ABERTA: 'Pedido aprovado',
  APROVADA: 'Pedido aprovado',
  PLANEJADA: 'Preparando o material',
  MATERIAL_SEPARADO: 'Material separado',
  EM_EXECUCAO: 'Na máquina agora',
  EM_PRODUCAO: 'Na máquina agora',
  PAUSADA: 'Aguardando a próxima etapa',
  INSPECAO: 'Em inspeção de qualidade',
  EM_INSPECAO: 'Em inspeção de qualidade',
  PRONTA: 'Pronto para entrega',
  CONCLUIDA: 'Pronto para entrega',
  ENTREGUE: 'Entregue',
  FATURADA: 'Entregue',
  CANCELADA: 'Pedido cancelado'
};
const FINAIS = ['ENTREGUE', 'FATURADA', 'ENCERRADA'];

const tomTitulo = (s: string): [string, Tom] => {
  const u = s.toUpperCase();
  if (/PAG|QUIT|BAIX/.test(u)) return ['Pago', 'ok'];
  if (/VENC|ATRAS/.test(u)) return ['Vencido', 'warn'];
  if (/CANC/.test(u)) return ['Cancelado', 'neutral'];
  return ['A vencer', 'info'];
};

const CORES_NPS: Record<FaixaNps, string> = { detrator: 'var(--pm-bad)', neutro: 'var(--pm-warn)', promotor: 'var(--pm-ok)' };

function Linha({ etapas }: { etapas: Etapa[] }) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const ultimo = etapas.reduce((a, e, i) => (e.estado !== 'futura' ? i : a), 0);
  const fracao = etapas.length > 1 ? ultimo / (etapas.length - 1) : 1;
  return (
    <ol className="relative m-0 p-0 list-none flex flex-col">
      <span className="absolute left-[15px] top-4 bottom-[34px] w-[3px] rounded-full bg-border" aria-hidden />
      <span
        className="absolute left-[15px] top-4 w-[3px] rounded-full bg-ok origin-top transition-transform duration-[1200ms] ease-promec"
        style={{ height: `calc((100% - 50px) * ${fracao})`, transform: `scaleY(${pronto ? 1 : 0})` }}
        aria-hidden
      />
      {etapas.map((e, i) => (
        <li key={e.chave} className="relative grid grid-cols-[34px_minmax(0,1fr)] gap-3 pb-[18px] anim-subir" style={{ animationDelay: `${0.1 + i * 0.12}s` }} aria-current={e.estado === 'atual' ? 'step' : undefined}>
          <span
            className={`relative z-[1] size-8 rounded-full grid place-items-center ${
              e.estado === 'feita' ? 'bg-ok text-white' : e.estado === 'atual' ? 'bg-primary text-white' : 'bg-surface-1 border-2 border-border-strong text-ink-3'
            }`}
          >
            {e.estado === 'atual' && <span className="absolute inset-[-5px] rounded-full border-2 border-primary anim-pulsar" aria-hidden />}
            {e.estado === 'feita' ? <Check className="size-4" strokeWidth={2.4} aria-hidden /> : <span className="mono text-[12px] font-semibold">{i + 1}</span>}
          </span>
          <span className="flex flex-col pt-1">
            <span className={`text-[15px] ${e.estado === 'futura' ? 'text-ink-3' : 'font-semibold text-ink-1'}`}>{e.rotulo}</span>
            <span className="text-[13px] text-ink-3">
              {e.data ? <span className="mono">{data(e.data)}</span> : e.estado === 'atual' ? 'Acontecendo agora' : e.estado === 'feita' ? 'Feito' : 'Próxima etapa'}
              <span className="sr-only">{e.estado === 'feita' ? ', concluída' : e.estado === 'atual' ? ', em andamento' : ', pendente'}</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Anel({ prontas, total }: { prontas: number; total: number }) {
  const c = 2 * Math.PI * 26;
  const f = total > 0 ? Math.min(1, prontas / total) : 0;
  return (
    <svg viewBox="0 0 64 64" className="size-16 flex-none" aria-hidden>
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={8} />
      <circle cx="32" cy="32" r="26" fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${f * c} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={total >= 100 ? 11 : 14} fontWeight={600} fill="#fff">
        {prontas}/{total}
      </text>
    </svg>
  );
}

function Avaliacao({ token, inicial }: { token: string; inicial: Solto | null }) {
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const m = useMutation({ mutationFn: () => portal.avaliar(token, nota!, comentario.trim()) });
  const jaAvaliou = m.error instanceof ErroPortal && m.error.status === 409;
  if (inicial || m.isSuccess || jaAvaliou) {
    const n = inicial?.nota ?? nota;
    return (
      <section className="card anim-subir p-5 flex gap-3.5 items-start" role="status">
        <span className="size-10 rounded-full bg-ok-soft text-ok grid place-items-center flex-none">
          <Check className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[17px] font-semibold">Obrigado pela sua avaliação!</h2>
          <p className="m-0 text-ink-2 text-[14.5px]">
            {n != null ? <>Você deu nota <strong className="mono text-ink-1">{n}</strong>. </> : null}
            Sua opinião ajuda a gente a melhorar a cada pedido.
          </p>
        </div>
      </section>
    );
  }
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (nota != null) m.mutate();
  };
  return (
    <section className="card anim-subir p-5" aria-labelledby="pos-nps">
      <form onSubmit={enviar} className="flex flex-col gap-3.5">
        <fieldset className="m-0 p-0 border-0 flex flex-col gap-2.5">
          <legend id="pos-nps" className="text-[17px] font-semibold mb-1">
            De 0 a 10, quanto você indicaria a gente para um amigo ou colega?
          </legend>
          <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5" role="radiogroup" aria-labelledby="pos-nps">
            {Array.from({ length: 11 }, (_, n) => {
              const on = nota === n;
              const cor = CORES_NPS[faixaNps(n)];
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`Nota ${n}`}
                  onClick={() => setNota(n)}
                  className="mono h-11 rounded-control border-2 font-semibold transition duration-micro"
                  style={on ? { background: cor, borderColor: cor, color: '#fff' } : { borderColor: cor, color: 'var(--pm-text-1)', background: 'var(--pm-surface-1)' }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <span className="flex justify-between text-[12.5px] text-ink-3" aria-hidden>
            <span>Nada provável</span>
            <span>Com certeza</span>
          </span>
        </fieldset>
        {nota != null && <TextArea label={nota <= 6 ? 'O que podemos fazer melhor? (opcional)' : 'Quer deixar um comentário? (opcional)'} value={comentario} onChange={setComentario} rows={3} />}
        {m.isError && !jaAvaliou && (
          <p className="m-0 text-bad font-medium text-[14px]" role="alert">
            {m.error instanceof ErroPortal ? m.error.message : 'Não conseguimos enviar agora. Tente de novo.'}
          </p>
        )}
        <Button type="submit" variante="secundario" tamanho="lg" disabled={nota == null} carregando={m.isPending} className="w-full">
          Enviar avaliação
        </Button>
      </form>
    </section>
  );
}

export default function PortalOS() {
  const { token = '' } = useParams();
  useTemaClaro();
  const q = useQuery({ queryKey: ['portal', 'os', token], queryFn: () => portal.os(token), retry: repetirConsulta, enabled: !!token });
  const r: Solto = q.data ?? {};
  const empresa = nomeDe(r.empresa) || 'Sua oficina';
  useEffect(() => {
    document.title = r.numero ? `${r.numero} · ${empresa}` : 'Acompanhe seu pedido';
  }, [r.numero, empresa]);

  if (q.isPending && token) return <CarregandoPortal />;
  if (q.isError || !token) return <EstadoPortal erro={q.error ?? new ErroPortal(401, '', 'LINK_INVALIDO')} onTentar={() => q.refetch()} />;

  const etapas = etapasOS(r);
  const codigo = String(r.status?.codigo ?? r.statusCodigo ?? (typeof r.status === 'string' ? r.status : '')).toUpperCase();
  const entregue = r.entregue === true || !!r.entregueEm || FINAIS.includes(codigo) || etapas[etapas.length - 1]?.estado === 'feita';
  const cancelada = codigo === 'CANCELADA';
  const statusTexto =
    r.situacao ?? r.statusTexto ?? r.status?.texto ?? (typeof r.status === 'string' && !/^[A-Z_]+$/.test(r.status) ? r.status : STATUS_PLANO[codigo]) ?? etapas.find((e) => e.estado === 'atual')?.rotulo ?? 'Em andamento';
  const titulo = String(r.titulo ?? r.descricao ?? 'suas peças');
  const lote = toNum(r.lote?.quantidade ?? r.lote ?? r.pecas?.lote ?? r.pecas?.total);
  const prontas = toNum(r.pecasProntas ?? r.pecas?.prontas);
  const prazo = r.prazo?.data ?? r.prazo ?? r.prazoEntrega;
  const noPrazo = r.noPrazo ?? r.prazo?.noPrazo;
  const resp: Solto = r.responsavel ?? {};
  const respNome = primeiroNome(resp);
  const funcao = resp.funcao ?? resp.cargo;
  const titulos: Solto[] = Array.isArray(r.titulos) ? r.titulos : [];
  const laudoUrl = r.laudo?.url ?? r.laudoUrl ?? (typeof r.laudo === 'string' && /^https?:|^\//.test(r.laudo) ? r.laudo : null);
  const placa = r.objeto?.placa ?? r.placa;
  const segmento = String(r.segmento ?? r.empresa?.segmento ?? (placa ? 'OFICINA' : 'USINAGEM')).toUpperCase() as keyof typeof ilustracaoSegmento;

  const manchete = entregue ? `Seu pedido foi entregue` : cancelada ? 'Este pedido foi cancelado' : statusTexto;
  const fraseprazo = entregue
    ? r.dataEntrega
      ? `Entregue em ${data(r.dataEntrega)}. Obrigado pela confiança!`
      : 'Obrigado pela confiança!'
    : prazo
      ? noPrazo === false
        ? `Tivemos um atraso e estamos correndo para recuperar. A nova previsão é ${data(prazo)}.`
        : `Tudo dentro do prazo. A previsão de entrega é ${data(prazo)}.`
      : 'Avisamos você assim que tivermos a data de entrega.';

  return (
    <FundoPortal>
      <header className="relative overflow-hidden text-white px-5 pt-5 pb-7" style={{ background: 'linear-gradient(150deg, #F08A3E 0%, #E35D14 38%, #1D4E7A 100%)' }}>
        <Illustration tipo={ilustracaoSegmento[segmento] ?? 'torno'} className="absolute -right-24 top-16 w-[380px] h-auto pointer-events-none" />
        <div className="relative flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="size-9 rounded-[11px] glass-dark grid place-items-center font-display font-bold text-sm flex-none" aria-hidden>
              {iniciais(empresa)}
            </span>
            <span className="font-semibold truncate">{empresa}</span>
          </span>
          {r.numero && <span className="mono text-[12.5px] text-[#FFE2C8] flex-none">{r.numero}</span>}
        </div>
        <div className="relative mt-6 flex flex-col gap-2">
          <span className="inline-flex self-start items-center gap-2 h-7 px-3 rounded-full bg-white/20 text-[13px] font-semibold">
            <span className={`size-2 rounded-full bg-[#FFE2A8] ${entregue || cancelada ? '' : 'anim-pulsar'}`} aria-hidden />
            {statusTexto}
          </span>
          <h1 className="m-0 font-display text-[38px] font-bold leading-none">{manchete}</h1>
          <p className="m-0 text-[15px] text-[#FFE9D8]">{fraseprazo}</p>
          {!entregue && prazo && noPrazo != null && (
            <span className="self-start">
              <Pill tom={noPrazo ? 'ok' : 'warn'}>{noPrazo ? 'No prazo' : 'Atrasado'}</Pill>
            </span>
          )}
        </div>
        {lote > 0 && (
          <div className="glass-dark relative mt-5 rounded-[22px] px-4 py-3.5 flex items-center gap-3.5">
            <Anel prontas={prontas} total={lote} />
            <span className="flex flex-col">
              <span className="font-semibold">
                <span className="mono">{num(prontas, 0)}</span> de <span className="mono">{num(lote, 0)}</span> {lote === 1 ? 'peça pronta' : 'peças prontas'}
              </span>
              <span className="text-[13px] text-[#FFE9D8]">{prontas >= lote ? 'Lote completo' : `Produzindo ${titulo.toLowerCase()}`}</span>
            </span>
          </div>
        )}
      </header>

      <main className="px-4 pt-[18px] pb-12 flex flex-col gap-3.5">
        {placa && (
          <section className="card anim-subir p-4 flex items-center gap-3.5">
            <PlacaMercosul placa={String(placa)} />
            <span className="text-[14px] text-ink-2 min-w-0">{nomeDe(r.objeto?.veiculo ?? r.veiculo) || String(r.objeto?.veiculo ?? r.veiculo ?? titulo)}</span>
          </section>
        )}

        <section className="card anim-subir p-5" aria-labelledby="pos-tl">
          <h2 id="pos-tl" className="m-0 mb-3.5 text-[17px] font-semibold">
            Por onde seu pedido passou
          </h2>
          <Linha etapas={etapas} />
        </section>

        {entregue && (
          <section className="card anim-subir p-5 flex gap-3.5 items-center" aria-label="Laudo de inspeção">
            <span className="size-10 rounded-control bg-ok-soft text-ok grid place-items-center flex-none">
              {laudoUrl ? <FileCheck2 className="size-5" aria-hidden /> : <Mail className="size-5" aria-hidden />}
            </span>
            <span className="flex-1 text-[14.5px] text-ink-2">
              {laudoUrl ? 'O laudo de inspeção das suas peças está disponível.' : 'O laudo de inspeção das suas peças foi enviado para o seu e-mail.'}
            </span>
            {laudoUrl && (
              <a href={laudoUrl} target="_blank" rel="noopener noreferrer" className={classeBotao('secundario', 'md', 'flex-none')}>
                Ver laudo
              </a>
            )}
          </section>
        )}

        <section className="card anim-subir p-5 flex flex-col gap-2.5" style={{ animationDelay: '.1s' }} aria-labelledby="pos-bo">
          <h2 id="pos-bo" className="m-0 text-[17px] font-semibold">
            Boletos
          </h2>
          {titulos.length ? (
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {titulos.map((t, i) => {
                const [rot, tom] = tomTitulo(String(t.status ?? ''));
                const url = t.url ?? t.boletoUrl ?? t.segundaVia;
                return (
                  <li key={t.numero ?? i} className="flex items-center gap-3 p-3 rounded-field bg-surface-2 border border-border">
                    <span className="size-[38px] rounded-control bg-surface-3 text-ink-2 grid place-items-center flex-none">
                      <Receipt className="size-[18px]" aria-hidden />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col leading-snug">
                      <span className="mono text-[14px] font-semibold truncate">{t.numero ?? `Parcela ${i + 1}`}</span>
                      <span className="text-[12.5px] text-ink-3">
                        vence <span className="mono">{data(t.vencimento)}</span> · <span className="mono">{brl(t.valor)}</span>
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1.5 flex-none">
                      <Pill tom={tom}>{rot}</Pill>
                      {url && rot !== 'Pago' && (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-primary-text underline underline-offset-2 min-h-[24px]">
                          2ª via
                        </a>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="m-0 text-[14px] text-ink-3">Os boletos deste pedido chegam no seu e-mail no dia da entrega.</p>
          )}
        </section>

        {respNome && (
          <section className="flex items-center gap-3 px-1 py-1" aria-label="Responsável">
            <Avatar nome={nomeDe(resp)} />
            <span className="flex-1 text-[14px] text-ink-2">
              Quem está cuidando {entregue ? 'do seu pedido' : 'das suas peças'}: <strong className="text-ink-1">{respNome}</strong>
              {funcao ? `, ${String(funcao).toLowerCase()}` : ''}.
            </span>
          </section>
        )}

        {entregue && <Avaliacao token={token} inicial={r.avaliacao ?? null} />}
      </main>
    </FundoPortal>
  );
}
