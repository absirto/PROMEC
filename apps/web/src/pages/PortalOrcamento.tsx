import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Hourglass, MessageCircle, Phone, Send, TriangleAlert } from 'lucide-react';
import { Button, classeBotao } from '../components/Button';
import { TextArea, TextField } from '../components/Field';
import { Modal } from '../components/Modal';
import { Illustration } from '../components/Illustrations';
import { ilustracaoSegmento, PlacaMercosul } from '../features/os/componentes';
import { Avatar, CarregandoPortal, Composicao, EstadoPortal, FundoPortal } from '../features/portal/Composicao';
import { curvaLote, diasAte, ErroPortal, gruposComposicao, linkWhatsapp, nomeDe, portal, primeiroNome, repetirConsulta, useTemaClaro, type Solto } from '../features/portal/portal';
import { brl, data, iniciais, num, pct, toNum } from '../lib/format';

type Aceite = { nome?: string; data?: string; os?: { numero?: string; prazo?: string; token?: string; url?: string; linkAcompanhamento?: string | null } | null };

/** Link de acompanhamento da OS no mesmo endereço em que o cliente abriu o orçamento. */
const linkOS = (os: Aceite['os']) => {
  const bruto = os?.linkAcompanhamento ?? os?.url ?? (os?.token ? `/portal/os/${os.token}` : null);
  if (!bruto) return null;
  const i = bruto.indexOf('/portal/os/');
  return i >= 0 ? bruto.slice(i) : bruto;
};

const fracao = (v: unknown) => {
  const n = toNum(v as number);
  return n > 1 ? n / 100 : n;
};

const textoPrazo = (p: unknown): [string, string | null] => {
  if (p == null || p === '') return ['A combinar', null];
  if (typeof p === 'number') return [`${p} dias úteis`, null];
  if (typeof p === 'string') return /^\d{4}-\d{2}-\d{2}/.test(p) ? [data(p), null] : [p, null];
  const o = p as Solto;
  const dias = o.dias ?? o.diasUteis;
  const quando = o.data ?? o.dataPrevista;
  if (dias != null) return [`${dias} dias úteis`, quando ? `se aprovar hoje: ${data(quando)}` : null];
  return [quando ? data(quando) : String(o.texto ?? 'A combinar'), null];
};

function DesenhoPeca({ titulo }: { titulo: string }) {
  return (
    <svg viewBox="40 40 290 160" role="img" aria-label={`Desenho de ${titulo}`} className="w-full h-auto block" fill="none" strokeLinecap="round">
      <path d="M84 55h202l4 4v117l-4 4H84l-4-4V59zM80 67.5h210M80 167.5h210" stroke="#fff" strokeWidth={3} />
      <path d="M60 117.5h250" stroke="#FFC08F" strokeWidth={2} strokeDasharray="14 4 3 4" />
      <path
        d="M88 67.5l12-12M112 67.5l12-12M136 67.5l12-12M160 67.5l12-12M184 67.5l12-12M208 67.5l12-12M232 67.5l12-12M256 67.5l12-12M88 180l12-12M112 180l12-12M136 180l12-12M160 180l12-12M184 180l12-12M208 180l12-12M232 180l12-12M256 180l12-12"
        stroke="rgba(255,255,255,.55)"
        strokeWidth={2}
      />
    </svg>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-3 border-t border-border first:border-t-0">
      <dt className="text-ink-2">{rotulo}</dt>
      <dd className="m-0 font-semibold text-right">{children}</dd>
    </div>
  );
}

export default function PortalOrcamento() {
  const { token = '' } = useParams();
  useTemaClaro();
  const q = useQuery({ queryKey: ['portal', 'orcamento', token], queryFn: () => portal.orcamento(token), retry: repetirConsulta, enabled: !!token });
  const [folha, setFolha] = useState<'aprovar' | 'ajuste' | null>(null);
  const [aceite, setAceite] = useState<Aceite | null>(null);
  const [jaAprovado, setJaAprovado] = useState(false);
  const [vencido, setVencido] = useState(false);
  const sucessoRef = useRef<HTMLHeadingElement>(null);

  const r: Solto = q.data ?? {};
  const empresa = nomeDe(r.empresa) || 'Sua oficina';
  useEffect(() => {
    document.title = r.numero ? `Orçamento ${r.numero} · ${empresa}` : 'Seu orçamento';
  }, [r.numero, empresa]);
  useEffect(() => {
    if (aceite) sucessoRef.current?.focus();
  }, [aceite]);

  if (q.isPending && token) return <CarregandoPortal />;
  if (q.isError || !token) return <EstadoPortal erro={q.error ?? new ErroPortal(401, '', 'LINK_INVALIDO')} onTentar={() => q.refetch()} />;

  const status = String(r.status ?? '').toUpperCase();
  const aceiteAtual: Aceite | null = aceite ?? (['APROVADO', 'CONVERTIDO'].includes(status) ? { ...(r.aceite ?? {}), os: r.os ?? r.aceite?.os } : null);
  const validade = r.validade?.data ?? r.validade ?? r.validoAte;
  const dias = r.diasRestantes ?? r.validade?.diasRestantes ?? diasAte(validade);
  const expirado = vencido || status === 'EXPIRADO' || (dias != null && dias < 0);
  const recusado = status === 'RECUSADO';
  const podeAprovar = !aceiteAtual && !expirado && !recusado;

  const contato = primeiroNome(r.contato) || primeiroNome(r.cliente);
  const cliente = nomeDe(r.cliente);
  const titulo = String(r.titulo ?? 'seu pedido');
  const obj: Solto = r.objeto ?? {};
  const placa = obj.placa ?? r.placa;
  const lote = toNum(r.lote?.quantidade ?? r.lote);
  const total = r.precoFinalLote ?? r.precoFinal;
  const unitario = r.precoFinalUnitario;
  const descValor = toNum(r.desconto?.valor ?? r.descontoValor ?? (typeof r.desconto === 'object' ? 0 : r.desconto));
  const descPct = fracao(r.desconto?.percentual ?? r.descontoPercentual);
  const grupos = gruposComposicao(r);
  const curva = curvaLote(r);
  const maxCurva = Math.max(...curva.map((c) => c.unitario), 1);
  const [prazo, prazoObs] = textoPrazo(r.prazoPrometido ?? r.prazo);
  const pagamento = typeof r.condicaoPagamento === 'object' ? nomeDe(r.condicaoPagamento) || r.condicaoPagamento?.descricao : r.condicaoPagamento;
  const vendedor = nomeDe(r.vendedor);
  const telVendedor = r.vendedor?.telefone ?? r.empresa?.telefone;
  const zap = linkWhatsapp(telVendedor, `Olá${vendedor ? `, ${primeiroNome(vendedor)}` : ''}! Tenho uma dúvida sobre o orçamento ${r.numero ?? ''}.`);
  const segmento = String(r.segmento ?? r.empresa?.segmento ?? (placa ? 'OFICINA' : 'USINAGEM')).toUpperCase() as keyof typeof ilustracaoSegmento;

  return (
    <FundoPortal>
      <header className="hero relative overflow-hidden px-5 pt-5 pb-[72px]">
        <Illustration tipo={ilustracaoSegmento[segmento] ?? 'torno'} className="absolute -right-16 bottom-1.5 w-[340px] h-auto pointer-events-none" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {r.empresa?.logo ? (
              <img src={r.empresa.logo} alt="" className="size-9 rounded-[11px] object-cover bg-white flex-none" />
            ) : (
              <span className="size-9 rounded-[11px] bg-primary grid place-items-center font-display font-bold text-sm flex-none" aria-hidden>
                {iniciais(empresa)}
              </span>
            )}
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-semibold truncate">{empresa}</span>
              <span className="text-[12px] text-[#C9D7E6]">Orçamento para você</span>
            </span>
          </div>
          {r.numero && <span className="mono text-[12px] text-[#C9D7E6] flex-none">{r.numero}</span>}
        </div>
        <div className="relative mt-7 flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-[40px] font-bold leading-none">{contato ? `Olá, ${contato}!` : 'Olá!'}</h1>
          <p className="m-0 text-[16px] text-[#D3E0EE] max-w-[300px]">
            {aceiteAtual ? `Seu orçamento de ${titulo.toLowerCase()} está aprovado.` : `Seu orçamento de ${titulo.toLowerCase()} está pronto. Confira com calma e aprove por aqui mesmo.`}
          </p>
        </div>
      </header>

      <main className={`relative -mt-12 px-4 flex flex-col gap-3.5 ${podeAprovar ? 'pb-48' : 'pb-12'}`}>
        {aceiteAtual && (
          <section className="card anim-subir overflow-hidden" aria-live="polite">
            <div className="relative h-[150px] grid place-items-center" style={{ background: 'linear-gradient(150deg, #F08A3E, #E35D14 45%, #1D4E7A)' }}>
              {!jaAprovado && (
                <svg viewBox="0 0 200 150" aria-hidden className="absolute inset-0 size-full">
                  <g stroke="#FFE2A8" strokeWidth={3} strokeLinecap="round" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'subir .5s ease-out both', opacity: 0.8 }}>
                    <path d="M100 75l-40-30M100 75l-46 6M100 75l-22-44M100 75l40-30M100 75l46 6M100 75l22-44M100 75l-30 38M100 75l30 38" />
                  </g>
                </svg>
              )}
              <span className="relative size-[72px] rounded-full bg-white text-ok grid place-items-center shadow-3 anim-subir">
                <Check className="size-9" strokeWidth={2.5} aria-hidden />
              </span>
            </div>
            <div className="p-5 flex flex-col gap-2.5">
              <h2 ref={sucessoRef} tabIndex={-1} className="m-0 font-display text-[30px] font-bold leading-tight outline-none">
                {jaAprovado ? 'Este orçamento já está aprovado' : `Aprovado. Obrigado${aceiteAtual.nome ? `, ${primeiroNome(aceiteAtual.nome)}` : ''}!`}
              </h2>
              <p className="m-0 text-ink-2">
                {aceiteAtual.os?.numero ? (
                  <>
                    Já abrimos a <strong className="mono text-ink-1">{aceiteAtual.os.numero}</strong> e a produção começa a ser preparada.
                    {aceiteAtual.os.prazo && (
                      <>
                        {' '}A previsão de entrega é <strong className="text-ink-1">{data(aceiteAtual.os.prazo)}</strong>.
                      </>
                    )}
                  </>
                ) : (
                  'Já avisamos a equipe e a produção começa a ser preparada.'
                )}
              </p>
              {linkOS(aceiteAtual.os) && (
                <a href={linkOS(aceiteAtual.os)!} className={classeBotao('primario', 'lg', 'w-full')}>
                  Acompanhar a produção
                  <ArrowRight className="size-[18px]" aria-hidden />
                </a>
              )}
              {(aceiteAtual.nome || aceiteAtual.data) && (
                <span className="mono text-[11.5px] text-ink-3 text-center">
                  Aceite registrado{aceiteAtual.nome ? ` · ${aceiteAtual.nome}` : ''}
                  {aceiteAtual.data ? ` · ${data(aceiteAtual.data)} ${aceiteAtual.data.slice(11, 16)}` : ''}
                </span>
              )}
            </div>
          </section>
        )}

        {expirado && !aceiteAtual && (
          <section className="card anim-subir p-5 flex gap-3.5 items-start bg-warn-soft border-transparent" role="status">
            <Hourglass className="size-6 text-warn flex-none mt-0.5" aria-hidden />
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-[17px] font-semibold">A validade deste orçamento terminou</h2>
              <p className="m-0 text-ink-2 text-[14.5px]">Os valores podem ter mudado. {vendedor ? `Fale com ${primeiroNome(vendedor)}` : 'Fale com o vendedor'} e receba uma versão atualizada rapidinho.</p>
            </div>
          </section>
        )}
        {recusado && !aceiteAtual && (
          <section className="card anim-subir p-5 flex gap-3.5 items-start" role="status">
            <TriangleAlert className="size-6 text-ink-3 flex-none mt-0.5" aria-hidden />
            <p className="m-0 text-ink-2">Este orçamento foi encerrado. Se mudou de ideia, é só chamar o vendedor que preparamos outro.</p>
          </section>
        )}

        <section className="card anim-subir p-4 flex gap-3.5 items-center">
          {placa ? (
            <div className="flex-none">
              <PlacaMercosul placa={String(placa)} />
            </div>
          ) : (
            <div className="w-28 flex-none rounded-[14px] p-1.5" style={{ background: 'linear-gradient(135deg, #2A6AA3, #15395A)' }}>
              <DesenhoPeca titulo={titulo} />
            </div>
          )}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-[16px]">{titulo}</span>
            {placa
              ? (obj.veiculo || r.veiculo) && <span className="text-[13.5px] text-ink-2">{nomeDe(obj.veiculo ?? r.veiculo) || String(obj.veiculo ?? r.veiculo)}</span>
              : obj.desenho && (
                  <span className="text-[13.5px] text-ink-2">
                    Desenho <span className="mono">{obj.desenho}</span>
                    {obj.revisao ? ` rev. ${obj.revisao}` : ''}
                  </span>
                )}
            {(obj.material || lote > 0) && (
              <span className="text-[13.5px] text-ink-2">
                {[nomeDe(obj.material) || (typeof obj.material === 'string' ? obj.material : ''), lote > 0 ? `${num(lote, 0)} ${lote === 1 ? 'peça' : 'peças'}` : ''].filter(Boolean).join(' · ')}
              </span>
            )}
            {cliente && <span className="text-[12.5px] text-ink-3 truncate">Para {cliente}</span>}
          </div>
        </section>

        <section className="card anim-subir p-5 flex flex-col gap-1" style={{ animationDelay: '.08s' }} aria-labelledby="po-valor">
          <span id="po-valor" className="text-[14px] text-ink-2">
            Valor total
          </span>
          <span className="mono text-[clamp(38px,11vw,46px)] font-bold tracking-[-.04em] leading-[1.05] break-all">{brl(total)}</span>
          {lote > 1 && unitario != null && (
            <span className="text-[14.5px] text-ink-2">
              {num(lote, 0)} peças · <strong className="mono text-ink-1">{brl(unitario)}</strong> cada
            </span>
          )}
          {descValor > 0 && (
            <span className="inline-flex self-start items-center gap-1.5 mt-2 min-h-[30px] py-1 px-3 rounded-[15px] bg-ok-soft text-ok text-[13.5px] font-semibold">
              <Check className="size-[15px] flex-none" aria-hidden />
              <span>
                Desconto{descPct > 0 ? <> de <span className="mono">{pct(descPct, descPct * 100 % 1 ? 1 : 0)}</span></> : ''} já aplicado: <span className="mono">{brl(descValor)}</span> a menos
              </span>
            </span>
          )}
          {grupos.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <h2 className="m-0 text-[14px] font-medium text-ink-2">O que está incluído</h2>
              <Composicao grupos={grupos} />
            </div>
          )}
        </section>

        <section className="card anim-subir px-5 py-1.5" style={{ animationDelay: '.16s' }} aria-label="Condições">
          <dl className="m-0">
            <Linha rotulo="Entrega">
              {prazo}
              {prazoObs && <span className="block text-[13px] text-ink-3 font-normal">{prazoObs}</span>}
            </Linha>
            {pagamento && <Linha rotulo="Pagamento">{pagamento}</Linha>}
            {validade && !aceiteAtual && (
              <Linha rotulo="Válido até">
                <span className="mono">{data(validade)}</span>
                {dias != null && dias >= 0 && (
                  <span className={`block text-[13px] font-normal ${dias <= 3 ? 'text-warn font-medium' : 'text-ink-3'}`}>{dias === 0 ? 'vence hoje' : dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`}</span>
                )}
              </Linha>
            )}
          </dl>
        </section>

        {curva.length > 1 && (
          <section className="card anim-subir p-5 flex flex-col gap-2.5 bg-primary-soft border-transparent" style={{ animationDelay: '.24s' }} aria-labelledby="po-mais">
            <h2 id="po-mais" className="m-0 text-[16px] font-semibold">
              Vai precisar de mais peças depois?
            </h2>
            <p className="m-0 text-[14px] text-ink-2">A preparação da máquina é feita uma vez só. Com mais peças, cada uma sai mais barata:</p>
            <ul className="m-0 p-0 list-none grid gap-2" style={{ gridTemplateColumns: `repeat(${curva.length}, minmax(0, 1fr))` }}>
              {curva.map((c) => (
                <li key={c.quantidade} className={`p-2.5 rounded-[14px] bg-surface-1 flex flex-col items-center gap-1.5 ${c.atual ? 'ring-2 ring-primary' : ''}`}>
                  <span className="h-14 w-full flex items-end justify-center" aria-hidden>
                    <span className="anim-subir w-5 rounded-t-[6px]" style={{ height: `${Math.max(12, (c.unitario / maxCurva) * 100)}%`, background: c.atual ? 'var(--pm-primary)' : 'var(--pm-chart-material)' }} />
                  </span>
                  <span className="mono text-[12px] text-ink-3">{num(c.quantidade, 0)} pç</span>
                  <span className="mono font-bold">{num(c.unitario)}</span>
                  <span className="sr-only">reais por peça{c.atual ? ', quantidade deste orçamento' : ''}</span>
                </li>
              ))}
            </ul>
            <span className="text-[12.5px] text-primary-text">Valores em R$ por peça, com o mesmo desconto</span>
          </section>
        )}

        {vendedor && (
          <section className="flex items-center gap-3 px-1 py-2 flex-wrap" aria-label="Falar com o vendedor">
            <Avatar nome={vendedor} />
            <span className="flex-1 min-w-[160px] text-[14px] text-ink-2">
              Dúvidas? Fale com <strong className="text-ink-1">{primeiroNome(vendedor)}</strong>, que preparou este orçamento.
            </span>
            <span className="flex gap-2">
              {zap && (
                <a href={zap} target="_blank" rel="noopener noreferrer" className={classeBotao('secundario', 'md', 'px-3.5')} aria-label={`Conversar com ${primeiroNome(vendedor)} no WhatsApp`}>
                  <MessageCircle className="size-[18px]" aria-hidden />
                  WhatsApp
                </a>
              )}
              {telVendedor && (
                <a href={`tel:${String(telVendedor).replace(/[^\d+]/g, '')}`} className={classeBotao('secundario', 'md', 'w-11 px-0')} aria-label={`Ligar para ${primeiroNome(vendedor)}`}>
                  <Phone className="size-[18px]" aria-hidden />
                </a>
              )}
            </span>
          </section>
        )}
      </main>

      {podeAprovar && (
        <div className="glass sticky bottom-0 mt-auto z-10 rounded-t-sheet px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] flex flex-col gap-2.5">
          <span className="flex items-baseline justify-between gap-3 text-[13px] text-ink-2">
            <span>Total</span>
            <span className="mono text-[20px] font-bold text-ink-1">{brl(total)}</span>
          </span>
          <span className="flex gap-2">
            <Button variante="secundario" tamanho="lg" className="px-4 flex-none" onClick={() => setFolha('ajuste')}>
              Pedir ajuste
            </Button>
            <Button variante="primario" tamanho="lg" icone={Check} className="px-4 flex-1 min-w-0" onClick={() => setFolha('aprovar')}>
              Aprovar orçamento
            </Button>
          </span>
        </div>
      )}

      <FolhaAprovar
        aberto={folha === 'aprovar'}
        token={token}
        cliente={cliente}
        contato={nomeDe(r.contato)}
        onFechar={() => setFolha(null)}
        onAprovado={(a, ja) => {
          setFolha(null);
          setJaAprovado(ja);
          setAceite(a);
        }}
        onVencido={() => {
          setFolha(null);
          setVencido(true);
        }}
      />
      <FolhaAjuste aberto={folha === 'ajuste'} token={token} vendedor={primeiroNome(vendedor)} contato={nomeDe(r.contato)} onFechar={() => setFolha(null)} />
    </FundoPortal>
  );
}

function FolhaAprovar({
  aberto, token, cliente, contato, onFechar, onAprovado, onVencido
}: {
  aberto: boolean; token: string; cliente: string; contato: string; onFechar: () => void; onAprovado: (a: Aceite, jaAprovado: boolean) => void; onVencido: () => void;
}) {
  const [nome, setNome] = useState(contato);
  const [li, setLi] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => portal.aprovar(token, nome.trim()),
    onSuccess: (res) => onAprovado({ ...(res?.aceite ?? {}), nome: res?.aceite?.nome ?? nome.trim(), os: res?.os }, false),
    onError: (e) => {
      if (e instanceof ErroPortal && e.codigo === 'ORCAMENTO_VENCIDO') onVencido();
      else if (e instanceof ErroPortal && e.codigo === 'JA_APROVADO') {
        const d = e.detalhes ?? {};
        onAprovado({ ...(d.aceite ?? d), os: d.os ?? d.aceite?.os }, true);
      } else setErro(e instanceof ErroPortal ? e.message : 'Não conseguimos registrar agora. Tente de novo.');
    }
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 3) return setErro('Escreva seu nome completo para registrar o aceite.');
    if (!li) return setErro('Marque a caixa confirmando que leu as condições.');
    setErro(null);
    m.mutate();
  };
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Tudo certo? Aprove aqui">
      <form onSubmit={enviar} className="flex flex-col gap-4 pb-2" noValidate>
        <TextField label="Seu nome completo" value={nome} onChange={setNome} autoComplete="name" required />
        <label className="flex gap-3 items-start text-[14.5px] cursor-pointer p-1 rounded-[10px] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-primary">
          <input type="checkbox" checked={li} onChange={(e) => setLi(e.target.checked)} className="size-[22px] mt-px flex-none accent-[var(--pm-primary-fill)]" />
          <span>Li as condições e aprovo este orçamento{cliente ? ` em nome de ${cliente}` : ''}.</span>
        </label>
        {erro && (
          <p className="m-0 text-bad font-medium text-[14px]" role="alert">
            {erro}
          </p>
        )}
        <Button type="submit" variante="primario" tamanho="lg" icone={Check} carregando={m.isPending} className="w-full">
          Aprovar orçamento
        </Button>
        <span className="text-[12.5px] text-ink-3">Ao aprovar, registramos seu nome, a data, a hora e o IP. É a sua assinatura digital.</span>
      </form>
    </Modal>
  );
}

function FolhaAjuste({ aberto, token, vendedor, contato, onFechar }: { aberto: boolean; token: string; vendedor: string; contato: string; onFechar: () => void }) {
  const [nome, setNome] = useState(contato);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => portal.ajuste(token, nome.trim(), mensagem.trim()),
    onError: (e) => setErro(e instanceof ErroPortal ? e.message : 'Não conseguimos enviar agora. Tente de novo.')
  });
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2) return setErro('Diga seu nome para sabermos com quem falar.');
    if (mensagem.trim().length < 3) return setErro('Conte o que você quer ajustar.');
    setErro(null);
    m.mutate();
  };
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={m.isSuccess ? 'Recebemos seu pedido' : 'O que você quer ajustar?'}>
      {m.isSuccess ? (
        <div className="flex flex-col gap-4 pb-2" role="status">
          <p className="m-0 text-ink-2">{vendedor ? `${vendedor} já foi avisado` : 'O vendedor já foi avisado'} e volta a falar com você em breve, com o orçamento ajustado. Obrigado!</p>
          <Button variante="secundario" tamanho="lg" onClick={onFechar} className="w-full">
            Voltar ao orçamento
          </Button>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4 pb-2" noValidate>
          <TextField label="Seu nome" value={nome} onChange={setNome} autoComplete="name" required />
          <TextArea label="Mensagem" value={mensagem} onChange={setMensagem} rows={4} hint="Ex.: preciso de 20 peças em vez de 10, ou entrega até sexta." />
          {erro && (
            <p className="m-0 text-bad font-medium text-[14px]" role="alert">
              {erro}
            </p>
          )}
          <Button type="submit" variante="secundario" tamanho="lg" icone={Send} carregando={m.isPending} className="w-full">
            {vendedor ? `Enviar para ${vendedor}` : 'Enviar pedido'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
