import { dec } from '@promec/motor';
import { temPermissao } from '../acesso/permissoes';
import { tt } from '../comum/decimal';
import { custoRealDa, horasEntre, incluirOs } from '../ordens/custo';
import { hojeLocal, dataBanco } from '../planejamento/calendario';
import { saldosDosItens } from '../suprimentos/itens.service';
import { Db } from '../tabelas-custos/entrada';

export type TipoNotificacao = 'INFO' | 'ATENCAO' | 'ERRO' | 'SUCESSO';

/** Notifica quem tem alguma das permissões (e os usuários citados); com `chave`, não repete para o mesmo usuário. */
export async function notificar(
  db: Db,
  tenantId: string,
  n: { permissoes: string[]; usuarioIds?: (string | null | undefined)[]; tipo: TipoNotificacao; titulo: string; mensagem: string; link?: string; chave?: string }
) {
  const usuarios = await db.usuario.findMany({ where: { tenantId, ativo: true }, include: { perfil: true } });
  const extra = new Set(n.usuarioIds?.filter(Boolean) as string[]);
  const alvos = usuarios.filter((u) => extra.has(u.id) || (u.perfil && n.permissoes.some((p) => temPermissao(u.perfil!.permissoes, p))));
  let criadas = 0;
  for (const u of alvos) {
    if (n.chave && (await db.notificacao.findFirst({ where: { tenantId, usuarioId: u.id, chave: n.chave } }))) continue;
    await db.notificacao.create({ data: { tenantId, usuarioId: u.id, tipo: n.tipo, titulo: n.titulo, mensagem: n.mensagem, link: n.link ?? null, chave: n.chave ?? null } });
    criadas++;
  }
  return criadas;
}

/** Varredura da rotina diária: OS parada, estouro de horas, estoque baixo, título vencido e tabela desatualizada. */
export async function notificacoesDaRotina(db: Db, tenantId: string) {
  let n = 0;
  const hoje = hojeLocal();
  const ordens = await db.ordemServico.findMany({ where: { tenantId, status: { in: ['EM_EXECUCAO', 'PAUSADA'] } }, include: incluirOs });
  for (const os of ordens) {
    const pausa = os.ocorrencias.find((o) => o.tipo === 'PAUSA' && !o.fim);
    if (os.status === 'PAUSADA' && pausa && dec(horasEntre(pausa.inicio, new Date())).gt(4)) {
      n += await notificar(db, tenantId, {
        permissoes: ['os.visualizar'],
        tipo: 'ATENCAO',
        titulo: `${os.numero} parada há mais de 4 h`,
        mensagem: `${os.titulo} está pausada${pausa.motivo ? ` por ${pausa.motivo.toLowerCase().replace('_', ' ')}` : ''}. Resolva a causa ou avise o cliente.`,
        link: `/ordens-servico/${os.id}`,
        chave: `os-parada-${pausa.id}`
      });
    }
    for (const op of custoRealDa(os).operacoes.filter((o) => o.estouro)) {
      n += await notificar(db, tenantId, {
        permissoes: ['os.visualizar'],
        tipo: 'ERRO',
        titulo: `Estouro de horas na ${os.numero}`,
        mensagem: `${op.descricao} passou das horas orçadas em mais de 20%.`,
        link: `/ordens-servico/${os.id}`,
        chave: `estouro-${op.id}`
      });
    }
  }
  const itens = await db.item.findMany({ where: { tenantId, ativo: true, estoqueMinimo: { gt: 0 } } });
  const saldos = await saldosDosItens(db, tenantId, itens.map((i) => i.id));
  for (const i of itens.filter((x) => saldos.get(x.id)!.disponivel.lt(tt(x.estoqueMinimo)))) {
    n += await notificar(db, tenantId, {
      permissoes: ['estoque.visualizar', 'compras.visualizar'],
      tipo: 'ATENCAO',
      titulo: `${i.descricao} abaixo do mínimo`,
      mensagem: `Disponível ${saldos.get(i.id)!.disponivel.toFixed()} ${i.unidadeConsumo}, mínimo ${tt(i.estoqueMinimo)}. Gere a requisição pelo ponto de pedido.`,
      link: '/estoque/saldos?abaixoDoMinimo=true',
      chave: `estoque-minimo-${i.id}-${hoje.slice(0, 7)}`
    });
  }
  const vencidos = await db.titulo.findMany({ where: { tenantId, status: { in: ['ABERTO', 'PARCIAL'] }, vencimento: { lt: dataBanco(hoje) } } });
  for (const t of vencidos) {
    n += await notificar(db, tenantId, {
      permissoes: ['financeiro.visualizar'],
      tipo: 'ATENCAO',
      titulo: `${t.numero} vencido`,
      mensagem: `${t.tipo === 'RECEBER' ? 'A receber de' : 'A pagar para'} ${t.pessoaNome}: ${t.descricao}.`,
      link: `/financeiro/titulos/${t.id}`,
      chave: `titulo-vencido-${t.id}`
    });
  }
  const vigente = await db.tabelaCustos.findFirst({ where: { tenantId, status: 'VIGENTE', desatualizada: true } });
  if (vigente) {
    n += await notificar(db, tenantId, {
      permissoes: ['custos.visualizar'],
      tipo: 'ATENCAO',
      titulo: 'Tabela de Custos desatualizada',
      mensagem: `Cadastros que alimentam o custo mudaram desde a publicação da ${vigente.competencia} v${vigente.versao}. Gere uma nova versão e publique.`,
      link: `/tabelas-custos/${vigente.id}`,
      chave: `tabela-desatualizada-${vigente.id}-${hoje}`
    });
  }
  return n;
}
