import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Lock, Pencil, Plus, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAcao, useColaboradores } from '../lib/queries';
import { SENSIVEIS } from '../lib/permissoes';
import { iniciais } from '../lib/format';
import type { Colaborador, Lista } from '../lib/types';
import { HeroBand } from '../components/HeroBand';
import { Card } from '../components/Card';
import { Button, IconButton } from '../components/Button';
import { SelectField, TextField, Toggle } from '../components/Field';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { Listagem, normalizar } from '../components/Listagem';
import { Aviso, Carregando, EmptyState, ErroEstado } from '../components/EmptyState';
import { Pill } from '../components/Pill';
import { Abas, useAba } from '../components/Abas';
import { useToast } from '../components/Toast';
import { useTitulo } from '../layout/titulo';

interface UsuarioItem { id: string; nome: string; email: string; perfil?: { id: string; nome: string } | null; perfilId?: string | null; ativo: boolean; ultimoAcesso?: string | null; colaboradorId?: string | null }
interface Perfil { id: string; nome: string; padrao?: boolean; permissoes?: string[]; usuarios?: number | unknown[]; _count?: { usuarios?: number } }
interface Permissao { chave: string; modulo: string; descricao?: string; sensivel?: boolean }

const ABAS = ['usuarios', 'perfis'] as const;
type Aba = (typeof ABAS)[number];
type Filtro = 'ativos' | 'inativos' | 'todos';

const comoLista = <T,>(d: T[] | Lista<T> | null | undefined): T[] => (!d ? [] : Array.isArray(d) ? d : d.itens ?? []);
const nUsuarios = (p: Perfil) => (typeof p.usuarios === 'number' ? p.usuarios : Array.isArray(p.usuarios) ? p.usuarios.length : p._count?.usuarios ?? 0);
const quando = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : null);
const ehSensivel = (p: Permissao) => p.sensivel ?? (SENSIVEIS as readonly string[]).includes(p.chave);

const MODULOS: Record<string, string> = {
  painel: 'Painel', orcamentos: 'Orçamentos', os: 'Ordens de serviço', planejamento: 'Planejamento', agenda: 'Agenda', operador: 'Modo operador', custos: 'Custos',
  cadastros: 'Cadastros', estoque: 'Estoque', compras: 'Compras', qualidade: 'Qualidade', financeiro: 'Financeiro', crm: 'CRM', usuarios: 'Usuários e perfis', configuracoes: 'Configurações'
};

const ROTULO_SENSIVEL: Record<string, string> = {
  'custo.ver_custo_hora': 'Ver custo-hora', 'orcamento.editar_margem': 'Editar margem do orçamento', 'orcamento.aprovar_desconto': 'Aprovar desconto',
  'custo.publicar_tabela': 'Publicar Tabela de Custos', 'os.cancelar': 'Cancelar OS', 'financeiro.estornar': 'Estornar baixas', 'compras.aprovar_pedido': 'Aprovar pedido de compra'
};

const useUsuarios = () => useQuery({ queryKey: ['usuarios'], queryFn: () => api<UsuarioItem[] | Lista<UsuarioItem>>('/usuarios'), select: comoLista });
const usePerfis = () => useQuery({ queryKey: ['perfis'], queryFn: () => api<Perfil[] | Lista<Perfil>>('/perfis'), select: comoLista });
const usePermissoes = () => useQuery({ queryKey: ['permissoes'], queryFn: () => api<Permissao[] | Lista<Permissao>>('/permissoes'), select: comoLista, staleTime: 10 * 60_000 });

export default function Usuarios() {
  useTitulo('Usuários e perfis');
  const { pode } = useAuth();
  const gerencia = pode('usuarios.gerenciar');
  const [aba, setAba] = useAba<Aba>('usuarios', ABAS);
  const usuarios = useUsuarios();
  const perfis = usePerfis();
  const [usuario, setUsuario] = useState<UsuarioItem | 'novo' | null>(null);
  const [perfil, setPerfil] = useState<Perfil | 'novo' | null>(null);
  const [senha, setSenha] = useState<{ nome: string; senha: string } | null>(null);

  return (
    <>
      <HeroBand
        ilustracao="equipe"
        titulo="Usuários e perfis"
        texto="Quem entra no ProMEC e o que cada um pode fazer. O perfil junta as permissões; a pessoa só herda o que o perfil dela tem."
        acoes={
          gerencia &&
          (aba === 'usuarios' ? (
            <Button variante="primario" icone={Plus} onClick={() => setUsuario('novo')}>Novo usuário</Button>
          ) : (
            <Button variante="primario" icone={Plus} onClick={() => setPerfil('novo')}>Novo perfil</Button>
          ))
        }
      />
      {!gerencia && <Aviso tom="info" titulo="Somente leitura">Você pode consultar, mas mudar usuários e perfis precisa da permissão de gerenciar usuários.</Aviso>}

      <Abas<Aba> rotulo="Usuários e perfis" valor={aba} onChange={setAba} abas={[
        { valor: 'usuarios', rotulo: 'Usuários', n: usuarios.data?.length },
        { valor: 'perfis', rotulo: 'Perfis', n: perfis.data?.length }
      ]} />

      {aba === 'usuarios' && <ListaUsuarios q={usuarios} gerencia={gerencia} onEditar={setUsuario} onNovo={() => setUsuario('novo')} />}
      {aba === 'perfis' && <ListaPerfis q={perfis} gerencia={gerencia} onEditar={setPerfil} />}

      {usuario && (
        <FormUsuario
          inicial={usuario === 'novo' ? null : usuario}
          perfis={perfis.data ?? []}
          onFechar={() => setUsuario(null)}
          onSenha={(nome, s) => { setUsuario(null); setSenha({ nome, senha: s }); }}
        />
      )}
      {perfil && <FormPerfil inicial={perfil === 'novo' ? null : perfil} onFechar={() => setPerfil(null)} />}
      {senha && <SenhaProvisoria nome={senha.nome} senha={senha.senha} onFechar={() => setSenha(null)} />}
    </>
  );
}

function ListaUsuarios({ q, gerencia, onEditar, onNovo }: { q: ReturnType<typeof useUsuarios>; gerencia: boolean; onEditar: (u: UsuarioItem) => void; onNovo: () => void }) {
  const colaboradores = useColaboradores();
  const nomeColab = new Map(comoLista<Colaborador>(colaboradores.data).map((c) => [c.id, c.nome]));
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('ativos');
  const todos = q.data ?? [];
  const ativos = todos.filter((u) => u.ativo);
  const termo = normalizar(busca.trim());
  const linhas = todos.filter((u) => (filtro === 'todos' || (filtro === 'ativos') === u.ativo) && (!termo || normalizar(`${u.nome} ${u.email} ${u.perfil?.nome ?? ''}`).includes(termo)));

  return (
    <Listagem<Filtro>
      rotulo="Lista de usuários"
      busca={busca}
      onBusca={setBusca}
      placeholder="Buscar por nome, e-mail ou perfil"
      filtros={[
        { valor: 'ativos', rotulo: 'Ativos', n: ativos.length },
        { valor: 'inativos', rotulo: 'Inativos', n: todos.length - ativos.length },
        { valor: 'todos', rotulo: 'Todos', n: todos.length }
      ]}
      filtro={filtro}
      onFiltro={setFiltro}
      carregando={q.isLoading}
      erro={q.error}
      tentar={() => q.refetch()}
      vazio={
        q.isSuccess && !todos.length ? (
          <EmptyState ilustracao="equipe" titulo="Ninguém com acesso ainda" texto="Crie um usuário para cada pessoa que usa o sistema. Login compartilhado apaga o rastro de quem fez o quê."
            acao={gerencia && <Button variante="primario" icone={Plus} onClick={onNovo}>Novo usuário</Button>} />
        ) : null
      }
      semResultado={!linhas.length}
      total={todos.length}
      mostrando={linhas.length}
    >
      {linhas.length > 0 && (
        <DataTable
          rotulo="Usuários"
          linhas={linhas}
          chave={(u) => u.id}
          colunas={[
            {
              chave: 'nome', titulo: 'Nome', principal: true,
              render: (u) => (
                <span className="flex items-center gap-3">
                  <span className="size-[38px] rounded-full grid place-items-center text-white font-bold text-[13px] flex-none bg-steel-2" aria-hidden>{iniciais(u.nome)}</span>
                  <span className="flex flex-col min-w-0">
                    <span className="font-semibold">{u.nome}</span>
                    <span className="text-caption text-ink-3 break-all">{u.email}</span>
                  </span>
                </span>
              )
            },
            { chave: 'p', titulo: 'Perfil', render: (u) => (u.perfil ? <Pill tom="steel" icone={ShieldCheck}>{u.perfil.nome}</Pill> : <span className="text-ink-3">sem perfil</span>) },
            { chave: 'c', titulo: 'Funcionário', render: (u) => (u.colaboradorId ? nomeColab.get(u.colaboradorId) ?? 'vinculado' : <span className="text-ink-3">nenhum</span>) },
            { chave: 'a', titulo: 'Último acesso', mono: true, render: (u) => quando(u.ultimoAcesso) ?? <span className="text-ink-3 font-sans">nunca entrou</span> },
            { chave: 's', titulo: 'Situação', render: (u) => (u.ativo ? <Pill tom="ok">Ativo</Pill> : <Pill>Inativo</Pill>) },
            ...(gerencia ? [{ chave: 'e', titulo: 'Ações', alinhar: 'right' as const, render: (u: UsuarioItem) => <IconButton icone={Pencil} rotulo={`Editar ${u.nome}`} onClick={() => onEditar(u)} className="size-9" /> }] : [])
          ]}
        />
      )}
    </Listagem>
  );
}

function FormUsuario({ inicial, perfis, onFechar, onSenha }: { inicial: UsuarioItem | null; perfis: Perfil[]; onFechar: () => void; onSenha: (nome: string, senha: string) => void }) {
  const colaboradores = useColaboradores();
  const [f, setF] = useState({
    nome: inicial?.nome ?? '', email: inicial?.email ?? '', perfilId: inicial?.perfil?.id ?? inicial?.perfilId ?? '', colaboradorId: inicial?.colaboradorId ?? '', ativo: inicial?.ativo ?? true
  });
  const [tentou, setTentou] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const erros = {
    nome: !f.nome.trim() ? 'Como essa pessoa se chama?' : null,
    email: !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? 'Informe um e-mail válido. É com ele que a pessoa entra.' : null,
    perfil: !f.perfilId ? 'Escolha o perfil. É ele que diz o que a pessoa pode fazer.' : null
  };
  const salvar = useAcao(
    () => {
      if (!inicial) return api<{ senhaProvisoria?: string }>('/usuarios', { method: 'POST', body: { nome: f.nome.trim(), email: f.email.trim(), perfilId: f.perfilId, colaboradorId: f.colaboradorId || undefined } });
      const body: Record<string, unknown> = { nome: f.nome.trim(), perfilId: f.perfilId, ativo: f.ativo };
      if (f.colaboradorId !== (inicial.colaboradorId ?? '')) body.colaboradorId = f.colaboradorId || null;
      return api<{ senhaProvisoria?: string }>(`/usuarios/${inicial.id}`, { method: 'PATCH', body });
    },
    {
      invalida: [['usuarios'], ['perfis']],
      sucesso: inicial ? 'Usuário atualizado.' : 'Usuário criado. Passe a senha provisória para a pessoa.',
      onSuccess: (r) => (!inicial && r?.senhaProvisoria ? onSenha(f.nome.trim(), r.senhaProvisoria) : onFechar())
    }
  );
  const redefinir = useAcao(() => api<{ senhaProvisoria?: string }>(`/usuarios/${inicial!.id}/redefinir-senha`, { method: 'POST' }), {
    invalida: [['usuarios']],
    onSuccess: (r) => (r?.senhaProvisoria ? onSenha(inicial!.nome, r.senhaProvisoria) : onFechar())
  });
  const enviar = () => {
    setTentou(true);
    if (Object.values(erros).every((e) => !e)) salvar.mutate(undefined);
  };
  const perfilEscolhido = perfis.find((p) => p.id === f.perfilId);

  if (confirmar)
    return (
      <Modal aberto onFechar={() => setConfirmar(false)} largura={460} titulo="Redefinir a senha?"
        rodape={<>
          <Button onClick={() => setConfirmar(false)}>Voltar</Button>
          <Button variante="perigo" icone={KeyRound} carregando={redefinir.isPending} onClick={() => redefinir.mutate(undefined)}>Redefinir senha</Button>
        </>}>
        <p className="m-0 text-ink-2">A senha atual de <strong className="text-ink-1">{inicial?.nome}</strong> deixa de valer agora. Vamos gerar uma provisória para você passar à pessoa.</p>
      </Modal>
    );

  return (
    <Modal aberto onFechar={onFechar} largura={600} titulo={inicial ? 'Editar usuário' : 'Novo usuário'}
      rodape={<>
        {inicial && <Button icone={KeyRound} className="mr-auto" onClick={() => setConfirmar(true)}>Redefinir senha</Button>}
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variante="primario" carregando={salvar.isPending} onClick={enviar}>{inicial ? 'Salvar' : 'Criar usuário'}</Button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField className="sm:col-span-2" label="Nome" required autoComplete="off" value={f.nome} onChange={(v) => set('nome', v)} erro={tentou ? erros.nome : null} />
        <TextField className="sm:col-span-2" label="E-mail" type="email" required autoComplete="off" value={f.email} onChange={(v) => set('email', v)} disabled={!!inicial}
          hint={inicial ? 'O e-mail é o login e não muda. Para trocar, crie outro usuário e desative este.' : undefined} erro={tentou ? erros.email : null} />
        <SelectField label="Perfil" required value={f.perfilId} onChange={(v) => set('perfilId', v)} vazio="Escolha" opcoes={perfis.map((p) => ({ valor: p.id, rotulo: p.nome }))}
          erro={tentou ? erros.perfil : null} hint={perfilEscolhido ? `${perfilEscolhido.permissoes?.length ?? 0} permissões neste perfil` : undefined} />
        <SelectField label="Funcionário vinculado" value={f.colaboradorId} onChange={(v) => set('colaboradorId', v)} vazio="Nenhum"
          opcoes={comoLista<Colaborador>(colaboradores.data).filter((c) => c.ativo || c.id === f.colaboradorId).map((c) => ({ valor: c.id, rotulo: c.nome }))}
          hint="Opcional. Liga os apontamentos do modo operador a esta pessoa." />
        {inicial && (
          <div className="sm:col-span-2">
            <Toggle label="Ativo" descricao="Inativo, não entra mais no sistema. O histórico do que fez continua." value={f.ativo} onChange={(v) => set('ativo', v)} />
          </div>
        )}
      </div>
      {!inicial && <p className="m-0 text-[14px] text-ink-2">Ao criar, o ProMEC gera uma senha provisória. Ela aparece uma única vez, e a pessoa troca no primeiro acesso.</p>}
    </Modal>
  );
}

function SenhaProvisoria({ nome, senha, onFechar }: { nome: string; senha: string; onFechar: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [copiou, setCopiou] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiou(true);
      toast('Senha copiada.', 'ok');
    } catch {
      ref.current?.focus();
      ref.current?.select();
      toast('Não deu para copiar sozinho. A senha está selecionada: use Ctrl+C.', 'info');
    }
  };
  return (
    <Modal aberto onFechar={onFechar} largura={500} faixa titulo="Senha provisória"
      rodape={<Button variante="primario" onClick={onFechar}>Já anotei</Button>}>
      <p className="m-0 text-ink-2">Passe esta senha para <strong className="text-ink-1">{nome}</strong> pessoalmente ou por um canal seguro.</p>
      <div className="flex gap-2 items-center">
        <label className="campo flex-1">
          <span className="sr-only">Senha provisória</span>
          <input ref={ref} readOnly value={senha} className="mono text-[20px] font-bold tracking-[.04em]" onFocus={(e) => e.currentTarget.select()} />
        </label>
        <Button icone={copiou ? Check : Copy} onClick={copiar} aria-label="Copiar senha">{copiou ? 'Copiada' : 'Copiar'}</Button>
      </div>
      <Aviso tom="warn" titulo="Ela não aparece de novo">
        Feche esta janela só depois de anotar ou copiar. No primeiro acesso, o ProMEC pede para a pessoa criar a senha dela.
      </Aviso>
    </Modal>
  );
}

function ListaPerfis({ q, gerencia, onEditar }: { q: ReturnType<typeof usePerfis>; gerencia: boolean; onEditar: (p: Perfil) => void }) {
  if (q.isLoading) return <Card><Carregando /></Card>;
  if (q.isError) return <Card><ErroEstado erro={q.error} tentar={() => q.refetch()} /></Card>;
  const perfis = [...(q.data ?? [])].sort((a, b) => Number(!!b.padrao) - Number(!!a.padrao) || a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!perfis.length) return <Card><EmptyState titulo="Nenhum perfil ainda" texto="Perfis juntam as permissões de quem faz o mesmo trabalho: orçamentista, produção, financeiro." /></Card>;
  return (
    <Card className="overflow-hidden" aria-label="Perfis">
      <ul className="list-none m-0 p-0">
        {perfis.map((p) => {
          const n = nUsuarios(p);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 border-t border-border first:border-0">
              <span className="size-10 rounded-control bg-steel-soft text-steel grid place-items-center flex-none"><ShieldCheck className="size-5" aria-hidden /></span>
              <span className="flex-1 min-w-[160px] flex flex-col">
                <span className="font-semibold">{p.nome}</span>
                <span className="text-[13px] text-ink-3"><span className="mono">{p.permissoes?.length ?? 0}</span> permissões</span>
              </span>
              {p.padrao && <Pill icone={Lock}>Padrão</Pill>}
              <Pill tom="info" icone={Users}><span className="mono">{n}</span> {n === 1 ? 'usuário' : 'usuários'}</Pill>
              <IconButton icone={gerencia ? Pencil : ShieldCheck} rotulo={gerencia ? `Editar ${p.nome}` : `Ver permissões de ${p.nome}`} onClick={() => onEditar(p)} className="size-9" />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function FormPerfil({ inicial, onFechar }: { inicial: Perfil | null; onFechar: () => void }) {
  const { pode } = useAuth();
  const gerencia = pode('usuarios.gerenciar');
  const catalogo = usePermissoes();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [sel, setSel] = useState(() => new Set(inicial?.permissoes ?? []));
  const [tentou, setTentou] = useState(false);
  const padrao = !!inicial?.padrao;
  const n = inicial ? nUsuarios(inicial) : 0;

  const { modulos, sensiveis } = useMemo(() => {
    const itens = catalogo.data ?? [];
    const grupos = new Map<string, { visualizar?: Permissao; gerenciar?: Permissao; outras: Permissao[] }>();
    for (const p of itens.filter((x) => !ehSensivel(x))) {
      const g = grupos.get(p.modulo) ?? { outras: [] };
      const acao = p.chave.split('.')[1];
      if (acao === 'visualizar') g.visualizar = p;
      else if (acao === 'gerenciar') g.gerenciar = p;
      else g.outras.push(p);
      grupos.set(p.modulo, g);
    }
    return { modulos: [...grupos.entries()], sensiveis: itens.filter(ehSensivel) };
  }, [catalogo.data]);

  const marcar = (chave: string, on: boolean) => {
    const s = new Set(sel);
    const [modulo, acao] = chave.split('.');
    if (on) {
      s.add(chave);
      if (acao === 'gerenciar' && modulos.some(([m, g]) => m === modulo && g.visualizar)) s.add(`${modulo}.visualizar`);
    } else {
      s.delete(chave);
      if (acao === 'visualizar') s.delete(`${modulo}.gerenciar`);
    }
    setSel(s);
  };

  const erroNome = !nome.trim() ? 'Dê um nome ao perfil. Ex.: "Encarregado de produção".' : null;
  const salvar = useAcao(
    () => {
      const body: Record<string, unknown> = { permissoes: [...sel] };
      if (!padrao) body.nome = nome.trim();
      return inicial ? api(`/perfis/${inicial.id}`, { method: 'PATCH', body }) : api('/perfis', { method: 'POST', body });
    },
    { invalida: [['perfis'], ['usuarios'], ['me']], sucesso: inicial ? 'Perfil salvo. Vale a partir do próximo clique de cada pessoa.' : 'Perfil criado. Já dá para escolher nos usuários.', onSuccess: onFechar }
  );
  const enviar = () => {
    setTentou(true);
    if (!erroNome) salvar.mutate(undefined);
  };
  const caixa = (p: Permissao | undefined, rotulo: string) =>
    p ? (
      <input type="checkbox" className="size-5 accent-[var(--pm-primary)] cursor-pointer disabled:cursor-not-allowed" checked={sel.has(p.chave)} disabled={!gerencia}
        onChange={(e) => marcar(p.chave, e.target.checked)} aria-label={rotulo} title={p.descricao} />
    ) : (
      <span className="text-ink-3" aria-label="Não se aplica">—</span>
    );

  return (
    <Modal aberto onFechar={onFechar} largura={860} titulo={inicial ? `Perfil ${inicial.nome}` : 'Novo perfil'}
      rodape={gerencia ? <>
        <span className="mr-auto self-center text-[13.5px] text-ink-2" aria-live="polite">
          {inicial ? <>Afeta <strong className="mono">{n}</strong> {n === 1 ? 'usuário' : 'usuários'} · </> : null}
          <span className="mono">{sel.size}</span> permissões marcadas
        </span>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variante="primario" carregando={salvar.isPending} onClick={enviar}>{inicial ? 'Salvar perfil' : 'Criar perfil'}</Button>
      </> : <Button onClick={onFechar}>Fechar</Button>}>
      <TextField label="Nome do perfil" required value={nome} onChange={setNome} disabled={padrao || !gerencia}
        hint={padrao ? 'Perfil padrão do ProMEC: o nome não muda, mas as permissões dá para ajustar.' : undefined} erro={tentou ? erroNome : null} />
      {inicial && n > 0 && gerencia && (
        <Aviso tom="info">Mudanças aqui valem para <strong className="mono">{n}</strong> {n === 1 ? 'pessoa' : 'pessoas'} com este perfil, assim que você salvar.</Aviso>
      )}

      {catalogo.isLoading ? <Carregando linhas={6} rotulo="Carregando permissões" /> : catalogo.isError ? <ErroEstado erro={catalogo.error} tentar={() => catalogo.refetch()} /> : (
        <>
          <div className="relative overflow-x-auto rounded-field border border-border">
            <table className="w-full text-[14px] border-collapse" aria-label="Permissões por módulo">
              <thead className="bg-surface-2">
                <tr>
                  <th scope="col" className="text-left font-semibold px-3 py-2">Módulo</th>
                  <th scope="col" className="w-[110px] text-center font-semibold px-2 py-2">Visualizar</th>
                  <th scope="col" className="w-[110px] text-center font-semibold px-2 py-2">Gerenciar</th>
                </tr>
              </thead>
              <tbody>
                {modulos.map(([m, g]) => {
                  const rotulo = MODULOS[m] ?? m;
                  return (
                    <tr key={m} className="border-t border-border">
                      <th scope="row" className="text-left font-medium px-3 py-2">
                        {rotulo}
                        {g.outras.length > 0 && (
                          <span className="flex flex-wrap gap-x-4 gap-y-1 mt-1 font-normal">
                            {g.outras.map((o) => (
                              <label key={o.chave} className="inline-flex items-center gap-2 text-[13px] text-ink-2">
                                <input type="checkbox" className="size-4" checked={sel.has(o.chave)} disabled={!gerencia} onChange={(e) => marcar(o.chave, e.target.checked)} />
                                {o.descricao ?? o.chave}
                              </label>
                            ))}
                          </span>
                        )}
                      </th>
                      <td className="text-center px-2 py-2">{caixa(g.visualizar, `Visualizar ${rotulo}`)}</td>
                      <td className="text-center px-2 py-2">{caixa(g.gerenciar, `Gerenciar ${rotulo}`)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-caption text-ink-3">Gerenciar já inclui visualizar. Quem não visualiza um módulo nem vê ele no menu.</p>

          {sensiveis.length > 0 && (
            <section aria-labelledby="sensiveis" className="rounded-field border border-border overflow-hidden">
              <div className="hazard h-2.5" aria-hidden />
              <div className="p-4 flex flex-col gap-3 bg-surface-2">
                <div className="flex items-start gap-2.5">
                  <TriangleAlert className="size-5 text-warn flex-none mt-0.5" aria-hidden />
                  <div className="flex flex-col">
                    <h3 id="sensiveis" className="m-0 text-[17px] font-semibold">Permissões sensíveis</h3>
                    <span className="text-[13.5px] text-ink-2">Mexem com dinheiro, custo e decisões que não voltam atrás. Não vêm junto com o módulo: libere uma a uma, só para quem precisa.</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sensiveis.map((p) => (
                    gerencia ? (
                      <Toggle key={p.chave} label={ROTULO_SENSIVEL[p.chave] ?? p.descricao ?? p.chave} descricao={p.descricao} value={sel.has(p.chave)} onChange={(v) => marcar(p.chave, v)} />
                    ) : (
                      <div key={p.chave} className="flex items-center gap-3 p-3 rounded-field bg-surface-1 border border-border">
                        <span className="flex-1 flex flex-col"><span className="font-medium">{ROTULO_SENSIVEL[p.chave] ?? p.chave}</span><span className="text-caption text-ink-3">{p.descricao}</span></span>
                        {sel.has(p.chave) ? <Pill tom="warn">Liberada</Pill> : <Pill>Bloqueada</Pill>}
                      </div>
                    )
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
