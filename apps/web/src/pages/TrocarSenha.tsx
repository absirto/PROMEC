import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, KeyRound, X } from 'lucide-react';
import { api, ApiError, msgErro } from '../lib/api';
import { useAuth } from '../lib/auth';
import { gravar, ler } from '../lib/storage';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { TextField } from '../components/Field';
import { useToast } from '../components/Toast';
import { useTitulo } from '../layout/titulo';

export const regrasSenha = (s: string) => [
  { ok: s.length >= 10, texto: 'Pelo menos 10 caracteres' },
  { ok: /\d/.test(s), texto: 'Um número' },
  { ok: /[A-Z]/.test(s) && /[a-z]/.test(s), texto: 'Letras maiúsculas e minúsculas' }
];
const NIVEL = [['Fraca', 'var(--pm-bad)'], ['Fraca', 'var(--pm-bad)'], ['Quase lá', 'var(--pm-signal)'], ['Boa', 'var(--pm-ok)'], ['Forte', 'var(--pm-ok)']] as const;

export default function TrocarSenha() {
  useTitulo('Trocar senha');
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ atual: '', nova: '', repetir: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const regras = regrasSenha(f.nova);
  const pontos = regras.filter((r) => r.ok).length + (f.nova.length >= 14 && regras.every((r) => r.ok) ? 1 : 0);
  const [rotulo, cor] = NIVEL[pontos] ?? NIVEL[0];
  const ok = regras.every((r) => r.ok) && f.nova === f.repetir && f.atual;
  const forcado = !!usuario?.trocarSenha;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setEnviando(true);
    setErro(null);
    try {
      await api('/auth/trocar-senha', { method: 'POST', body: { senhaAtual: f.atual, novaSenha: f.nova } });
      try {
        const salvo = ler('promec.usuario');
        if (salvo) gravar('promec.usuario', JSON.stringify({ ...JSON.parse(salvo), trocarSenha: false }));
      } catch { /* sem armazenamento */ }
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast('Senha trocada. Da próxima vez, entre com a nova.', 'ok');
      navigate('/', { replace: true });
    } catch (err) {
      setErro(err instanceof ApiError && err.codigo === 'SENHA_FRACA' ? 'A senha ainda está fraca: use 10 caracteres ou mais, com número, maiúscula e minúscula.' : msgErro(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card className="p-6 max-w-[480px] w-full mx-auto flex flex-col gap-4 anim-subir">
      <span className="chip-ico !size-12 bg-primary-soft text-primary-text"><KeyRound className="size-6" aria-hidden /></span>
      <h1 className="m-0 text-[32px] font-bold leading-none">{forcado ? `Primeiro acesso${usuario?.nome ? `, ${usuario.nome.split(' ')[0]}` : ''}!` : 'Trocar a senha'}</h1>
      <p className="m-0 text-ink-2">{forcado ? 'Crie a sua senha. Ninguém além de você vai saber, nem quem cadastrou.' : 'Escolha uma senha que só você saiba.'}</p>
      <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
        <TextField label={forcado ? 'Senha provisória' : 'Senha atual'} type="password" autoComplete="current-password" value={f.atual} onChange={(v) => setF({ ...f, atual: v })} />
        <TextField label="Nova senha" type="password" autoComplete="new-password" value={f.nova} onChange={(v) => setF({ ...f, nova: v })} />
        <div className="flex gap-1.5" role="img" aria-label={`Força da senha: ${f.nova ? rotulo : 'vazia'}`}>
          {[1, 2, 3, 4].map((i) => <span key={i} className="flex-1 h-1.5 rounded-full transition-colors duration-micro" style={{ background: f.nova && i <= pontos ? cor : 'var(--pm-surface-3)' }} />)}
        </div>
        {f.nova && <span aria-live="polite" className="text-[13.5px] font-semibold" style={{ color: cor }}>{rotulo}</span>}
        <ul className="m-0 p-0 list-none flex flex-col gap-1 text-[13.5px]">
          {regras.map((r) => (
            <li key={r.texto} className={`flex items-center gap-2 ${r.ok ? 'text-ok' : 'text-ink-3'}`}>{r.ok ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}{r.texto}</li>
          ))}
        </ul>
        <TextField label="Repita a nova senha" type="password" autoComplete="new-password" value={f.repetir} onChange={(v) => setF({ ...f, repetir: v })} erro={f.repetir && f.repetir !== f.nova ? 'As duas não batem. Confira.' : null} />
        {erro && <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{erro}</p>}
        <Button type="submit" variante="primario" tamanho="lg" carregando={enviando} disabled={!ok}>Salvar e entrar</Button>
      </form>
    </Card>
  );
}
