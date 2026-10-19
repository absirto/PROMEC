import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, TriangleAlert } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ApiError, msgErro } from '../lib/api';
import { Button } from '../components/Button';
import { gearPath, Illustration, LogoProMEC } from '../components/Illustrations';

export const saudacaoAgora = (d = new Date()) => (d.getHours() < 12 ? 'Bom dia' : d.getHours() < 18 ? 'Boa tarde' : 'Boa noite');

export function Login() {
  const { entrar, logado, motivoSaida } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [tremer, setTremer] = useState(0);
  useEffect(() => { document.title = 'Entrar · ProMEC'; }, []);
  const destino = (loc.state as { de?: string } | null)?.de ?? '/';

  if (logado && !enviando) return <Navigate to={destino} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro('Preencha o e-mail e a senha para entrar.');
      setTremer((n) => n + 1);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email.trim(), senha);
      navigate(destino, { replace: true });
    } catch (err) {
      setErro(err instanceof ApiError && err.status === 401 ? 'E-mail ou senha não conferem. Confira o Caps Lock e tente de novo.' : msgErro(err));
      setTremer((n) => n + 1);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col text-white" style={{ background: 'radial-gradient(1200px 700px at 75% 20%, #2A6AA3 0%, #15395A 45%, #0B1D2E 100%)' }}>
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 size-full">
        <defs>
          <pattern id="lg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0v40" fill="none" stroke="rgba(255,255,255,.05)" />
          </pattern>
        </defs>
        <rect width="1440" height="900" fill="url(#lg-grid)" />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
          <path className="anim-girar" d={gearPath(1180, 240, 96, 18, 14)} stroke="rgba(255,255,255,.22)" />
          <circle cx="1180" cy="240" r="22" stroke="rgba(255,192,143,.5)" />
          <path className="anim-girar" style={{ animationDirection: 'reverse' }} d={gearPath(1335, 360, 56, 12, 10)} stroke="rgba(255,255,255,.18)" />
          <g stroke="rgba(255,255,255,.26)">
            <path d="M140 640h210l4 4v117l-4 4H140l-4-4V644zM136 652.5h218M136 752.5h218" />
            <path d="M110 702.5h270" stroke="rgba(255,192,143,.55)" strokeDasharray="14 4 3 4" />
            <text x="245" y="800" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="14" fill="rgba(255,192,143,.7)" stroke="none">Ø20 H7 · 42</text>
          </g>
        </g>
      </svg>
      <Illustration tipo="torno" className="absolute right-[-40px] bottom-6 w-[560px] max-w-[70%] opacity-80" />

      <header className="relative flex items-center gap-3 px-[clamp(16px,4vw,48px)] py-6">
        <LogoProMEC className="size-11" />
        <span className="font-display text-[26px] font-bold">ProMEC</span>
      </header>

      <main className="relative flex-1 flex flex-wrap items-center justify-center gap-[clamp(24px,6vw,96px)] px-[clamp(16px,4vw,48px)] pt-5 pb-16">
        <div className="flex-[1_1_380px] max-w-[520px] flex flex-col gap-3.5">
          <h1 className="m-0 font-display font-bold text-[clamp(40px,5.4vw,72px)] leading-[.95]">Cada hora da sua máquina tem um preço justo.</h1>
          <p className="m-0 text-[18px] text-[#D3E0EE]">Orçamento, ordem de serviço e custo real no mesmo lugar, para oficina, usinagem e caldeiraria.</p>
        </div>

        <section key={tremer} aria-labelledby="h-login" className={`glass text-ink-1 flex-[0_1_440px] w-full rounded-[32px] p-[clamp(24px,3vw,36px)] ${tremer ? 'anim-tremer' : 'anim-subir'}`}>
          <form onSubmit={enviar} noValidate className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="h-login" className="m-0 text-[34px] font-bold leading-none">{saudacaoAgora()}! Vamos entrar?</h2>
              <span className="text-[14.5px] text-ink-2">Use o e-mail da empresa.</span>
            </div>
            {(erro || motivoSaida) && (
              <div role="alert" className={`flex gap-2.5 items-start px-3.5 py-3 rounded-field text-[14px] ${erro ? 'bg-bad-soft' : 'bg-warn-soft'}`}>
                <TriangleAlert className={`size-[18px] mt-0.5 flex-none ${erro ? 'text-bad' : 'text-warn'}`} aria-hidden />
                <span>{erro ?? motivoSaida}</span>
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-[13.5px] font-medium text-ink-2">E-mail</span>
              <span className="campo" data-erro={!!erro}>
                <Mail className="size-[18px] text-ink-3" aria-hidden />
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erro || undefined} autoFocus />
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13.5px] font-medium text-ink-2">Senha</span>
              <span className="campo" data-erro={!!erro}>
                <Lock className="size-[18px] text-ink-3" aria-hidden />
                <input type={ver ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} aria-invalid={!!erro || undefined} />
                <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'} className="size-8 grid place-items-center rounded-md text-ink-3 hover:text-ink-1">
                  {ver ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
                </button>
              </span>
            </label>
            <Button type="submit" variante="primario" tamanho="lg" carregando={enviando} className="w-full mt-1">
              Entrar {!enviando && <ArrowRight className="size-[18px]" aria-hidden />}
            </Button>
            <span className="text-caption text-ink-3 text-center">Esqueceu a senha? Peça para quem administra o ProMEC na sua empresa.</span>
          </form>
        </section>
      </main>
    </div>
  );
}
