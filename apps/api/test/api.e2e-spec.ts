import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { reais } from '@promec/motor';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { completarCnpj } from '../src/comum/documento';
import { configurar } from '../src/configurar';
import { semearEmpresa } from '../src/seed/semear';
import { limparLimitePortal } from '../src/portal/limite.guard';
import * as bcrypt from 'bcryptjs';

const SENHA = 'senha-de-teste';
const sufixo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

describe('API ProMEC (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  let base: Awaited<ReturnType<typeof semearEmpresa>>;
  let outra: Awaited<ReturnType<typeof semearEmpresa>>;
  let token: string;
  let tokenOrcamentista: string;
  let tokenOutra: string;
  let tokenAdmin: string;
  let tokenCarla: string;
  let tokenRicardo: string;

  const http = () => request(app.getHttpServer());
  const api = (t: string) => ({
    get: (url: string) => http().get(`/api/v1${url}`).set('Authorization', `Bearer ${t}`),
    post: (url: string, body: object = {}) => http().post(`/api/v1${url}`).set('Authorization', `Bearer ${t}`).send(body),
    put: (url: string, body: object) => http().put(`/api/v1${url}`).set('Authorization', `Bearer ${t}`).send(body),
    patch: (url: string, body: object) => http().patch(`/api/v1${url}`).set('Authorization', `Bearer ${t}`).send(body)
  });
  const login = async (email: string) => (await http().post('/api/v1/auth/login').send({ email, senha: SENHA }).expect(200)).body.token as string;

  const bucha = () => ({
    clienteId: base.clientes.metalvale,
    titulo: 'Bucha de latão H7 — teste',
    segmento: 'USINAGEM',
    lote: 10,
    impostos: '0.14',
    comissao: '0',
    margemAlvo: '0.20',
    margemMinima: '0.15',
    desconto: '0',
    linhas: [
      { tipo: 'material', descricao: 'Barra de latão C360 Ø25', base: 'peca', quantidade: '1', custoUnitario: '8.00' },
      { tipo: 'operacao', descricao: 'Torneamento', centroId: base.centros.torno, cicloHorasPorPeca: '0.1', setupHorasPorLote: '3' }
    ]
  });

  beforeAll(async () => {
    db = new PrismaClient();
    base = await semearEmpresa(db, { prefixo: `e2e-a-${sufixo}`, nome: 'Usinagem Teste A', dominio: `a-${sufixo}.test`, senha: SENHA });
    outra = await semearEmpresa(db, { prefixo: `e2e-b-${sufixo}`, nome: 'Caldeiraria Teste B', dominio: `b-${sufixo}.test`, senha: SENHA });
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configurar(mod.createNestApplication());
    await app.init();
    token = await login(base.emails.gestor);
    tokenOrcamentista = await login(base.emails.orcamentista);
    tokenOutra = await login(outra.emails.gestor);
    tokenCarla = await login(base.emails.financeiro);
    tokenRicardo = await login(base.emails.producao);
    const admin = await db.perfil.findFirstOrThrow({ where: { tenantId: base.tenantId, nome: 'Administrador' } });
    await db.usuario.create({
      data: { tenantId: base.tenantId, nome: 'Admin Teste', email: `admin@a-${sufixo}.test`, senhaHash: await bcrypt.hash(SENHA, 10), papel: 'ADMIN', perfilId: admin.id }
    });
    tokenAdmin = await login(`admin@a-${sufixo}.test`);
  });

  afterAll(async () => {
    const ids = [base?.tenantId, outra?.tenantId].filter(Boolean);
    await db.ordemServico.deleteMany({ where: { tenantId: { in: ids } } });
    await db.orcamento.deleteMany({ where: { tenantId: { in: ids } } });
    await db.empresa.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
    await app?.close();
  });

  describe('auth', () => {
    it('entra e devolve o usuário', async () => {
      const r = await http().post('/api/v1/auth/login').send({ email: base.emails.gestor, senha: SENHA }).expect(200);
      expect(r.body.token).toEqual(expect.any(String));
      expect(r.body.usuario).toMatchObject({ nome: 'Marina Kowalski', papel: 'ADMIN', perfil: expect.objectContaining({ nome: 'Administrador' }), email: base.emails.gestor });
    });

    it('recusa senha errada com CREDENCIAIS', async () => {
      const r = await http().post('/api/v1/auth/login').send({ email: base.emails.gestor, senha: 'errada' }).expect(401);
      expect(r.body).toMatchObject({ codigo: 'CREDENCIAIS', mensagem: expect.any(String) });
    });

    it('exige token e responde no formato de erro do contrato', async () => {
      const r = await http().get('/api/v1/painel').expect(401);
      expect(r.body.codigo).toBe('NAO_AUTENTICADO');
    });

    it('GET /auth/me traz a empresa', async () => {
      const r = await api(token).get('/auth/me').expect(200);
      expect(r.body.empresa).toEqual({ id: base.tenantId, nome: 'Usinagem Teste A' });
    });
  });

  describe('tabelas de custos', () => {
    it('vigente reproduz a planilha: 117,78 cheio, 44,44 rateio, 73,33 específico', async () => {
      const r = await api(token).get('/tabelas-custos/vigente').expect(200);
      expect(r.body.status).toBe('VIGENTE');
      expect(r.body.resultado.centros).toHaveLength(3);
      for (const c of r.body.resultado.centros) {
        expect(reais(c.cheioHora)).toBe('117.78');
        expect(reais(c.rateioHora)).toBe('44.44');
        expect(reais(c.especificoHora)).toBe('73.33');
      }
      expect(r.body.resultado.custoFixoTotal).toBe('22000');
      expect(r.body.comparativo).toHaveLength(3);
    });

    it('bloqueia a publicação com custo fixo zerado (409 BLOQUEIOS)', async () => {
      const rascunho = await api(token).post('/tabelas-custos', { competencia: '2027-01' }).expect(201);
      expect(rascunho.body.status).toBe('RASCUNHO');
      const r = await api(token).post(`/tabelas-custos/${rascunho.body.id}/publicar`).expect(409);
      expect(r.body.codigo).toBe('BLOQUEIOS');
      expect(r.body.detalhes.map((o: { codigo: string }) => o.codigo)).toContain('CUSTO_FIXO_ZERO');
      await api(token).get('/tabelas-custos/vigente').expect(200).expect((v) => expect(v.body.id).toBe(base.tabelaVigenteId));
      await http().delete(`/api/v1/tabelas-custos/${rascunho.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    });

    it('alterar o custo fixo da competência vigente marca a tabela como desatualizada', async () => {
      await api(tokenOutra).post('/custo-fixo', { competencia: '2026-10', categoria: 'outros', descricao: 'Ajuste', valor: '100' }).expect(201);
      const r = await api(tokenOutra).get('/tabelas-custos/vigente').expect(200);
      expect(r.body.desatualizada).toBe(true);
      expect(r.body.resultado.custoFixoTotal).toBe('22000');
    });
  });

  describe('orçamentos', () => {
    it('simula a bucha sem gravar: custo 551,11 e preço 835,02', async () => {
      const antes = await db.orcamento.count({ where: { tenantId: base.tenantId } });
      const r = await api(token).post('/orcamentos/simular', bucha()).expect(200);
      expect(reais(r.body.custoLote)).toBe('551.11');
      expect(reais(r.body.precoFinalLote)).toBe('835.02');
      expect(await db.orcamento.count({ where: { tenantId: base.tenantId } })).toBe(antes);
    });

    it('o seed traz ORC-2026-00128 a R$ 793,27 com margem efetiva perto de 16,5%', async () => {
      const r = await api(token).get(`/orcamentos/${base.orcamentoBuchaId}`).expect(200);
      expect(r.body.numero).toBe('ORC-2026-00128');
      expect(reais(r.body.precoFinalLote)).toBe('793.27');
      expect(Number(r.body.margemEfetiva)).toBeCloseTo(0.165, 3);
      expect(r.body.tabelaMaisNova).toBe(false);
    });

    it('cria, barra o envio abaixo da margem mínima, libera como gestor e envia', async () => {
      const criado = await api(tokenOrcamentista).post('/orcamentos', { ...bucha(), desconto: '0.10' }).expect(201);
      expect(criado.body).toMatchObject({ status: 'RASCUNHO', versao: 1, numero: 'ORC-2026-00129', exigeAprovacao: true });
      expect(criado.body.linhas[1].custoHora).toBe('117.7777777778');
      const id = criado.body.id;

      const barrado = await api(tokenOrcamentista).post(`/orcamentos/${id}/enviar`).expect(409);
      expect(barrado.body.codigo).toBe('MARGEM_ABAIXO_MINIMO');

      await api(tokenOrcamentista).post(`/orcamentos/${id}/liberar-margem`, { justificativa: 'Cliente estratégico' }).expect(403);
      await api(token).post(`/orcamentos/${id}/liberar-margem`, { justificativa: 'Cliente estratégico, lote piloto' }).expect(200);

      const enviado = await api(tokenOrcamentista).post(`/orcamentos/${id}/enviar`).expect(200);
      expect(enviado.body.status).toBe('ENVIADO');

      await api(token).put(`/orcamentos/${id}`, bucha()).expect(409);
      await api(token).post(`/orcamentos/${id}/negociar`).expect(200);
      const v2 = await api(token).put(`/orcamentos/${id}`, bucha()).expect(200);
      expect(v2.body).toMatchObject({ versao: 2, status: 'EM_NEGOCIACAO', exigeAprovacao: false });
      expect(reais(v2.body.precoFinalLote)).toBe('835.02');

      await api(token).post(`/orcamentos/${id}/enviar`).expect(200);
      const aprovado = await api(token).post(`/orcamentos/${id}/aprovar`).expect(200);
      expect(aprovado.body.status).toBe('APROVADO');
      expect(aprovado.body.historico.map((h: { versao: number }) => h.versao)).toEqual([1, 1, 1, 1, 2, 2, 2]);
      await api(token).put(`/orcamentos/${id}`, bucha()).expect(409);
    });

    it('lista com contagem por status', async () => {
      const r = await api(token).get('/orcamentos?status=RASCUNHO').expect(200);
      expect(r.body.itens.every((o: { status: string }) => o.status === 'RASCUNHO')).toBe(true);
      expect(r.body.contagem).toMatchObject({ ENVIADO: 1, EM_NEGOCIACAO: 1, RECUSADO: 1 });
    });

    it('orçamento de tabela anterior avisa tabelaMaisNova e atualiza custos em nova versão', async () => {
      const id = `e2e-a-${sufixo}-orcamento-126`;
      const antes = await api(token).get(`/orcamentos/${id}`).expect(200);
      expect(antes.body.tabelaMaisNova).toBe(true);
      const depois = await api(token).post(`/orcamentos/${id}/atualizar-custos`).expect(200);
      expect(depois.body).toMatchObject({ tabelaMaisNova: false, versao: antes.body.versao + 1 });
      expect(depois.body.tabelaCustos.id).toBe(base.tabelaVigenteId);
    });
  });

  describe('isolamento entre empresas', () => {
    it('outra empresa não enxerga o orçamento', async () => {
      const r = await api(tokenOutra).get(`/orcamentos/${base.orcamentoBuchaId}`).expect(404);
      expect(r.body.codigo).toBe('NAO_ENCONTRADO');
      await api(tokenOutra).post(`/orcamentos/${base.orcamentoBuchaId}/aprovar`).expect(404);
      const lista = await api(tokenOutra).get('/orcamentos?q=Teste A').expect(200);
      expect(lista.body.itens.some((o: { id: string }) => o.id.startsWith(`e2e-a-`))).toBe(false);
    });

    it('não usa cliente de outra empresa', async () => {
      await api(tokenOutra).post('/orcamentos', { ...bucha(), linhas: bucha().linhas.slice(0, 1) }).expect(404);
    });
  });

  describe('cadastros', () => {
    it('valida CNPJ e barra documento duplicado', async () => {
      const cliente = { tipo: 'PJ', nome: 'Cliente Novo Ltda.', documento: completarCnpj('551234560001') };
      await api(token).post('/clientes', { ...cliente, documento: '12345678000100' }).expect(400);
      await api(token).post('/clientes', cliente).expect(201);
      const dup = await api(token).post('/clientes', cliente).expect(409);
      expect(dup.body.codigo).toBe('DOCUMENTO_DUPLICADO');
      await api(tokenOutra).post('/clientes', cliente).expect(201);
    });

    it('colaborador traz custo mensal e custo-hora calculados', async () => {
      const r = await api(token).get('/colaboradores').expect(200);
      const ricardo = r.body.itens.find((c: { nome: string }) => c.nome === 'Ricardo Lima');
      expect(ricardo).toMatchObject({ custoMensal: '8200', custoHora: '37.2727272727', alocacoes: [{ alocacao: '1', centroNome: 'Torno CNC de entrada' }] });
    });

    it('rejeita alocação acima de 100%', async () => {
      const colaboradores = await api(token).get('/colaboradores').expect(200);
      const ricardo = colaboradores.body.itens.find((c: { nome: string }) => c.nome === 'Ricardo Lima');
      const r = await api(token).patch(`/centros-trabalho/${base.centros.fresa}`, { operadores: [{ colaboradorId: ricardo.id, alocacao: '0.5' }] }).expect(422);
      expect(r.body.codigo).toBe('ALOCACAO_EXCEDIDA');
    });

    it('validação responde 400 com detalhes por campo', async () => {
      const r = await api(token).post('/colaboradores', { nome: '', salario: 'abc' }).expect(400);
      expect(r.body.codigo).toBe('VALIDACAO');
      expect(r.body.detalhes.map((d: { campo: string }) => d.campo)).toEqual(expect.arrayContaining(['nome', 'salario']));
    });

    it('prévia dos centros calcula sem gravar', async () => {
      const r = await api(token).get('/centros-trabalho/previa?competencia=2026-10').expect(200);
      expect(r.body.centros.map((c: { id: string }) => c.id)).toContain(base.box3);
      const box = await api(token).get(`/centros-trabalho/${base.box3}`).expect(200);
      expect(box.body).toMatchObject({ custoHoraVigente: null, diasSemana: [1, 2, 3, 4, 5, 6], aviso: expect.stringContaining('próxima versão') });
    });
  });

  describe('ordens de serviço', () => {
    const del = (t: string, url: string) => http().delete(`/api/v1${url}`).set('Authorization', `Bearer ${t}`);

    it('OS-2026-00041 da bucha projeta 4,35 h e margem perto de 11,3%', async () => {
      const r = await api(token).get(`/ordens-servico/${base.ordens[41]}`).expect(200);
      expect(r.body).toMatchObject({ numero: 'OS-2026-00041', status: 'EM_EXECUCAO', orcamento: { numero: 'ORC-2026-00121' } });
      expect(reais(r.body.resultado.horasProjetadas)).toBe('4.35');
      expect(Number(r.body.resultado.margemProjetada)).toBeCloseTo(0.113, 3);
      expect(r.body.operacoes[0]).toMatchObject({ colaboradorNome: 'Ricardo Lima', setupRealHoras: '3.4', producaoRealHoras: '0.38', quantidadeBoa: 4, setupConcluido: true });
      const lista = await api(token).get('/ordens-servico').expect(200);
      expect(lista.body.contagem).toMatchObject({ EM_EXECUCAO: 1, PAUSADA: 1, EM_FILA: 1, CONTROLE_QUALIDADE: 1, ENTREGUE: 1, ATRASADAS: 1 });
      const item = lista.body.itens.find((o: { id: string }) => o.id === base.ordens[41]);
      expect(item).toMatchObject({ centroAtual: 'Torno CNC de entrada', operadorAtual: 'Ricardo Lima', margemProjetada: r.body.resultado.margemProjetada });
    });

    it('fila do operador e apontamentos abertos', async () => {
      const fila = await api(token).get(`/operador/fila?colaboradorId=${base.colaboradores.ricardo}`).expect(200);
      expect(fila.body.itens[0].os.prioridade).toBe('URGENTE');
      const op41 = fila.body.itens.find((o: { os: { id: string } }) => o.os.id === base.ordens[41]);
      expect(op41.apontamentoAberto).toMatchObject({ tipo: 'PRODUCAO', fim: null });
      const abertos = await api(token).get(`/apontamentos/abertos?colaboradorId=${base.colaboradores.ricardo}`).expect(200);
      expect(abertos.body.total).toBe(1);
    });

    it('converte, executa com pausa, reprova com retrabalho, aprova e entrega', async () => {
      const orc = await api(token).post('/orcamentos', bucha()).expect(201);
      await api(token).post(`/orcamentos/${orc.body.id}/converter`).expect(409);
      await api(token).post(`/orcamentos/${orc.body.id}/enviar`).expect(200);
      await api(token).post(`/orcamentos/${orc.body.id}/aprovar`).expect(200);
      const os = await api(token).post(`/orcamentos/${orc.body.id}/converter`, { prazo: '2030-01-15' }).expect(201);
      expect(os.body).toMatchObject({ numero: 'OS-2026-00042', status: 'EM_FILA', prazo: '2030-01-15' });
      expect(os.body.operacoes[0]).toMatchObject({ sequencia: 10, custoHora: '117.7777777778', setupOrcadoHoras: '3', cicloOrcadoHorasPorPeca: '0.1' });
      expect(os.body.custos[0]).toMatchObject({ categoria: 'material', orcado: '80', real: null });
      await api(token).get(`/orcamentos/${orc.body.id}`).expect((r) => expect(r.body.status).toBe('CONVERTIDO'));

      const id = os.body.id;
      const opId = os.body.operacoes[0].id;
      const ab = await api(token).post(`/ordens-servico/${id}/operacoes/${opId}/iniciar`, { colaboradorId: base.colaboradores.ricardo, tipo: 'SETUP' }).expect(409);
      expect(ab.body.codigo).toBe('APONTAMENTO_ABERTO');
      const nh = await api(token).post(`/ordens-servico/${id}/operacoes/${opId}/iniciar`, { colaboradorId: base.colaboradores.diego, tipo: 'SETUP' }).expect(422);
      expect(nh.body.codigo).toBe('NAO_HABILITADO');

      const marcos = await api(token).post('/colaboradores', { nome: 'Marcos Teixeira', salario: '4200', encargos: '2700' }).expect(201);
      const semHab = await api(token).patch(`/colaboradores/${marcos.body.id}`, { alocacoes: [{ centroId: base.centros.torno, alocacao: '1' }] }).expect(422);
      expect(semHab.body.codigo).toBe('SEM_HABILITACAO');
      await api(token).post('/rh/habilitacoes', { colaboradorId: marcos.body.id, centroId: base.centros.torno, descricao: 'Operação de torno CNC', emissao: '2026-01-05', validade: '2030-12-31' }).expect(201);
      await api(token).patch(`/colaboradores/${marcos.body.id}`, { alocacoes: [{ centroId: base.centros.torno, alocacao: '1' }] }).expect(200);
      const quem = { colaboradorId: marcos.body.id };
      const url = (acao: string) => `/ordens-servico/${id}/operacoes/${opId}/${acao}`;

      let r = await api(token).post(url('iniciar'), { ...quem, tipo: 'SETUP' }).expect(200);
      expect(r.body.status).toBe('EM_EXECUCAO');
      r = await api(token).post(url('parar'), { encerrarSetup: true }).expect(200);
      expect(r.body.operacoes[0]).toMatchObject({ setupConcluido: true, status: 'EM_ANDAMENTO' });
      expect(r.body.apontamentos[0].fim).not.toBeNull();

      await api(token).post(url('iniciar'), { ...quem, tipo: 'PRODUCAO' }).expect(200);
      r = await api(token).post(`/ordens-servico/${id}/pausar`, { motivo: 'FALTA_PECA', observacao: 'Barra em falta' }).expect(200);
      expect(r.body).toMatchObject({ status: 'PAUSADA', ocorrencias: [{ tipo: 'PAUSA', motivo: 'FALTA_PECA', fim: null }] });
      expect(r.body.apontamentos.every((a: { fim: string | null }) => a.fim)).toBe(true);
      await api(token).post(url('iniciar'), { ...quem, tipo: 'PRODUCAO' }).expect(409);
      r = await api(token).post(`/ordens-servico/${id}/retomar`).expect(200);
      expect(r.body.status).toBe('EM_EXECUCAO');
      expect(r.body.ocorrencias[0].horas).not.toBeNull();

      await api(token).post(url('iniciar'), { ...quem, tipo: 'PRODUCAO' }).expect(200);
      r = await api(token).post(url('parar'), { quantidadeBoa: 10, encerrarOperacao: true }).expect(200);
      expect(r.body).toMatchObject({ status: 'CONTROLE_QUALIDADE', operacoes: [{ status: 'CONCLUIDA', quantidadeBoa: 10 }] });

      const semObs = await api(token).post(`/ordens-servico/${id}/inspecao`, { aprovada: false, itens: [] }).expect(422);
      expect(semObs.body.codigo).toBe('OBSERVACAO_OBRIGATORIA');
      expect(r.body.planoInspecao).toMatchObject({ nome: 'Dimensional — bucha H7', versao: 2 });
      const furo = r.body.planoInspecao.itens.find((i: { descricao: string }) => i.descricao === 'Furo Ø20 H7');
      const semMedida = await api(token).post(`/ordens-servico/${id}/inspecao`, { itens: [{ planoItemId: furo.id, descricao: 'Furo Ø20 H7' }] }).expect(422);
      expect(semMedida.body.codigo).toBe('MEDICAO_OBRIGATORIA');
      r = await api(token)
        .post(`/ordens-servico/${id}/inspecao`, {
          inspetor: 'Marina Kowalski',
          observacao: 'Furo H7 acima da tolerância em 2 peças',
          centroRetrabalhoId: base.centros.torno,
          itens: [
            { planoItemId: furo.id, descricao: 'Furo Ø20 H7', medido: '20,030' },
            { descricao: 'Acabamento sem rebarba', conforme: true }
          ]
        })
        .expect(200);
      expect(r.body.status).toBe('EM_EXECUCAO');
      expect(r.body.inspecoes[0]).toMatchObject({ aprovada: false, inspetor: 'Marina Kowalski', itens: [{ conforme: false, minimo: '20', maximo: '20.021' }, { conforme: true }] });
      expect(r.body.ncs).toEqual([expect.objectContaining({ origem: 'PROCESSO', status: 'ABERTA' })]);
      const ncId = r.body.ncs[0].id;
      const retrabalho = r.body.operacoes.find((o: { retrabalho: boolean }) => o.retrabalho);
      expect(retrabalho).toMatchObject({ sequencia: 20, status: 'PENDENTE', centroId: base.centros.torno });

      const urlR = (acao: string) => `/ordens-servico/${id}/operacoes/${retrabalho.id}/${acao}`;
      await api(token).post(urlR('iniciar'), { ...quem, tipo: 'PRODUCAO' }).expect(200);
      r = await api(token).post(urlR('parar'), { quantidadeBoa: 2, encerrarOperacao: true }).expect(200);
      expect(r.body.status).toBe('CONTROLE_QUALIDADE');
      r = await api(token).post(`/ordens-servico/${id}/inspecao`, { aprovada: true, itens: [{ descricao: 'Furo Ø20 H7', conforme: true }] }).expect(200);
      expect(r.body.status).toBe('CONCLUIDA');
      const bloqueada = await api(token).post(`/ordens-servico/${id}/entregar`, { recebidoPor: 'Carlos' }).expect(409);
      expect(bloqueada.body.codigo).toBe('NC_ABERTA');
      const tratada = await api(token).patch(`/qualidade/ncs/${ncId}`, { causa: 'Alargador gasto', acaoCorretiva: 'Troca do alargador e conferência a cada 20 peças' }).expect(200);
      expect(tratada.body.status).toBe('EM_TRATAMENTO');
      r = await api(token).post(`/ordens-servico/${id}/entregar`, { recebidoPor: 'Carlos, compras da Metalúrgica Vale' }).expect(200);
      expect(r.body).toMatchObject({ status: 'ENTREGUE', recebidoPor: 'Carlos, compras da Metalúrgica Vale' });
      expect(r.body.custoRealFinal).toBe(r.body.resultado.custoReal);
      expect(r.body.desvioFinal).toBe(r.body.resultado.desvioCusto);
      expect(r.body.historico.map((h: { evento: string }) => h.evento)).toEqual([
        'criada', 'execucao_iniciada', 'pausada', 'retomada', 'operacoes_encerradas', 'inspecao_reprovada', 'operacoes_encerradas', 'inspecao_aprovada', 'entregue'
      ]);
      await api(token).patch(`/ordens-servico/${id}`, { titulo: 'Outro' }).expect(409);
    });

    it('serviço rápido acima do limite exige orçamento; abaixo nasce ABERTA', async () => {
      const corpo = {
        clienteId: base.clientes.metalvale,
        titulo: 'Recuperação de rosca do eixo',
        segmento: 'USINAGEM',
        lote: 1,
        prazo: '2030-02-01',
        objeto: { desenho: 'AVULSO', placa: 'ignorada?' },
        operacoes: [{ descricao: 'Recuperar rosca', centroId: base.centros.torno, setupOrcadoHoras: '0.5', cicloOrcadoHorasPorPeca: '1' }],
        custos: [{ descricao: 'Inserto', categoria: 'ferramental', orcado: '40' }]
      };
      const caro = await api(token).post('/ordens-servico', { ...corpo, precoFinalLote: '1500.01' }).expect(422);
      expect(caro.body.codigo).toBe('EXIGE_ORCAMENTO');
      const os = await api(token).post('/ordens-servico', { ...corpo, precoFinalLote: '420' }).expect(201);
      expect(os.body).toMatchObject({ status: 'ABERTA', orcamento: null, numero: 'OS-2026-00043' });
      expect(os.body.objeto).toMatchObject({ desenho: 'AVULSO', revisao: null });
      const ini = await api(token).post(`/ordens-servico/${os.body.id}/operacoes/${os.body.operacoes[0].id}/iniciar`, { colaboradorId: base.colaboradores.ricardo, tipo: 'SETUP' }).expect(409);
      expect(ini.body.codigo).toBe('STATUS_INVALIDO');
      await api(token).post(`/ordens-servico/${os.body.id}/liberar`).expect(200).expect((r) => expect(r.body.status).toBe('EM_FILA'));

      const patch = await api(token).patch(`/ordens-servico/${os.body.id}/operacoes/${os.body.operacoes[0].id}`, { setupOrcadoHoras: '0.75' }).expect(200);
      expect(patch.body.operacoes[0].setupOrcadoHoras).toBe('0.75');
      await api(tokenOrcamentista).post(`/ordens-servico/${os.body.id}/cancelar`, { motivo: 'Cliente desistiu' }).expect(403);
      const c = await api(token).post(`/ordens-servico/${os.body.id}/cancelar`, { motivo: 'Cliente desistiu' }).expect(200);
      expect(c.body).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'Cliente desistiu' });
    });

    it('exige justificativa para operação fora do orçado e custo acima de 20%', async () => {
      const id = base.ordens[41];
      const op = { descricao: 'Rebarbação manual', centroId: base.centros.torno, setupOrcadoHoras: '0', cicloOrcadoHorasPorPeca: '0.05' };
      const semJust = await api(token).post(`/ordens-servico/${id}/operacoes`, op).expect(422);
      expect(semJust.body.codigo).toBe('JUSTIFICATIVA_OBRIGATORIA');
      const comJust = await api(token).post(`/ordens-servico/${id}/operacoes`, { ...op, justificativa: 'Rebarba no furo cruzado' }).expect(201);
      const nova = comJust.body.operacoes.find((o: { descricao: string }) => o.descricao === 'Rebarbação manual');
      expect(nova).toMatchObject({ orcada: false, sequencia: 20 });
      await del(token, `/ordens-servico/${id}/operacoes/${nova.id}`).expect(200);

      const material = comJust.body.custos[0];
      const alto = await api(token).patch(`/ordens-servico/${id}/custos/${material.id}`, { real: '120' }).expect(422);
      expect(alto.body.codigo).toBe('JUSTIFICATIVA_OBRIGATORIA');
      await api(token).patch(`/ordens-servico/${id}/custos/${material.id}`, { real: '95' }).expect(200);
      await api(token).patch(`/ordens-servico/${id}/custos/${material.id}`, { real: '120', justificativa: 'Latão subiu 40% no fornecedor' }).expect(200);
      await api(token).post(`/ordens-servico/${id}/custos`, { descricao: 'Broca Ø19,8', categoria: 'ferramental', orcado: '0', real: '65' }).expect(422);
      const novo = await api(token).post(`/ordens-servico/${id}/custos`, { descricao: 'Broca Ø19,8', categoria: 'ferramental', orcado: '0', real: '65', justificativa: 'Broca quebrou' }).expect(201);
      const broca = novo.body.custos.find((c: { descricao: string }) => c.descricao === 'Broca Ø19,8');
      await del(token, `/ordens-servico/${id}/custos/${material.id}`).expect(409);
      await del(token, `/ordens-servico/${id}/custos/${broca.id}`).expect(200);
    });

    it('isola as OS entre empresas', async () => {
      await api(tokenOutra).get(`/ordens-servico/${base.ordens[41]}`).expect(404);
      await api(tokenOutra).post(`/ordens-servico/${base.ordens[41]}/pausar`, { motivo: 'OUTRO' }).expect(404);
      const lista = await api(tokenOutra).get('/ordens-servico').expect(200);
      expect(lista.body.itens.some((o: { id: string }) => o.id.startsWith('e2e-a-'))).toBe(false);
      const fila = await api(tokenOutra).get(`/operador/fila?colaboradorId=${base.colaboradores.ricardo}`).expect(404);
      expect(fila.body.codigo).toBe('NAO_ENCONTRADO');
      const abertos = await api(tokenOutra).get('/apontamentos/abertos').expect(200);
      expect(abertos.body.itens.some((a: { os: { id: string } }) => a.os.id.startsWith('e2e-a-'))).toBe(false);
    });
  });

  describe('planejamento e agenda', () => {
    const del = (t: string, url: string) => http().delete(`/api/v1${url}`).set('Authorization', `Bearer ${t}`);
    type Centro = { id: string; tipo: string; dias: { data: string; capacidade: string }[]; semanas: { ocupacao: string; sobrecarga: boolean }[] };
    const capacidade = (b: { centros: Centro[] }, centroId: string, data: string) => b.centros.find((c) => c.id === centroId)!.dias.find((d) => d.data === data)!.capacidade;

    it('programa a fila com sobrecarga no torno e atraso', async () => {
      const r = await api(token).get('/planejamento?horizonte=60').expect(200);
      expect(r.body.hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.body.filaManual).toBe(false);
      const os40 = r.body.ordens.find((o: { id: string }) => o.id === base.ordens[40]);
      expect(os40).toMatchObject({ atrasada: true, ref: { tipo: 'OS', numero: 'OS-2026-00040', prioridade: 'URGENTE' } });
      expect(os40.operacoes[0]).toMatchObject({ descricao: 'Torneamento', centroNome: 'Torno CNC de entrada' });
      const provisoria = r.body.ordens.find((o: { id: string }) => o.id === base.orcamentoProvisorioId);
      expect(provisoria).toMatchObject({ provisoria: true, ref: { tipo: 'ORCAMENTO', numero: 'ORC-2026-00122' } });
      expect(r.body.centros.find((c: Centro) => c.id === base.centros.torno).tipo).toBe('maquina');
      expect(r.body.alertas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tipo: 'sobrecarga', centroId: base.centros.torno }),
          expect.objectContaining({ tipo: 'atraso', ordemId: base.ordens[40] })
        ])
      );
      const painel = await api(token).get('/painel').expect(200);
      expect(painel.body.ocupacao.find((c: { centroId: string }) => c.centroId === base.centros.torno)).toMatchObject({ semanaAtual: expect.any(String), proximaSemana: expect.any(String) });
    });

    it('fila manual por PUT e volta ao automático por DELETE', async () => {
      const r = await api(tokenOrcamentista).put('/planejamento/fila', { ordem: [base.ordens[41], base.ordens[39]] }).expect(200);
      expect(r.body.filaManual).toBe(true);
      expect(r.body.ordens.slice(0, 2).map((o: { id: string }) => o.id)).toEqual([base.ordens[41], base.ordens[39]]);
      await api(tokenOutra).put('/planejamento/fila', { ordem: [base.ordens[41]] }).expect(404);
      const auto = await del(token, '/planejamento/fila').expect(200);
      expect(auto.body.filaManual).toBe(false);
      expect(auto.body.ordens[0].id).not.toBe(base.ordens[41]);
    });

    it('promete prazo para um orçamento sem gravar', async () => {
      const p = await api(token).post('/planejamento/promessa', { orcamentoId: base.orcamentoBuchaId }).expect(200);
      expect(p.body).toMatchObject({ fim: expect.stringMatching(/^\d{4}-/), ocupacaoMaxima: expect.any(String), sobrecarga: expect.any(Boolean), alertas: expect.any(Array) });
      const o = await api(token).get(`/orcamentos/${base.orcamentoBuchaId}`).expect(200);
      expect(o.body.promessa).toEqual({ fim: p.body.fim, ocupacaoMaxima: p.body.ocupacaoMaxima, sobrecarga: p.body.sobrecarga });
      const livre = await api(token).post('/planejamento/promessa', { operacoes: [{ centroId: base.centros.cu, horas: '2' }] }).expect(200);
      expect(livre.body.fim).toEqual(expect.any(String));
    });

    it('feriado e parada zeram a capacidade do dia', async () => {
      const antes = await api(token).get('/planejamento').expect(200);
      const futuro = antes.body.centros.find((c: Centro) => c.id === base.centros.cu).dias.filter((d: { capacidade: string }) => d.capacidade !== '0')[10].data;
      const f = await api(token).post('/feriados', { data: futuro, descricao: 'Aniversário da cidade' }).expect(201);
      await api(token).post('/feriados', { data: futuro, descricao: 'De novo' }).expect(409);
      let r = await api(token).get('/planejamento').expect(200);
      expect(capacidade(r.body, base.centros.cu, futuro)).toBe('0');
      expect(capacidade(r.body, base.centros.torno, futuro)).toBe('0');
      await del(token, `/feriados/${f.body.id}`).expect(200);

      const p = await api(token).post(`/centros-trabalho/${base.centros.cu}/paradas`, { inicio: futuro, fim: futuro, motivo: 'Troca do cabeçote' }).expect(201);
      expect(p.body.sugestoes.map((c: { id: string }) => c.id)).toEqual(expect.arrayContaining([base.centros.torno, base.centros.fresa]));
      r = await api(token).get('/planejamento').expect(200);
      expect(capacidade(r.body, base.centros.cu, futuro)).toBe('0');
      expect(capacidade(r.body, base.centros.torno, futuro)).not.toBe('0');
      await api(tokenOutra).get(`/centros-trabalho/${base.centros.cu}/paradas`).expect(404);
      await del(token, `/centros-trabalho/${base.centros.cu}/paradas/${p.body.id}`).expect(200);
    });

    it('atrasar o prazo da OS exige motivo e registra a reprogramação', async () => {
      const id = base.ordens[39];
      const os = await api(token).get(`/ordens-servico/${id}`).expect(200);
      const depois = new Date(Date.parse(os.body.prazo) + 7 * 86_400_000).toISOString().slice(0, 10);
      const r = await api(token).patch(`/ordens-servico/${id}`, { prazo: depois }).expect(422);
      expect(r.body.codigo).toBe('MOTIVO_OBRIGATORIO');
      const ok = await api(token).patch(`/ordens-servico/${id}`, { prazo: depois, motivoReprogramacao: 'Fornecedor atrasou a barra inox' }).expect(200);
      expect(ok.body.prazo).toBe(depois);
      expect(ok.body.historico.at(-1)).toMatchObject({ evento: 'reprogramada', detalhe: expect.stringContaining('Fornecedor atrasou') });
      await api(token).patch(`/ordens-servico/${id}`, { prazo: os.body.prazo }).expect(200);
    });

    it('agenda valida conflito, habilitação e expediente; chegada abre OS de oficina', async () => {
      const semana = await api(token).get('/agendamentos?de=2000-01-01&ate=2100-01-01').expect(200);
      expect(semana.body.total).toBe(4);
      const marcado = semana.body.itens[0];
      expect(marcado).toMatchObject({ centroNome: 'Box 3 (elevador)', colaboradorNome: 'Jonas Ferreira' });

      const base_ = { clienteId: base.clientes.metalvale, placa: 'mno-5p67', veiculo: 'Ford Ranger 2023', servico: 'Troca de óleo e filtros', centroId: base.box3, duracaoHoras: '1' };
      const choque = await api(token).post('/agendamentos', { ...base_, inicio: marcado.inicio }).expect(409);
      expect(choque.body.codigo).toBe('HORARIO_OCUPADO');
      const nh = await api(token).post('/agendamentos', { ...base_, colaboradorId: base.colaboradores.ricardo, inicio: '2030-01-08T09:00' }).expect(422);
      expect(nh.body.codigo).toBe('NAO_HABILITADO');
      const tarde = await api(token).post('/agendamentos', { ...base_, inicio: '2030-01-08T17:30' }).expect(422);
      expect(tarde.body.codigo).toBe('FORA_DO_EXPEDIENTE');
      await api(token).post('/agendamentos', { ...base_, inicio: '2030-01-06T09:00' }).expect(422);

      const novo = await api(token).post('/agendamentos', { ...base_, colaboradorId: base.jonas, inicio: '2030-01-08T09:00' }).expect(201);
      expect(novo.body).toMatchObject({ status: 'MARCADO', placa: 'MNO5P67', cliente: { id: base.clientes.metalvale } });
      await api(token).post('/agendamentos', { ...base_, inicio: '2030-01-08T09:30' }).expect(409);
      await api(token).patch(`/agendamentos/${novo.body.id}`, { inicio: '2030-01-08T10:00' }).expect(200);
      await api(token).post(`/agendamentos/${novo.body.id}/confirmar`).expect(200);
      const chegou = await api(token).post(`/agendamentos/${novo.body.id}/chegou`, { abrirOs: true }).expect(200);
      expect(chegou.body).toMatchObject({ status: 'CHEGOU', osId: expect.any(String) });
      const os = await api(token).get(`/ordens-servico/${chegou.body.osId}`).expect(200);
      expect(os.body).toMatchObject({ status: 'ABERTA', segmento: 'OFICINA', titulo: 'Troca de óleo e filtros', objeto: { placa: 'MNO5P67', veiculo: 'Ford Ranger 2023' } });
      expect(os.body.operacoes[0]).toMatchObject({ centroId: base.box3, colaboradorNome: 'Jonas Ferreira', setupOrcadoHoras: '1' });
      await api(token).post(`/agendamentos/${novo.body.id}/cancelar`).expect(409);

      const outra = await api(tokenOutra).get('/agendamentos?de=2000-01-01&ate=2100-01-01').expect(200);
      expect(outra.body.itens.some((a: { id: string }) => a.id.startsWith('e2e-a-'))).toBe(false);
      await api(tokenOutra).post(`/agendamentos/${novo.body.id}/confirmar`).expect(404);
    });
  });

  describe('itens, estoque, compras e qualidade', () => {
    const del = (t: string, url: string) => http().delete(`/api/v1${url}`).set('Authorization', `Bearer ${t}`);
    const sup = () => base.suprimentos;
    let itemTeste: string;

    it('custo médio após dois recebimentos, conta a pagar e custo desatualizado no orçamento', async () => {
      const novo = { codigo: 'MP-TESTE-01', descricao: 'Tarugo de bronze TM23 Ø50', tipo: 'MATERIA_PRIMA', unidadeCompra: 'kg', unidadeConsumo: 'kg' };
      const item = await api(token).post('/itens', novo).expect(201);
      itemTeste = item.body.id;
      expect((await api(token).post('/itens', novo).expect(409)).body.codigo).toBe('CODIGO_DUPLICADO');
      expect((await api(token).post('/itens', { ...novo, codigo: 'X', unidadeCompra: 'barra' }).expect(422)).body.codigo).toBe('FATOR_OBRIGATORIO');

      const receber = async (preco: string) => {
        const p = await api(token).post('/compras/pedidos', { fornecedorId: sup().fornecedores.metais, itens: [{ itemId: itemTeste, quantidade: '10', precoUnitario: preco }] }).expect(201);
        expect(p.body.status).toBe('APROVADO');
        return api(token).post(`/compras/pedidos/${p.body.id}/recebimentos`, { localId: sup().locais.mp, notaFiscal: '9001', itens: [{ itemId: itemTeste, quantidade: '10', precoUnitario: preco }] }).expect(201);
      };
      const r1 = await receber('20');
      expect(r1.body).toMatchObject({ status: 'RECEBIDO', recebimentos: [{ divergencias: [], contaPagar: { valor: '200', categoria: 'materiaPrima' } }] });
      expect((await api(token).get(`/itens/${itemTeste}`).expect(200)).body).toMatchObject({ custoMedio: '20', saldo: { fisico: '10' } });

      const orc = await api(token)
        .post('/orcamentos', { ...bucha(), linhas: [{ tipo: 'material', descricao: 'Bronze', base: 'peca', quantidade: '0.5', custoUnitario: '20', itemId: itemTeste }] })
        .expect(201);
      expect(orc.body.custoDesatualizado).toBe(false);
      const r2 = await receber('26');
      expect(r2.body.recebimentos[0].alertas[0]).toContain('orçamento');
      expect((await api(token).get(`/itens/${itemTeste}`).expect(200)).body).toMatchObject({ custoMedio: '23', ultimoCusto: '26', saldo: { fisico: '20' } });
      expect((await api(token).get(`/orcamentos/${orc.body.id}`).expect(200)).body.custoDesatualizado).toBe(true);
      const mov = await api(token).get(`/estoque/movimentos?itemId=${itemTeste}`).expect(200);
      expect(mov.body.itens.map((m: { tipo: string; origem: { tipo: string } }) => [m.tipo, m.origem.tipo])).toEqual([
        ['ENTRADA_RECEBIMENTO', 'RECEBIMENTO'],
        ['ENTRADA_RECEBIMENTO', 'RECEBIMENTO']
      ]);
    });

    it('saída acima do disponível e item rastreável sem lote', async () => {
      const semSaldo = await api(token).post('/estoque/movimentos', { tipo: 'PERDA', itemId: itemTeste, localId: sup().locais.mp, quantidade: '999', motivo: 'Teste' }).expect(422);
      expect(semSaldo.body.codigo).toBe('SALDO_INSUFICIENTE');
      const semLote = await api(token).post('/estoque/movimentos', { tipo: 'PERDA', itemId: sup().itens.latao, localId: sup().locais.mp, quantidade: '1', motivo: 'Queda' }).expect(422);
      expect(semLote.body.codigo).toBe('LOTE_OBRIGATORIO');
      const centro = await api(token).post('/estoque/movimentos', { tipo: 'SAIDA_CENTRO', itemId: sup().itens.oleo, localId: sup().locais.almox, quantidade: '5', centroId: base.centros.torno }).expect(201);
      expect(centro.body).toMatchObject({ quantidade: '-5', origem: { tipo: 'CENTRO' } });
      const consumo = await api(token).get(`/estoque/consumo-centros`).expect(200);
      expect(consumo.body.find((c: { centroId: string }) => c.centroId === base.centros.torno)).toMatchObject({ consumido: '142.5', insumosCadastro: '700' });
    });

    it('reserva na conversão, consumo eleva o custo real, estorno e liberação no cancelamento', async () => {
      const antes = (await api(token).get(`/itens/${sup().itens.latao}`).expect(200)).body.saldo;
      const linhas = [
        { tipo: 'material', descricao: 'Barra de latão C360 Ø25', base: 'peca', quantidade: '0.19', custoUnitario: '42', itemId: sup().itens.latao },
        { tipo: 'operacao', descricao: 'Torneamento', centroId: base.centros.torno, cicloHorasPorPeca: '0.1', setupHorasPorLote: '3' }
      ];
      const orc = await api(token).post('/orcamentos', { ...bucha(), linhas }).expect(201);
      await api(token).post(`/orcamentos/${orc.body.id}/enviar`).expect(200);
      await api(token).post(`/orcamentos/${orc.body.id}/aprovar`).expect(200);
      const os = await api(token).post(`/orcamentos/${orc.body.id}/converter`, { prazo: '2030-02-01' }).expect(201);
      expect(os.body.reservas).toEqual([expect.objectContaining({ itemId: sup().itens.latao, pendente: '1.9', status: 'ATIVA' })]);
      expect(os.body.custos[0]).toMatchObject({ itemId: sup().itens.latao, orcado: '79.8', real: null });
      const reservado = (await api(token).get(`/itens/${sup().itens.latao}`).expect(200)).body.saldo.reservado;
      expect(Number(reservado) - Number(antes.reservado)).toBeCloseTo(1.9, 6);

      const id = os.body.id;
      const semLote = await api(token).post(`/ordens-servico/${id}/consumos`, { itemId: sup().itens.latao, quantidade: '1' }).expect(422);
      expect(semLote.body.codigo).toBe('LOTE_OBRIGATORIO');
      await api(token).post(`/ordens-servico/${id}/consumos`, { itemId: sup().itens.oleo, quantidade: '1' }).expect(422);
      const c = await api(token).post(`/ordens-servico/${id}/consumos`, { itemId: sup().itens.latao, quantidade: '1', loteId: sup().lotes.latao }).expect(201);
      expect(c.body.custos[0].real).toBe('42');
      expect(c.body.reservas[0].pendente).toBe('0.9');
      expect(Number(c.body.resultado.custoReal)).toBeGreaterThan(Number(os.body.resultado.custoReal));
      expect(c.body.consumos).toEqual([expect.objectContaining({ tipo: 'SAIDA_OS', quantidade: '-1', lote: expect.objectContaining({ codigo: '24-8812' }) })]);

      const rast = await api(token).get(`/qualidade/rastreabilidade?loteId=${sup().lotes.latao}`).expect(200);
      expect(rast.body).toMatchObject({ certificado: { corrida: '24-8812' }, fornecedor: { id: sup().fornecedores.metais } });
      expect(rast.body.ordens.map((o: { id: string }) => o.id)).toEqual(expect.arrayContaining([base.ordens[41], id]));
      const inverso = await api(token).get(`/qualidade/rastreabilidade?osId=${base.ordens[41]}`).expect(200);
      expect(inverso.body.lotes[0]).toMatchObject({ codigo: '24-8812', quantidade: '1.9047619048', certificado: { corrida: '24-8812' } });

      const e = await del(token, `/ordens-servico/${id}/consumos/${c.body.consumos[0].id}`).expect(200);
      expect(e.body.custos[0].real).toBeNull();
      expect(e.body.reservas[0].pendente).toBe('1.9');
      await del(token, `/ordens-servico/${id}/consumos/${c.body.consumos[0].id}`).expect(409);
      const cancelada = await api(token).post(`/ordens-servico/${id}/cancelar`, { motivo: 'Teste de reserva' }).expect(200);
      expect(cancelada.body.reservas[0].status).toBe('LIBERADA');
      expect((await api(token).get(`/itens/${sup().itens.latao}`).expect(200)).body.saldo).toEqual(antes);
    });

    it('ponto de pedido não duplica requisição aberta', async () => {
      await api(token).patch(`/itens/${sup().itens.filtro}`, { estoqueMinimo: '20', estoqueMaximo: '30' }).expect(200);
      const r = await api(token).post('/compras/requisicoes/gerar-ponto-pedido').expect(201);
      const itens = r.body.requisicoes.flatMap((q: { itens: { itemId: string; quantidade: string }[] }) => q.itens);
      expect(itens).toEqual([expect.objectContaining({ itemId: sup().itens.filtro, quantidade: '18' })]);
      expect(r.body.requisicoes[0].origem).toBe('PONTO_PEDIDO');
      const de_novo = await api(token).post('/compras/requisicoes/gerar-ponto-pedido').expect(201);
      expect(de_novo.body.total).toBe(0);
    });

    it('cotação compara fornecedores e escolher fora do 1º lugar exige justificativa', async () => {
      const req = (await api(token).get('/compras/requisicoes?status=ABERTA').expect(200)).body.itens.find((q: { itens: { itemId: string }[] }) => q.itens[0].itemId === sup().itens.filtro);
      const cot = await api(token).post('/compras/cotacoes', { requisicaoIds: [req.id], fornecedorIds: [sup().fornecedores.moto, sup().fornecedores.metais] }).expect(201);
      await api(token).post(`/compras/cotacoes/${cot.body.id}/respostas`, { fornecedorId: sup().fornecedores.acos, itens: [{ itemId: sup().itens.filtro, precoUnitario: '1' }], prazoDias: 1 }).expect(422);
      await api(token).post(`/compras/cotacoes/${cot.body.id}/respostas`, { fornecedorId: sup().fornecedores.moto, itens: [{ itemId: sup().itens.filtro, precoUnitario: '14.00' }], prazoDias: 2 }).expect(201);
      const c = await api(token)
        .post(`/compras/cotacoes/${cot.body.id}/respostas`, { fornecedorId: sup().fornecedores.metais, itens: [{ itemId: sup().itens.filtro, precoUnitario: '13.50' }], frete: '0', prazoDias: 10 })
        .expect(201);
      expect(c.body.comparativo[0].resultado).toHaveLength(2);
      expect(c.body.geral.map((g: { posicao: number }) => g.posicao).sort()).toEqual([1, 2]);
      const segundo = c.body.geral.find((g: { posicao: number }) => g.posicao === 2);
      const r = await api(token).post(`/compras/cotacoes/${cot.body.id}/escolher`, { fornecedorId: segundo.fornecedorId }).expect(422);
      expect(r.body.codigo).toBe('JUSTIFICATIVA_OBRIGATORIA');
      const pedido = await api(token).post(`/compras/cotacoes/${cot.body.id}/escolher`, { fornecedorId: segundo.fornecedorId, justificativa: 'Entrega junto com o pedido aberto' }).expect(201);
      expect(pedido.body).toMatchObject({ status: 'APROVADO', cotacaoId: cot.body.id, fornecedor: { id: segundo.fornecedorId } });
      expect((await api(token).get(`/compras/cotacoes/${cot.body.id}`).expect(200)).body.status).toBe('ENCERRADA');
    });

    it('pedido acima da alçada, aprovação e recebimento parcial com divergência', async () => {
      const p = await api(token).post('/compras/pedidos', { fornecedorId: sup().fornecedores.acos, itens: [{ itemId: sup().itens.aco1045, quantidade: '600', precoUnitario: '9.80' }] }).expect(201);
      expect(p.body).toMatchObject({ status: 'AGUARDANDO_APROVACAO', total: '5880' });
      const recebimento = { localId: sup().locais.mp, notaFiscal: '7711', itens: [{ itemId: sup().itens.aco1045, quantidade: '300', precoUnitario: '10.10', lote: { codigo: 'L-1045-1020', certificado: { numero: 'CQ-A1045-3402', corrida: 'A1045-3402', norma: 'SAE J403' } } }] };
      expect((await api(token).post(`/compras/pedidos/${p.body.id}/recebimentos`, recebimento).expect(409)).body.codigo).toBe('PEDIDO_NAO_APROVADO');
      await api(tokenOrcamentista).post(`/compras/pedidos/${p.body.id}/aprovar`).expect(403);
      await api(token).post(`/compras/pedidos/${p.body.id}/aprovar`).expect(200);
      const semCert = await api(token).post(`/compras/pedidos/${p.body.id}/recebimentos`, { ...recebimento, itens: [{ ...recebimento.itens[0], lote: undefined }] }).expect(422);
      expect(semCert.body.codigo).toBe('CERTIFICADO_OBRIGATORIO');
      const antes = (await api(token).get(`/fornecedores/${sup().fornecedores.acos}`).expect(200)).body;
      const r = await api(token).post(`/compras/pedidos/${p.body.id}/recebimentos`, recebimento).expect(201);
      expect(r.body.status).toBe('PARCIAL');
      expect(r.body.recebimentos[0].divergencias.map((d: { tipo: string }) => d.tipo).sort()).toEqual(['PRECO', 'QUANTIDADE']);
      expect(r.body.recebimentos[0].contaPagar).toMatchObject({ valor: '3030', categoria: 'materiaPrima', vencimento: expect.stringMatching(/^\d{4}-/) });
      const depois = (await api(token).get(`/fornecedores/${sup().fornecedores.acos}`).expect(200)).body;
      expect(depois.entregas).toBe(antes.entregas + 1);
      expect(Number(depois.avaliacao)).toBeLessThan(Number(antes.avaliacao));
      const lotes = await api(token).get(`/estoque/lotes?itemId=${sup().itens.aco1045}`).expect(200);
      expect(lotes.body.find((l: { codigo: string }) => l.codigo === 'L-1045-1020')).toMatchObject({ saldo: '300', certificado: { corrida: 'A1045-3402' } });
    });

    it('garantia fora do prazo e procedente abrindo OS sem cobrança', async () => {
      const fora = await api(token).post('/qualidade/garantias', { osId: base.ordens[41], relato: 'Folga' }).expect(422);
      expect(fora.body.codigo).toBe('FORA_DA_GARANTIA');
      const g = await api(token).post('/qualidade/garantias', { osId: base.ordens[37], relato: 'Dentes com desgaste prematuro' }).expect(201);
      expect(g.body).toMatchObject({ status: 'EM_ANALISE', numero: 'GAR-2026-00002' });
      const d = await api(token).post(`/qualidade/garantias/${g.body.id}/decidir`, { procedente: true, analise: 'Têmpera por indução abaixo da dureza especificada' }).expect(200);
      expect(d.body.status).toBe('PROCEDENTE');
      const os = await api(token).get(`/ordens-servico/${d.body.osGarantia.id}`).expect(200);
      expect(os.body).toMatchObject({ status: 'EM_FILA', precoFinalLote: '0', garantiaDeId: base.ordens[37] });
      expect(os.body.operacoes.every((o: { retrabalho: boolean }) => o.retrabalho)).toBe(true);
      await api(token).post(`/qualidade/garantias/${g.body.id}/decidir`, { procedente: false, analise: 'x' }).expect(409);
      const laudo = await api(token).get(`/ordens-servico/${base.ordens[37]}/laudo`).expect(200);
      expect(laudo.body).toMatchObject({ cliente: { nome: 'Metalúrgica Vale do Itajaí Ltda.' }, garantia: { dias: 90 } });
    });

    it('isola suprimentos e qualidade entre empresas', async () => {
      await api(tokenOutra).get(`/itens/${sup().itens.latao}`).expect(404);
      expect((await api(tokenOutra).get(`/estoque/lotes?itemId=${sup().itens.latao}`).expect(200)).body).toEqual([]);
      await api(tokenOutra).get(`/compras/pedidos/${sup().pedidos.aguardando}`).expect(404);
      await api(tokenOutra).post(`/ordens-servico/${base.ordens[41]}/consumos`, { itemId: sup().itens.latao, quantidade: '1' }).expect(404);
      await api(tokenOutra).get(`/qualidade/rastreabilidade?loteId=${sup().lotes.latao}`).expect(404);
      const ncs = await api(tokenOutra).get('/qualidade/ncs').expect(200);
      expect(ncs.body.itens.some((n: { id: string }) => n.id.startsWith('e2e-a-'))).toBe(false);
    });
  });

  describe('financeiro', () => {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const dia = (n: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const fin = () => base.financeiro;
    const receber = (extra: object) => ({ tipo: 'RECEBER', pessoa: { clienteId: base.clientes.metalvale }, descricao: 'Serviço avulso de teste', centroCustoId: fin().centrosCusto.receita, ...extra });
    const buscar = async (q: string, tipo = 'RECEBER') => (await api(token).get(`/financeiro/titulos?tipo=${tipo}&q=${encodeURIComponent(q)}`).expect(200)).body.itens;

    it('parcelas 30/60/90 fecham os centavos e condição inválida é recusada', async () => {
      const r = await api(token).post('/financeiro/titulos', receber({ valor: '793.27', condicao: '30/60/90', dataBase: '2026-11-01' })).expect(201);
      expect(r.body.itens.map((t: { valor: string; vencimento: string; parcela: string }) => [t.parcela, t.valor, t.vencimento])).toEqual([
        ['1/3', '264.43', '2026-12-01'],
        ['2/3', '264.42', '2026-12-31'],
        ['3/3', '264.42', '2027-01-30']
      ]);
      expect(new Set(r.body.itens.map((t: { grupoId: string }) => t.grupoId)).size).toBe(1);
      expect(r.body.itens[0].numero).toMatch(/^CR-2026-/);
      expect((await api(token).post('/financeiro/titulos', receber({ valor: '100', condicao: 'quando der' })).expect(422)).body.codigo).toBe('CONDICAO_INVALIDA');
      expect((await api(token).post('/orcamentos', { ...bucha(), condicaoPagamento: 'quando der' }).expect(422)).body.codigo).toBe('CONDICAO_INVALIDA');
      await api(token).post('/financeiro/titulos', { ...receber({ valor: '10' }), centroCustoId: undefined }).expect(400);
    });

    it('baixa parcial e depois total com multa e juros', async () => {
      const [t] = (await api(token).post('/financeiro/titulos', receber({ valor: '1000', vencimento: dia(-10) })).expect(201)).body.itens;
      expect(t).toMatchObject({ diasAtraso: 10, vencido: true });
      let r = await api(token).post(`/financeiro/titulos/${t.id}/baixas`, { data: hoje, valor: '500', contaId: fin().contas.bb, multa: '0', juros: '0' }).expect(201);
      expect(r.body).toMatchObject({ status: 'PARCIAL', saldo: '500.00', encargosHoje: { multa: '10.00', juros: '1.67', total: '511.67' } });
      r = await api(token).post(`/financeiro/titulos/${t.id}/baixas`, { data: hoje, valor: '511.67', contaId: fin().contas.bb }).expect(201);
      expect(r.body).toMatchObject({ status: 'PAGO', saldo: '0.00', valorPago: '1000.00' });
      expect(r.body.baixas[1]).toMatchObject({ valor: '511.67', principal: '500.00', multa: '10.00', juros: '1.67' });
      await api(token).post(`/financeiro/titulos/${t.id}/baixas`, { data: hoje, valor: '1', contaId: fin().contas.bb }).expect(422);
    });

    it('pagar em partes custa o mesmo que pagar de uma vez (encargos proporcionais)', async () => {
      const [t] = (await api(token).post('/financeiro/titulos', receber({ valor: '1380', vencimento: dia(-45) })).expect(201)).body.itens;
      const r1 = await api(token).post(`/financeiro/titulos/${t.id}/baixas`, { data: hoje, valor: '600', contaId: fin().contas.bb }).expect(201);
      expect(r1.body).toMatchObject({ status: 'PARCIAL', saldo: '800.29' });
      expect(r1.body.baixas[0]).toMatchObject({ valor: '600.00', principal: '579.71', multa: '11.59', juros: '8.70' });
      const resto = r1.body.encargosHoje.total;
      await api(token).post(`/financeiro/titulos/${t.id}/baixas`, { data: hoje, valor: (Number(resto) + 0.01).toFixed(2), contaId: fin().contas.bb }).expect(422).expect((r) => expect(r.body.codigo).toBe('VALOR_ACIMA_DO_DEVIDO'));
      const r2 = await api(token).post(`/financeiro/titulos/${t.id}/baixas`, { data: hoje, valor: resto, contaId: fin().contas.bb }).expect(201);
      expect(r2.body).toMatchObject({ status: 'PAGO', saldo: '0.00', valorPago: '1380.00' });
      const pago = r2.body.baixas.reduce((a: number, b: { valor: string }) => a + Number(b.valor), 0);
      expect(pago.toFixed(2)).toBe('1428.30');
    });

    it('baixa em lote quita cada título', async () => {
      const { itens } = (await api(token).post('/financeiro/titulos', receber({ valor: '200', condicao: '30/60', dataBase: hoje })).expect(201)).body;
      const r = await api(token).post('/financeiro/baixas-lote', { tituloIds: itens.map((t: { id: string }) => t.id), data: hoje, contaId: fin().contas.caixa }).expect(201);
      expect(r.body.itens.map((t: { status: string }) => t.status)).toEqual(['PAGO', 'PAGO']);
      expect(r.body.valor).toBe('200.00');
    });

    it('baixa de título de OS gera comissão e o estorno a desfaz', async () => {
      const competencia = hoje.slice(0, 7);
      const antes = (await api(token).get(`/financeiro/comissoes?competencia=${competencia}`).expect(200)).body.total;
      const [p2] = (await buscar('OS-2026-00037 · parcela 2/3'));
      const baixa = await api(token).post(`/financeiro/titulos/${p2.id}/baixas`, { data: hoje, valor: p2.valor, contaId: fin().contas.bb }).expect(201);
      const depois = (await api(token).get(`/financeiro/comissoes?competencia=${competencia}`).expect(200)).body;
      expect(Number(depois.total) - Number(antes)).toBeCloseTo(Number(p2.valor) * 0.03, 2);
      expect(depois.vendedores[0].vendedor.nome).toBe('Paulo Henrique Souza');
      const baixaId = baixa.body.baixas[0].id;
      await api(tokenOrcamentista).post(`/financeiro/titulos/${p2.id}/baixas/${baixaId}/estornar`, { motivo: 'Cheque devolvido' }).expect(403);
      const e = await api(token).post(`/financeiro/titulos/${p2.id}/baixas/${baixaId}/estornar`, { motivo: 'Cheque devolvido' }).expect(200);
      expect(e.body).toMatchObject({ status: 'ABERTO', valorPago: '0.00' });
      expect(e.body.historico.at(-1)).toMatchObject({ evento: 'estorno', detalhe: expect.stringContaining('comissão estornada') });
      expect((await api(token).get(`/financeiro/comissoes?competencia=${competencia}`).expect(200)).body.total).toBe(antes);
    });

    it('renegociação transforma o saldo em novas parcelas', async () => {
      const [t] = await buscar('Recuperação de rosca do eixo');
      const r = await api(token).post(`/financeiro/titulos/${t.id}/renegociar`, { condicao: '30/60', dataBase: hoje }).expect(200);
      expect(r.body.status).toBe('RENEGOCIADO');
      expect(r.body.renegociacao.map((x: { valor: string }) => x.valor)).toEqual(['320.00', '320.00']);
      expect(r.body.renegociacao[0].origem).toMatchObject({ tipo: 'RENEGOCIACAO', numero: t.numero });
      await api(token).post(`/financeiro/titulos/${t.id}/cancelar`, { motivo: 'x' }).expect(409);
    });

    it('entrega de OS e recebimento de compra viram títulos', async () => {
      const os42 = await buscar('OS-2026-00042');
      expect(os42).toEqual([expect.objectContaining({ valor: '835.02', origem: expect.objectContaining({ tipo: 'OS', numero: 'OS-2026-00042' }), centroCusto: expect.objectContaining({ nome: 'Receita de serviços' }) })]);
      const os37 = await buscar('OS-2026-00037');
      expect(os37.map((t: { parcela: string }) => t.parcela)).toEqual(['1/3', '2/3', '3/3']);
      const compras = await buscar('NF 9001', 'PAGAR');
      expect(compras.map((t: { valor: string }) => t.valor).sort()).toEqual(['200.00', '260.00']);
      expect(compras[0]).toMatchObject({ origem: { tipo: 'RECEBIMENTO' }, centroCusto: { nome: 'Matéria-prima' } });
      const pc2 = await buscar('PC-2026-00002', 'PAGAR');
      expect(pc2[0]).toMatchObject({ valor: '730.00', pessoa: { tipo: 'FORNECEDOR' } });
    });

    it('recorrências geram o mês sem duplicar', async () => {
      const r = await api(token).post('/financeiro/recorrencias/gerar', { competencia: '2027-01' }).expect(200);
      expect(r.body.geradas).toBe(13);
      expect((await api(token).post('/financeiro/recorrencias/gerar', { competencia: '2027-01' }).expect(200)).body.geradas).toBe(0);
      const rec = await api(token).get('/financeiro/recorrencias').expect(200);
      expect(rec.body.itens).toHaveLength(14);
    });

    it('fluxo de caixa projeta o saldo e aponta o menor saldo', async () => {
      const f = await api(token).get(`/financeiro/fluxo?ate=${dia(60)}&agrupamento=semana`).expect(200);
      expect(f.body.saldoAtual).toMatch(/^-?\d+\.\d{2}$/);
      expect(f.body.pontos.length).toBeGreaterThan(8);
      expect(new Date(`${f.body.pontos[1].inicio}T12:00:00Z`).getUTCDay()).toBe(1);
      expect(f.body.realizado).toHaveLength(4);
      const minimo = Math.min(...f.body.pontos.map((x: { saldoFinal: string }) => Number(x.saldoFinal)));
      expect(Number(f.body.menorSaldo.valor)).toBe(minimo);
      const contas = await api(token).get('/financeiro/contas').expect(200);
      const total = contas.body.reduce((a: number, c: { saldoAtual: string }) => a + Number(c.saldoAtual), 0);
      expect(Number(f.body.saldoAtual)).toBeCloseTo(total, 2);
    });

    it('DRE de um cenário controlado e custo fixo realizado contra a tabela', async () => {
      const [titulo] = await buscar('OS-2026-00042');
      await api(token).patch(`/financeiro/titulos/${titulo.id}`, { competencia: '2027-03' }).expect(200);
      for (const valor of ['1000', '500']) {
        await api(token).post('/financeiro/titulos', { tipo: 'PAGAR', pessoa: { nome: 'Imobiliária Centro' }, descricao: 'Aluguel extra', centroCustoId: fin().centrosCusto.aluguel, competencia: '2027-03', valor, vencimento: '2027-03-05' }).expect(201);
      }
      const d = await api(token).get('/financeiro/dre?competencia=2027-03').expect(200);
      expect(d.body).toMatchObject({ receitaBruta: '835.02', custosVariaveis: '0.00', margemContribuicao: '835.02', custoFixo: '1500.00', resultado: '-664.98', comparativo: { competencia: '2027-02' } });
      const oficina = await api(token).get('/financeiro/dre?competencia=2027-03&segmento=OFICINA').expect(200);
      expect(oficina.body).toMatchObject({ receitaBruta: '0.00', custoFixo: '0.00' });

      const cf = await api(token).get('/financeiro/custo-fixo-realizado?competencia=2026-10').expect(200);
      expect(cf.body).toMatchObject({ realizado: '22000.00', tabela: { custoFixo: '22000' }, desvio: '0', acimaDaTolerancia: false });
      expect((await api(token).post('/custo-fixo/importar-financeiro', { competencia: '2026-10' }).expect(409)).body.codigo).toBe('TABELA_VIGENTE');
      const imp = await api(token).post('/custo-fixo/importar-financeiro', { competencia: '2027-03' }).expect(200);
      expect(imp.body).toMatchObject({ total: '1500.00', lancamentos: [{ categoria: 'aluguel', valor: '1500' }] });
      const hist = await api(token).get(`/centros-trabalho/${base.centros.torno}/historico-custos?meses=3`).expect(200);
      expect(hist.body.meses).toHaveLength(3);
      expect(hist.body.meses[2].insumos).toBe('142.50');
    });

    it('fechamento de comissões cria título a pagar e trava a competência', async () => {
      const competencia = hoje.slice(0, 7);
      await api(tokenOrcamentista).post('/financeiro/comissoes/fechar', { competencia }).expect(403);
      const r = await api(token).post('/financeiro/comissoes/fechar', { competencia }).expect(200);
      expect(r.body.fechada).toBe(true);
      const titulos = await buscar(`Comissões ${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`, 'PAGAR');
      expect(titulos).toEqual([expect.objectContaining({ valor: r.body.vendedores[0].valor, pessoa: expect.objectContaining({ tipo: 'VENDEDOR', nome: 'Paulo Henrique Souza' }), centroCusto: expect.objectContaining({ nome: 'Comissões' }) })]);
      expect((await api(token).post('/financeiro/comissoes/fechar', { competencia }).expect(409)).body.codigo).toBe('COMPETENCIA_FECHADA');
    });

    it('rotina bloqueia inadimplente e o gestor libera', async () => {
      await api(token).post('/financeiro/titulos', { ...receber({ valor: '300', vencimento: dia(-40) }), pessoa: { clienteId: base.clientes.schroeder } }).expect(201);
      const r = await api(token).post('/financeiro/rotina').expect(200);
      expect(r.body.clientesBloqueados.map((c: { id: string }) => c.id)).toContain(base.clientes.schroeder);
      expect((await api(token).get(`/clientes/${base.clientes.schroeder}`).expect(200)).body).toMatchObject({ status: 'BLOQUEADO', bloqueioAutomatico: true });
      const piraba = await api(token).get(`/clientes/${base.clientes.pirabeiraba}`).expect(200);
      expect(piraba.body).toMatchObject({ status: 'BLOQUEADO', bloqueioAutomatico: true });
      await api(tokenOrcamentista).patch(`/clientes/${base.clientes.schroeder}`, { status: 'ATIVO' }).expect(403);
      const liberado = await api(token).patch(`/clientes/${base.clientes.schroeder}`, { status: 'ATIVO' }).expect(200);
      expect(liberado.body).toMatchObject({ status: 'ATIVO', bloqueioAutomatico: false, liberadoAte: dia(7) });
      const de_novo = await api(token).post('/financeiro/rotina').expect(200);
      expect(de_novo.body.clientesBloqueados.map((c: { id: string }) => c.id)).not.toContain(base.clientes.schroeder);
    });

    it('isola o financeiro entre empresas', async () => {
      const [t] = await buscar('OS-2026-00037 · parcela 3/3');
      await api(tokenOutra).get(`/financeiro/titulos/${t.id}`).expect(404);
      const contaB = (await api(tokenOutra).get('/financeiro/contas').expect(200)).body[0].id;
      await api(tokenOutra).post(`/financeiro/titulos/${t.id}/baixas`, { data: hoje, valor: '1', contaId: contaB }).expect(404);
      await api(token).post(`/financeiro/titulos/${t.id}/baixas`, { data: hoje, valor: '1', contaId: contaB }).expect(404);
      const lista = await api(tokenOutra).get('/financeiro/titulos').expect(200);
      expect(lista.body.itens.some((x: { id: string }) => x.id === t.id)).toBe(false);
    });
  });

  describe('acesso, auditoria, notificações, CRM e portal', () => {
    const pub = () => ({
      get: (url: string) => http().get(`/api/v1/portal${url}`),
      post: (url: string, body: object = {}) => http().post(`/api/v1/portal${url}`).set('User-Agent', 'e2e-navegador/1.0').send(body)
    });
    const tokenDoLink = (url: string) => url.split('/').pop()!;
    const enviado = async (titulo: string) => {
      const o = await api(token).post('/orcamentos', { ...bucha(), titulo }).expect(201);
      await api(token).post(`/orcamentos/${o.body.id}/enviar`).expect(200);
      return o.body;
    };
    beforeAll(() => limparLimitePortal());

    it('perfil sem permissão recebe 403 e /auth/me traz perfil e permissões', async () => {
      const me = await api(tokenRicardo).get('/auth/me').expect(200);
      expect(me.body).toMatchObject({ papel: 'OPERADOR', perfil: { nome: 'Produção/Técnico' }, colaboradorId: base.colaboradores.ricardo });
      expect(me.body.permissoes).toContain('operador.gerenciar');
      const r = await api(tokenRicardo).post('/orcamentos', bucha()).expect(403);
      expect(r.body).toMatchObject({ codigo: 'SEM_PERMISSAO', detalhes: { permissao: 'orcamentos.gerenciar' } });
      await api(tokenCarla).get('/financeiro/titulos').expect(200);
      expect((await api(tokenCarla).post('/tabelas-custos', { competencia: '2027-06' }).expect(403)).body.detalhes.permissao).toBe('custos.gerenciar');
      await api(tokenCarla).post('/usuarios', { nome: 'X', email: `x@a-${sufixo}.test`, perfilId: 'x' }).expect(403);
      await api(token).get('/usuarios').expect(200);
      expect((await api(tokenRicardo).get('/usuarios/opcoes').expect(200)).body.length).toBeGreaterThan(3);
    });

    it('Produção/Técnico vê a OS sem custo-hora', async () => {
      const os = await api(tokenRicardo).get(`/ordens-servico/${base.ordens[41]}`).expect(200);
      expect(os.body).toMatchObject({ mascarado: true, operacoes: [expect.objectContaining({ custoHora: null, descricao: 'Torneamento CNC' })] });
      expect(os.body.resultado.horasProjetadas).toBe('4.35');
      const centros = await api(tokenRicardo).get('/centros-trabalho').expect(200);
      expect(centros.body.mascarado).toBe(true);
      expect(centros.body.itens.every((c: { custoHoraVigente: unknown }) => c.custoHoraVigente === null)).toBe(true);
      const painel = await api(tokenRicardo).get('/painel').expect(200);
      expect(painel.body.centros[0]).toMatchObject({ cheioHora: null, precoHora: null });
      expect((await api(token).get(`/ordens-servico/${base.ordens[41]}`).expect(200)).body.operacoes[0].custoHora).toBe('117.7777777778');
    });

    it('usuário novo troca a senha provisória; senha fraca é recusada; redefinir gera outra', async () => {
      const perfis = await api(tokenAdmin).get('/perfis').expect(200);
      expect(perfis.body.map((p: { nome: string }) => p.nome)).toEqual(expect.arrayContaining(['Administrador', 'Gerente', 'Orçamentista', 'Produção/Técnico', 'Compras', 'Financeiro', 'Recepção']));
      const recepcao = perfis.body.find((p: { nome: string }) => p.nome === 'Recepção');
      expect((await api(tokenAdmin).patch(`/perfis/${recepcao.id}`, { nome: 'Balcão' }).expect(422)).body.codigo).toBe('PERFIL_PADRAO');
      const catalogo = await api(tokenAdmin).get('/permissoes').expect(200);
      expect(catalogo.body.find((p: { chave: string }) => p.chave === 'custo.ver_custo_hora')).toMatchObject({ sensivel: true });

      const novo = await api(tokenAdmin).post('/usuarios', { nome: 'Joana Recepção', email: `joana@a-${sufixo}.test`, perfilId: recepcao.id }).expect(201);
      expect(novo.body.senhaProvisoria).toMatch(/^[A-Za-z0-9]{12}$/);
      const l1 = await http().post('/api/v1/auth/login').send({ email: `joana@a-${sufixo}.test`, senha: novo.body.senhaProvisoria }).expect(200);
      expect(l1.body.trocarSenha).toBe(true);
      const fraca = await api(l1.body.token).post('/auth/trocar-senha', { senhaAtual: novo.body.senhaProvisoria, novaSenha: 'curta123' }).expect(422);
      expect(fraca.body.codigo).toBe('SENHA_FRACA');
      await api(l1.body.token).post('/auth/trocar-senha', { senhaAtual: novo.body.senhaProvisoria, novaSenha: 'Oficina2026Forte' }).expect(200);
      expect((await http().post('/api/v1/auth/login').send({ email: `joana@a-${sufixo}.test`, senha: 'Oficina2026Forte' }).expect(200)).body.trocarSenha).toBe(false);
      const redef = await api(tokenAdmin).post(`/usuarios/${novo.body.id}/redefinir-senha`).expect(200);
      await http().post('/api/v1/auth/login').send({ email: `joana@a-${sufixo}.test`, senha: 'Oficina2026Forte' }).expect(401);
      expect((await http().post('/api/v1/auth/login').send({ email: `joana@a-${sufixo}.test`, senha: redef.body.senhaProvisoria }).expect(200)).body.trocarSenha).toBe(true);
      await api(tokenAdmin).patch(`/usuarios/${novo.body.id}`, { ativo: false }).expect(200);
      await http().post('/api/v1/auth/login').send({ email: `joana@a-${sufixo}.test`, senha: redef.body.senhaProvisoria }).expect(401);
    });

    it('auditoria registra a publicação da tabela e a alteração do orçamento', async () => {
      const t = await api(tokenOutra).post('/tabelas-custos', { competencia: '2026-10' }).expect(201);
      await api(tokenOutra).post(`/tabelas-custos/${t.body.id}/publicar`).expect(200);
      const trilha = await api(tokenOutra).get(`/auditoria?entidade=TabelaCustos&entidadeId=${t.body.id}`).expect(200);
      expect(trilha.body.itens.map((i: { acao: string }) => i.acao)).toEqual(['publicar', 'criar']);
      expect(trilha.body.itens[0]).toMatchObject({ antes: { status: 'RASCUNHO' }, depois: { status: 'VIGENTE' }, usuario: { nome: 'Marina Kowalski' } });

      const o = await api(token).post('/orcamentos', { ...bucha(), titulo: 'Bucha auditada' }).expect(201);
      await api(token).put(`/orcamentos/${o.body.id}`, { ...bucha(), titulo: 'Bucha auditada — revisão' }).expect(200);
      const log = await api(token).get(`/auditoria?entidade=orcamentos&entidadeId=${o.body.id}`).expect(200);
      expect(log.body.itens[0]).toMatchObject({ acao: 'alterar', antes: { titulo: 'Bucha auditada' }, depois: { titulo: 'Bucha auditada — revisão' } });
      await api(tokenRicardo).get('/auditoria').expect(403);
    });

    it('o ciclo do orçamento move a oportunidade no funil; perda por preço exige o preço aceito', async () => {
      const a = await enviado('Funil — perdido por preço');
      const op = async (titulo: string) => (await api(token).get(`/crm/oportunidades?q=${encodeURIComponent(titulo)}`).expect(200)).body.itens[0];
      expect(await op('Funil — perdido por preço')).toMatchObject({ etapa: 'ORCAMENTO_ENVIADO', orcamentoId: a.id, valorEstimado: '835.02', responsavel: { nome: 'Marina Kowalski' } });
      await api(token).post(`/orcamentos/${a.id}/negociar`).expect(200);
      expect((await op('Funil — perdido por preço')).etapa).toBe('NEGOCIACAO');
      expect((await api(token).post(`/orcamentos/${a.id}/recusar`, { motivo: 'PRECO' }).expect(422)).body.codigo).toBe('PRECO_ACEITO_OBRIGATORIO');
      await api(token).post(`/orcamentos/${a.id}/recusar`, { motivo: 'PRECO', precoAceito: '700', concorrente: 'Usinagem Pomerode' }).expect(200);
      expect(await op('Funil — perdido por preço')).toMatchObject({ etapa: 'PERDIDO', motivoPerda: 'PRECO', precoAceito: '700.00' });

      const g = await enviado('Funil — ganho');
      await api(token).post(`/orcamentos/${g.id}/aprovar`).expect(200);
      expect((await op('Funil — ganho')).etapa).toBe('GANHO');
      const lista = await api(token).get('/crm/oportunidades').expect(200);
      expect(lista.body.funil.PERDIDO.quantidade).toBeGreaterThanOrEqual(3);
      const manual = await api(token).post('/crm/oportunidades', { titulo: 'Lead de teste', contato: 'Fulano', origem: 'SITE', valorEstimado: '1000' }).expect(201);
      expect((await api(token).post(`/crm/oportunidades/${manual.body.id}/perder`, { motivo: 'PRECO' }).expect(422)).body.codigo).toBe('PRECO_ACEITO_OBRIGATORIO');
      await api(token).post(`/crm/oportunidades/${manual.body.id}/mover`, { etapa: 'CONTATO' }).expect(200);
      const ind = await api(token).get('/crm/indicadores?meses=6').expect(200);
      expect(ind.body.motivosPerda.find((m: { motivo: string }) => m.motivo === 'PRECO').quantidade).toBeGreaterThanOrEqual(2);
      expect(ind.body.precoAceitoSobreOfertado).not.toBeNull();
    });

    it('rotina cria follow-up de orçamento sem resposta, sem duplicar; concluir cria o próximo passo', async () => {
      const o = await enviado('Follow-up de teste');
      await db.orcamento.update({ where: { id: o.id }, data: { enviadoEm: new Date(Date.now() - 4 * 86_400_000) } });
      const r1 = await api(token).post('/financeiro/rotina').expect(200);
      expect(r1.body.followUps).toBeGreaterThanOrEqual(1);
      await api(token).post('/financeiro/rotina').expect(200);
      const pend = (await api(token).get('/crm/atividades?pendentes=true').expect(200)).body.itens.filter((a: { orcamento: { id: string } | null }) => a.orcamento?.id === o.id);
      expect(pend).toHaveLength(1);
      expect(pend[0]).toMatchObject({ tipo: 'LIGACAO', automatica: true });
      const c = await api(token)
        .post(`/crm/atividades/${pend[0].id}/concluir`, { resultado: 'Cliente pediu mais 2 dias', proximoPasso: { tipo: 'LIGACAO', data: new Date(Date.now() + 2 * 86_400_000).toISOString(), assunto: 'Ligar de novo' } })
        .expect(200);
      expect(c.body).toMatchObject({ concluida: true, proximaAtividade: { assunto: 'Ligar de novo', orcamento: { id: o.id } } });
    });

    it('portal: link inválido, nada de custo ou margem, ajuste, aprovação com OS e notificação', async () => {
      expect((await pub().get('/orcamento/nao-existe.abc').expect(401)).body.codigo).toBe('LINK_INVALIDO');
      const tokenOrc = base.crm.tokenOrcamento128;
      const v = await pub().get(`/orcamento/${tokenOrc}`).expect(200);
      expect(v.body).toMatchObject({ numero: 'ORC-2026-00128', precoFinalLote: '793.27', lote: 10, status: 'ENVIADO', objeto: { desenho: 'BUC-H7-020' }, vendedor: { nome: 'Paulo Henrique Souza' } });
      const json = JSON.stringify(v.body);
      for (const proibido of ['custoHora', 'cheioHora', 'margem', 'custoLote', 'explicacao', '117.78', 'imposto', 'custo']) expect(json).not.toContain(proibido);
      expect(v.body.composicao.reduce((a: number, g: { valor: string }) => a + Number(g.valor), 0).toFixed(2)).toBe('793.27');
      expect(v.body.curvaLote.map((p: { quantidade: number }) => p.quantidade)).toEqual([10, 50, 100]);

      const aj = await pub().post(`/orcamento/${tokenOrc}/ajuste`, { nome: 'Carlos Weber', mensagem: 'Conseguem entregar em 10 dias?' }).expect(200);
      expect(aj.body.status).toBe('EM_NEGOCIACAO');
      expect((await api(token).get(`/orcamentos/${base.orcamentoBuchaId}`).expect(200)).body.status).toBe('EM_NEGOCIACAO');
      const tarefas = (await api(tokenOrcamentista).get('/crm/atividades?pendentes=true').expect(200)).body.itens;
      expect(tarefas.some((a: { assunto: string }) => a.assunto.includes('Ajuste pedido no portal para o ORC-2026-00128'))).toBe(true);

      const extra = await api(token).post('/crm/oportunidades', { titulo: 'Bucha H7 — segunda oportunidade ligada', clienteId: base.clientes.metalvale, orcamentoId: base.orcamentoBuchaId }).expect(201);
      const ap = await pub().post(`/orcamento/${tokenOrc}/aprovar`, { nome: 'Carlos Weber', aceite: true }).expect(200);
      expect((await api(token).get(`/crm/oportunidades/${extra.body.id}`).expect(200)).body.etapa).toBe('GANHO');
      const depois = await pub().get(`/orcamento/${tokenOrc}`).expect(200);
      expect(depois.body.os).toMatchObject({ numero: ap.body.os.numero, prazo: expect.stringMatching(/^\d{4}-/), linkAcompanhamento: expect.stringContaining('/portal/os/') });
      expect(ap.body.os.linkAcompanhamento).toBe(depois.body.os.linkAcompanhamento);
      const acompanhar = await pub().get(`/os/${depois.body.os.linkAcompanhamento.split('/').pop()}`).expect(200);
      expect(acompanhar.body).toMatchObject({ numero: ap.body.os.numero, status: 'EM_FILA' });
      expect(ap.body).toMatchObject({ os: { numero: expect.stringMatching(/^OS-2026-/) }, aceite: { nome: 'Carlos Weber', userAgent: 'e2e-navegador/1.0', ip: expect.any(String) } });
      expect((await api(token).get(`/orcamentos/${base.orcamentoBuchaId}`).expect(200)).body.status).toBe('CONVERTIDO');
      const dup = await pub().post(`/orcamento/${tokenOrc}/aprovar`, { nome: 'Carlos Weber', aceite: true }).expect(409);
      expect(dup.body).toMatchObject({ codigo: 'JA_APROVADO', detalhes: { aceite: { nome: 'Carlos Weber' } } });
      const notas = await api(token).get('/notificacoes?naoLidas=true').expect(200);
      expect(notas.body.itens.some((n: { titulo: string; tipo: string }) => n.titulo === 'ORC-2026-00128 aprovado pelo cliente' && n.tipo === 'SUCESSO')).toBe(true);
      expect((await api(token).post('/notificacoes/ler-todas').expect(200)).body.naoLidas).toBe(0);
      expect((await api(token).get('/crm/oportunidades?q=Bucha de latão H7 — lote piloto').expect(200)).body.itens[0].etapa).toBe('GANHO');
      const trilha = await api(token).get(`/auditoria?entidade=Orcamento&entidadeId=${base.orcamentoBuchaId}`).expect(200);
      expect(trilha.body.itens[0]).toMatchObject({ acao: 'aprovado_no_portal', usuario: { nome: 'Portal do cliente / sistema' } });
    });

    it('portal: orçamento vencido não é aprovado e o link interno traz WhatsApp e e-mail', async () => {
      const o = await enviado('Orçamento que vai vencer');
      const link = await api(token).post(`/orcamentos/${o.id}/link-portal`).expect(200);
      expect(link.body).toMatchObject({ url: expect.stringContaining('/portal/orcamento/'), whatsapp: expect.stringMatching(/^https:\/\/wa\.me\/55\d+\?text=/), email: { assunto: expect.stringContaining(o.numero) } });
      await db.orcamento.update({ where: { id: o.id }, data: { validade: new Date(Date.now() - 2 * 86_400_000) } });
      const r = await pub().post(`/orcamento/${tokenDoLink(link.body.url)}/aprovar`, { nome: 'Fulano', aceite: true }).expect(409);
      expect(r.body.codigo).toBe('ORCAMENTO_VENCIDO');
      const novo = await api(token).post(`/orcamentos/${o.id}/link-portal`).expect(200);
      await pub().get(`/orcamento/${tokenDoLink(link.body.url)}`).expect(401);
      await pub().get(`/orcamento/${tokenDoLink(novo.body.url)}`).expect(200);
      const ficha = await api(token).get(`/clientes/${base.clientes.metalvale}/ficha`).expect(200);
      expect(ficha.body.mensagens.some((m: { canal: string }) => m.canal === 'LINK_PORTAL')).toBe(true);
      expect(ficha.body.resumo).toMatchObject({ orcamentos: expect.any(Number), taxaConversao: expect.any(String) });
    });

    it('portal: acompanhar a OS e avaliar uma vez depois da entrega', async () => {
      const os41 = await pub().get(`/os/${base.crm.tokenOs41}`).expect(200);
      expect(os41.body).toMatchObject({ numero: 'OS-2026-00041', status: 'EM_EXECUCAO', pecas: { prontas: 4, lote: 10 }, responsavel: { nome: 'Ricardo' } });
      expect(os41.body.etapas.map((e: { etapa: string }) => e.etapa)).toEqual(['APROVADO', 'MATERIAL_SEPARADO', 'NA_MAQUINA', 'INSPECAO', 'PRONTO']);
      for (const proibido of ['custoHora', 'margem', 'custoLote', 'explicacao', '117.78', 'custo']) expect(JSON.stringify(os41.body)).not.toContain(proibido);
      expect((await pub().post(`/os/${base.crm.tokenOs41}/avaliacao`, { nota: 10 }).expect(409)).body.codigo).toBe('OS_NAO_ENTREGUE');
      const [entregue] = (await api(token).get('/ordens-servico?q=OS-2026-00042').expect(200)).body.itens;
      const link = await api(token).post(`/ordens-servico/${entregue.id}/link-portal`).expect(200);
      const tk = tokenDoLink(link.body.url);
      const vista = await pub().get(`/os/${tk}`).expect(200);
      expect(vista.body).toMatchObject({ status: 'ENTREGUE', laudo: { disponivel: true }, podeAvaliar: true });
      await pub().post(`/os/${tk}/avaliacao`, { nota: 10, comentario: 'Perfeito' }).expect(201);
      expect((await pub().post(`/os/${tk}/avaliacao`, { nota: 3 }).expect(409)).body.codigo).toBe('JA_AVALIADA');
      expect((await api(token).get('/crm/indicadores').expect(200)).body.nps).not.toBeNull();
    });

    it('isola CRM, notificações e links entre empresas', async () => {
      const ops = await api(tokenOutra).get('/crm/oportunidades').expect(200);
      expect(ops.body.itens.some((o: { id: string }) => o.id.startsWith('e2e-a-'))).toBe(false);
      await api(tokenOutra).get(`/clientes/${base.clientes.metalvale}/ficha`).expect(404);
      await api(tokenOutra).post(`/orcamentos/${base.orcamentoProvisorioId}/link-portal`).expect(404);
      await api(tokenOutra).get(`/auditoria?entidadeId=${base.orcamentoBuchaId}`).expect(200).expect((r) => expect(r.body.total).toBe(0));
      await api(tokenOutra).post(`/crm/oportunidades/${'e2e-a-' + sufixo + '-op-lead'}/mover`, { etapa: 'CONTATO' }).expect(404);
    });

    it('portal limita 30 requisições por minuto por IP', async () => {
      limparLimitePortal();
      for (let i = 0; i < 30; i++) await pub().get('/orcamento/x.y').expect(401);
      expect((await pub().get('/orcamento/x.y').expect(429)).body.codigo).toBe('MUITAS_TENTATIVAS');
      limparLimitePortal();
    });
  });

  describe('manutenção e RH operacional', () => {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const dia = (n: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const del = (t: string, url: string) => http().delete(`/api/v1${url}`).set('Authorization', `Bearer ${t}`);
    const colab = (chave: string) => `e2e-a-${sufixo}-colab-${chave}`;
    const sup = () => base.suprimentos;

    it('preventiva por horas: situação, rotina sem duplicar e concluir zera o contador', async () => {
      const plano = await api(token)
        .post('/manutencao/planos', { centroId: base.centros.cu, nome: 'Preventiva 8 h de teste', tipo: 'HORAS', intervaloHoras: '8', duracaoHoras: '2', checklist: ['Limpar'], ultimaExecucao: dia(-60) })
        .expect(201);
      expect(plano.body).toMatchObject({ horasDesdeUltima: '7.5', situacao: { situacao: 'proxima', falta: '0.5' } });
      expect((await api(token).post('/financeiro/rotina').expect(200)).body.preventivas).toBeGreaterThanOrEqual(1);
      await api(token).post('/financeiro/rotina').expect(200);
      const abertas = (await api(token).get(`/manutencao/ordens?centroId=${base.centros.cu}&tipo=PREVENTIVA&status=ABERTA`).expect(200)).body.itens.filter((o: { planoId: string }) => o.planoId === plano.body.id);
      expect(abertas).toHaveLength(1);
      const om = abertas[0];
      expect(om).toMatchObject({ origem: 'PLANO', bloqueiaAgenda: true, numero: expect.stringMatching(/^OM-2026-/) });
      expect(om.prevista > hoje && om.prevista <= dia(10)).toBe(true);
      const paradas = await api(token).get(`/centros-trabalho/${base.centros.cu}/paradas`).expect(200);
      expect(paradas.body.find((p: { ordemManutencaoId: string }) => p.ordemManutencaoId === om.id)).toMatchObject({ inicio: om.prevista });
      await api(token).post(`/manutencao/ordens/${om.id}/iniciar`).expect(200);
      const c = await api(token).post(`/manutencao/ordens/${om.id}/concluir`, { checklist: [{ item: 'Limpar', ok: true }], observacao: 'Ok' }).expect(200);
      expect(c.body.status).toBe('CONCLUIDA');
      const p2 = (await api(token).get(`/manutencao/planos?centroId=${base.centros.cu}`).expect(200)).body.itens.find((x: { id: string }) => x.id === plano.body.id);
      expect(p2).toMatchObject({ horasDesdeUltima: '0', ultimaExecucao: hoje, situacao: { situacao: 'ok' } });
    });

    it('quebra pausa a OS em execução e abre parada; concluir fecha com as horas paradas', async () => {
      const inicio = new Date(Date.now() - 2 * 3_600_000).toISOString();
      const q = await api(tokenOutra).post('/manutencao/quebras', { centroId: outra.centros.torno, descricao: 'Barramento travado', inicio }).expect(201);
      expect(q.body).toMatchObject({ tipo: 'CORRETIVA', status: 'EM_EXECUCAO', origem: 'QUEBRA', osAfetadas: [expect.objectContaining({ numero: 'OS-2026-00041' })] });
      const os = await api(tokenOutra).get(`/ordens-servico/${outra.ordens[41]}`).expect(200);
      expect(os.body.status).toBe('PAUSADA');
      expect(os.body.ocorrencias.at(-1)).toMatchObject({ tipo: 'PAUSA', motivo: 'QUEBRA', fim: null });
      const abertas = (await api(tokenOutra).get(`/centros-trabalho/${outra.centros.torno}/paradas`).expect(200)).body.filter((p: { ordemManutencaoId: string }) => p.ordemManutencaoId === q.body.id);
      expect(abertas).toEqual([expect.objectContaining({ fim: null })]);
      const fim = await api(tokenOutra).post(`/manutencao/ordens/${q.body.id}/concluir`, { checklist: [], observacao: 'Guia limpa e lubrificada' }).expect(200);
      expect(Number(fim.body.horasParado)).toBeGreaterThan(1.9);
      expect(Number(fim.body.horasParado)).toBeLessThan(2.2);
      const fechada = (await api(tokenOutra).get(`/centros-trabalho/${outra.centros.torno}/paradas`).expect(200)).body.find((p: { ordemManutencaoId: string }) => p.ordemManutencaoId === q.body.id);
      expect(fechada.fim).toBe(hoje);
    });

    it('custos: peça sai do estoque, mão de obra pelo custo do colaborador e terceiro vira título', async () => {
      const om = await api(token).post('/manutencao/ordens', { centroId: base.centros.fresa, tipo: 'CORRETIVA', descricao: 'Troca da correia do fuso' }).expect(201);
      const antes = (await api(token).get(`/itens/${sup().itens.oleo}`).expect(200)).body.saldo.fisico;
      let r = await api(token).post(`/manutencao/ordens/${om.body.id}/custos`, { tipo: 'PECA', itemId: sup().itens.oleo, quantidade: '2' }).expect(201);
      expect(r.body.custos[0]).toMatchObject({ tipo: 'PECA', valor: '57.00' });
      expect(Number((await api(token).get(`/itens/${sup().itens.oleo}`).expect(200)).body.saldo.fisico)).toBe(Number(antes) - 2);
      r = await api(token).post(`/manutencao/ordens/${om.body.id}/custos`, { tipo: 'MAO_DE_OBRA', colaboradorId: colab('diego'), horas: '4' }).expect(201);
      expect(r.body.custos[1]).toMatchObject({ valor: '149.09', horas: '4' });
      r = await api(token).post(`/manutencao/ordens/${om.body.id}/custos`, { tipo: 'TERCEIRO', fornecedorId: sup().fornecedores.metais, valor: '650', descricao: 'Usinagem da polia' }).expect(201);
      expect(r.body.custoTotal).toBe('856.09');
      const titulo = (await api(token).get(`/financeiro/titulos?tipo=PAGAR&q=${om.body.numero}`).expect(200)).body.itens;
      expect(titulo).toEqual([expect.objectContaining({ valor: '650.00', origem: expect.objectContaining({ tipo: 'MANUTENCAO' }), centroCusto: expect.objectContaining({ nome: 'Manutenção — Fresa CNC 01' }) })]);
      const hist = await api(token).get(`/centros-trabalho/${base.centros.fresa}/historico-custos?meses=1`).expect(200);
      expect(Number(hist.body.meses[0].manutencao)).toBeGreaterThanOrEqual(856.09);
      expect(hist.body.meses[0].insumos).toBe('0.00');
      const consumo = await api(token).get('/estoque/consumo-centros').expect(200);
      expect(Number(consumo.body.find((c: { centroId: string }) => c.centroId === base.centros.fresa).consumido)).toBe(0);
      await del(token, `/manutencao/ordens/${om.body.id}/custos/${r.body.custos[0].id}`).expect(200);
      expect(Number((await api(token).get(`/itens/${sup().itens.oleo}`).expect(200)).body.saldo.fisico)).toBe(Number(antes));
    });

    it('indicadores do torno: MTBF, MTTR e histórico de 6 meses', async () => {
      const r = await api(token).get(`/manutencao/indicadores?centroId=${base.centros.torno}&meses=6`).expect(200);
      const t = r.body.centros[0];
      expect(t.indicadores).toMatchObject({ quebras: 1, mttr: '6' });
      expect(Number(t.indicadores.mtbf)).toBeGreaterThan(0);
      expect(t.custoPorMes).toHaveLength(6);
      expect(t).toMatchObject({ cadastro: '700', media12: expect.any(String) });
    });

    it('férias derrubam a capacidade do centro e o apontamento recusa o operador ausente', async () => {
      const antes = await api(token).get('/planejamento').expect(200);
      const op40 = antes.body.ordens.find((o: { id: string }) => o.id === base.ordens[40]).operacoes[0];
      const operadores = (await api(token).get(`/centros-trabalho/${base.centros.torno}`).expect(200)).body.operadores.map((o: { colaboradorId: string }) => o.colaboradorId);
      expect(operadores).toContain(colab('ricardo'));
      const ausencias = [];
      for (const colaboradorId of operadores) ausencias.push((await api(token).post('/rh/ausencias', { colaboradorId, tipo: 'FERIAS', inicio: dia(0), fim: dia(3) }).expect(201)).body.id);
      const depois = await api(token).get('/planejamento').expect(200);
      const torno = depois.body.centros.find((c: { id: string }) => c.id === base.centros.torno);
      for (const d of torno.dias.filter((x: { data: string }) => x.data <= dia(3))) expect(d.capacidade).toBe('0');
      const novo = depois.body.ordens.find((o: { id: string }) => o.id === base.ordens[40]).operacoes[0];
      expect(novo.inicio > dia(3)).toBe(true);
      expect(novo.inicio >= op40.inicio).toBe(true);
      const os41 = await api(token).get(`/ordens-servico/${base.ordens[41]}`).expect(200);
      const r = await api(token).post(`/ordens-servico/${base.ordens[41]}/operacoes/${os41.body.operacoes[0].id}/iniciar`, { colaboradorId: colab('ricardo'), tipo: 'PRODUCAO' }).expect(422);
      expect(r.body.codigo).toBe('COLABORADOR_AUSENTE');
      for (const id of ausencias) await del(token, `/rh/ausencias/${id}`).expect(200);
    });

    it('ausência sobreposta, mecânico ausente ou com habilitação vencida, alocação sem habilitação', async () => {
      const a = await api(token).post('/rh/ausencias', { colaboradorId: colab('diego'), tipo: 'FOLGA', inicio: '2031-01-13', fim: '2031-01-15' }).expect(201);
      expect((await api(token).post('/rh/ausencias', { colaboradorId: colab('diego'), tipo: 'FALTA', inicio: '2031-01-14', fim: '2031-01-16' }).expect(409)).body.codigo).toBe('AUSENCIA_SOBREPOSTA');
      await del(token, `/rh/ausencias/${a.body.id}`).expect(200);

      const agenda = (inicio: string) => ({ clienteId: base.clientes.metalvale, servico: 'Revisão', centroId: base.box3, colaboradorId: base.jonas, inicio, duracaoHoras: '1' });
      const aus = await api(token).post('/agendamentos', agenda(`${base.manutencao.treinamentoJonas}T09:00`)).expect(422);
      expect(aus.body.codigo).toBe('COLABORADOR_AUSENTE');

      const sem = await api(token).patch(`/colaboradores/${colab('marcelo')}`, { alocacoes: [{ centroId: base.centros.fresa, alocacao: '0.5' }] }).expect(422);
      expect(sem.body.codigo).toBe('SEM_HABILITACAO');

      const habs = (await api(token).get('/rh/habilitacoes').expect(200)).body.itens;
      const jonasBox = habs.find((h: { colaboradorId: string; centroId: string }) => h.colaboradorId === base.jonas && h.centroId === base.box3);
      await api(token).patch(`/rh/habilitacoes/${jonasBox.id}`, { validade: dia(-1) }).expect(200);
      expect((await api(token).post('/agendamentos', agenda('2030-02-05T09:00')).expect(422)).body.codigo).toBe('HABILITACAO_VENCIDA');
      await api(token).patch(`/rh/habilitacoes/${jonasBox.id}`, { validade: '2030-12-31' }).expect(200);

      const vencendo = (await api(token).get('/rh/habilitacoes?vencendo=30').expect(200)).body.itens;
      expect(vencendo.some((h: { descricao: string; situacao: string }) => h.descricao === 'Certificação NR-12' && h.situacao === 'vencendo')).toBe(true);
      const matriz = await api(token).get('/rh/habilitacoes/matriz').expect(200);
      expect(matriz.body.celulas.find((c: { colaboradorId: string }) => c.colaboradorId === colab('marcelo'))).toMatchObject({ alocacao: null, habilitacao: { situacao: 'vencida' } });
    });

    it('disponibilidade de novembro desconta as férias do Anderson', async () => {
      const r = await api(token).get('/rh/disponibilidade?competencia=2026-11').expect(200);
      expect(r.body.colaboradores.find((c: { colaborador: { id: string } }) => c.colaborador.id === colab('anderson'))).toMatchObject({ diasUteis: 19, diasAusente: 5, horasDisponiveis: '162.1052631579' });
      expect(r.body.centros.find((c: { centroId: string }) => c.centroId === base.centros.cu)).toMatchObject({ horasExpedienteCadastro: '220', horasDisponiveisReais: '162.1052631579' });
      expect(r.body.centros.find((c: { centroId: string }) => c.centroId === base.centros.fresa).horasDisponiveisReais).toBe('220');
    });

    it('produtividade abaixo da eficiência pede recalibração e avisa custos', async () => {
      const r = await api(token).get('/rh/produtividade?meses=3').expect(200);
      expect(r.body.centros.find((c: { centro: { id: string } }) => c.centro.id === base.centros.torno)).toMatchObject({ recalibrar: true, eficienciaTabela: '0.75' });
      const notas = await api(token).get('/notificacoes?naoLidas=true').expect(200);
      expect(notas.body.itens.some((n: { titulo: string }) => n.titulo === 'Recalibrar a eficiência do Torno CNC de entrada')).toBe(true);
    });

    it('proposta ao Motor de Custos e aceite marcam a tabela desatualizada', async () => {
      const p = await api(tokenOutra).get('/manutencao/proposta?competencia=2026-10').expect(200);
      expect(p.body.centros.find((c: { centroId: string }) => c.centroId === outra.centros.torno)).toMatchObject({ manutencaoCadastro: '700', manutencaoProposta: '699.85', horasDisponiveisReais: '220' });
      await api(tokenRicardo).post('/manutencao/proposta/aceitar', { centros: [{ centroId: base.centros.cu, manutencao: '720' }] }).expect(403);
      const a = await api(tokenOutra).post('/manutencao/proposta/aceitar', { centros: [{ centroId: outra.centros.cu, manutencao: '720' }] }).expect(200);
      expect(a.body).toMatchObject({ tabelaDesatualizada: true, centros: [expect.objectContaining({ manutencaoCadastro: '720' })] });
      expect((await api(tokenOutra).get('/tabelas-custos/vigente').expect(200)).body.desatualizada).toBe(true);
    });

    it('salário só aparece com rh.ver_salario', async () => {
      const semSalario = await api(tokenRicardo).get('/colaboradores').expect(200);
      const r = semSalario.body.itens.find((c: { id: string }) => c.id === colab('ricardo'));
      expect(semSalario.body.mascarado).toBe(true);
      expect(r).toMatchObject({ salario: null, encargos: null, custoMensal: null, custoHora: null, nome: 'Ricardo Lima' });
      const comSalario = (await api(tokenCarla).get('/colaboradores').expect(200)).body.itens.find((c: { id: string }) => c.id === colab('ricardo'));
      expect(comSalario).toMatchObject({ salario: '5000', custoMensal: '8200', custoHora: '37.2727272727' });

      const proibido = await api(tokenOrcamentista).post('/colaboradores', { nome: 'Temporário', salario: '9999' }).expect(403);
      expect(proibido.body).toMatchObject({ codigo: 'SEM_PERMISSAO', detalhes: { permissao: 'rh.ver_salario', campos: ['salario'] } });
      const semSalarioNovo = await api(tokenOrcamentista).post('/colaboradores', { nome: 'Temporário', funcao: 'Ajudante' }).expect(201);
      expect(semSalarioNovo.body).toMatchObject({ nome: 'Temporário', salario: null, mascarado: true });
      await api(tokenOrcamentista).patch(`/colaboradores/${colab('ricardo')}`, { salario: '1', encargos: '1', beneficios: '1', funcao: 'Operador de torno CNC sênior' }).expect(200);
      const intacto = await api(token).get(`/colaboradores/${colab('ricardo')}`).expect(200);
      expect(intacto.body).toMatchObject({ salario: '5000', encargos: '3200', beneficios: '0', funcao: 'Operador de torno CNC sênior' });
      await api(token).patch(`/colaboradores/${colab('ricardo')}`, { funcao: 'Operador de torno CNC' }).expect(200);
    });

    it('isola manutenção e RH entre empresas', async () => {
      await api(tokenOutra).get(`/manutencao/ordens/${base.manutencao.ordemCorretiva}`).expect(404);
      await api(tokenOutra).post(`/manutencao/ordens/${base.manutencao.ordemCorretiva}/custos`, { tipo: 'TERCEIRO', valor: '1' }).expect(404);
      expect((await api(tokenOutra).get(`/manutencao/planos?centroId=${base.centros.torno}`).expect(200)).body.itens).toEqual([]);
      const aus = await api(tokenOutra).get('/rh/ausencias').expect(200);
      expect(aus.body.itens.some((a: { id: string }) => a.id.startsWith('e2e-a-'))).toBe(false);
      await api(tokenOutra).patch(`/rh/habilitacoes/e2e-a-${sufixo}-hab-ricardo-torno`, { validade: '2031-01-01' }).expect(404);
    });
  });

  it('painel resume a operação', async () => {
    const r = await api(token).get('/painel').expect(200);
    expect(r.body.usuario).toBe('Marina');
    expect(r.body.tabelaVigente.cheioMedio).toBe('117.78');
    expect(r.body.centros[0]).toMatchObject({ cheioHora: '117.78', precoHora: '178.45' });
    expect(r.body.ordens).toMatchObject({ emExecucao: 1, pausadas: 1, atrasadas: 1, emQualidade: 1 });
    expect(r.body.ordens.margemProjetadaMedia).toEqual(expect.any(String));
    expect(r.body.suprimentos).toMatchObject({ abaixoDoMinimo: expect.any(Number), valorEstoque: expect.any(String), pedidosAguardando: expect.any(Number) });
    expect(r.body.manutencao).toMatchObject({ preventivasProximas: expect.any(Number), ordensAbertas: expect.any(Number), centrosParados: expect.any(Number) });
    expect(r.body.rh).toMatchObject({ ausentesHoje: expect.any(Number), habilitacoesVencendo: expect.any(Number) });
    expect(r.body.financeiro).toMatchObject({ saldoContas: expect.any(String), receberVencido: expect.any(String), caixa30: expect.any(String), menorSaldo: expect.any(Object) });
    expect(r.body.financeiro.clientesBloqueados).toBeGreaterThanOrEqual(1);
    expect(r.body.qualidade).toMatchObject({ ncsAbertas: expect.any(Number), garantiasAbertas: expect.any(Number), custoNaoQualidadeMes: expect.any(String) });
  });
});
