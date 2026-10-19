import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { reais } from '@promec/motor';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { completarCnpj } from '../src/comum/documento';
import { configurar } from '../src/configurar';
import { semearEmpresa } from '../src/seed/semear';

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
      expect(r.body.usuario).toMatchObject({ nome: 'Marina Kowalski', papel: 'GESTOR', email: base.emails.gestor });
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
      expect(reais(r.body.centros[0].cheioHora)).toBe('117.78');
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

      const marcos = await api(token)
        .post('/colaboradores', { nome: 'Marcos Teixeira', salario: '4200', encargos: '2700', alocacoes: [{ centroId: base.centros.torno, alocacao: '1' }] })
        .expect(201);
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
      r = await api(token)
        .post(`/ordens-servico/${id}/inspecao`, {
          aprovada: false,
          observacao: 'Furo H7 acima da tolerância em 2 peças',
          centroRetrabalhoId: base.centros.torno,
          itens: [{ descricao: 'Furo Ø20 H7', esperado: '20,000–20,021', medido: '20,030', conforme: false }]
        })
        .expect(200);
      expect(r.body.status).toBe('EM_EXECUCAO');
      const retrabalho = r.body.operacoes.find((o: { retrabalho: boolean }) => o.retrabalho);
      expect(retrabalho).toMatchObject({ sequencia: 20, status: 'PENDENTE', centroId: base.centros.torno });

      const urlR = (acao: string) => `/ordens-servico/${id}/operacoes/${retrabalho.id}/${acao}`;
      await api(token).post(urlR('iniciar'), { ...quem, tipo: 'PRODUCAO' }).expect(200);
      r = await api(token).post(urlR('parar'), { quantidadeBoa: 2, encerrarOperacao: true }).expect(200);
      expect(r.body.status).toBe('CONTROLE_QUALIDADE');
      r = await api(token).post(`/ordens-servico/${id}/inspecao`, { aprovada: true, itens: [{ descricao: 'Furo Ø20 H7', conforme: true }] }).expect(200);
      expect(r.body.status).toBe('CONCLUIDA');
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

  it('painel resume a operação', async () => {
    const r = await api(token).get('/painel').expect(200);
    expect(r.body.usuario).toBe('Marina');
    expect(r.body.tabelaVigente.cheioMedio).toBe('117.78');
    expect(r.body.centros[0]).toMatchObject({ cheioHora: '117.78', precoHora: '178.45' });
    expect(r.body.ordens).toMatchObject({ emExecucao: 1, pausadas: 1, atrasadas: 1, emQualidade: 1 });
    expect(r.body.ordens.margemProjetadaMedia).toEqual(expect.any(String));
  });
});
