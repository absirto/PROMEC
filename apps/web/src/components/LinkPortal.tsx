import { useEffect, useState } from 'react';
import { Copy, Mail, MessageCircle, Send } from 'lucide-react';
import { api, msgErro } from '../lib/api';
import { data } from '../lib/format';
import { Modal } from './Modal';
import { Button, classeBotao } from './Button';
import { Carregando } from './EmptyState';
import { useToast } from './Toast';

interface Link { url: string; expiraEm?: string; whatsapp?: string; email?: { assunto: string; corpo: string } }

/** Gera (ou renova) o link do portal e oferece copiar, WhatsApp e e-mail. */
export function LinkPortal({ aberto, onFechar, rota, titulo, oQueVe = 'o que precisa (preço, prazo, condições)' }: { aberto: boolean; onFechar: () => void; rota: string; titulo: string; oQueVe?: string }) {
  const toast = useToast();
  // Gerar de novo invalida o link anterior: só gera uma vez por tela (ou depois de erro).
  const [gerado, setGerado] = useState<{ rota: string; link: Link } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const link = gerado?.rota === rota ? gerado.link : null;
  useEffect(() => {
    if (!aberto || link) return;
    setErro(null);
    api<Link>(rota, { method: 'POST' }).then((l) => setGerado({ rota, link: l })).catch((e) => setErro(msgErro(e)));
  }, [aberto, rota, link]);
  const copiar = async (texto: string, msg: string) => {
    try { await navigator.clipboard.writeText(texto); toast(msg, 'ok'); } catch { toast('Não deu para copiar. Selecione o texto e copie à mão.', 'warn'); }
  };
  const mailto = link?.email ? `mailto:?subject=${encodeURIComponent(link.email.assunto)}&body=${encodeURIComponent(link.email.corpo)}` : null;
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={titulo} rodape={<Button onClick={onFechar}>Fechar</Button>}>
      {erro ? <p role="alert" className="m-0 p-3 rounded-field bg-bad-soft text-[14px]">{erro}</p> : !link ? <Carregando linhas={2} /> : (
        <>
          <p className="m-0 text-ink-2 text-[14px]">O cliente abre pelo celular, sem senha. Ele vê {oQueVe} e nunca custos nem margem.{link.expiraEm ? ` Vale até ${data(link.expiraEm)}.` : ''}</p>
          <div className="campo"><input readOnly value={link.url} aria-label="Link do portal" className="mono text-[13px]" onFocus={(e) => e.target.select()} /></div>
          <div className="flex flex-wrap gap-2">
            <Button icone={Copy} onClick={() => copiar(link.url, 'Link copiado.')}>Copiar link</Button>
            {link.whatsapp && <a href={link.whatsapp} target="_blank" rel="noopener noreferrer" className={classeBotao('primario')}><MessageCircle className="size-[18px]" aria-hidden />Enviar no WhatsApp</a>}
            {mailto && <a href={mailto} className={classeBotao('secundario')}><Mail className="size-[18px]" aria-hidden />Abrir no e-mail</a>}
          </div>
          {link.email && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13.5px] font-medium text-ink-2">Texto do e-mail</span>
              <pre className="m-0 p-3 rounded-field bg-surface-2 text-[13.5px] whitespace-pre-wrap [overflow-wrap:anywhere] font-sans">{link.email.assunto}{'\n\n'}{link.email.corpo}</pre>
              <Button tamanho="sm" variante="terciario" icone={Send} className="self-start" onClick={() => copiar(`${link.email!.assunto}\n\n${link.email!.corpo}`, 'Texto copiado.')}>Copiar texto</Button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
