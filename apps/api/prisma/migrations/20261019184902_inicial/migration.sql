-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'GESTOR', 'ORCAMENTISTA', 'OPERADOR');

-- CreateEnum
CREATE TYPE "Vinculo" AS ENUM ('CLT', 'PJ', 'HORISTA', 'SOCIO');

-- CreateEnum
CREATE TYPE "StatusTabela" AS ENUM ('RASCUNHO', 'VIGENTE', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "StatusCliente" AS ENUM ('ATIVO', 'BLOQUEADO', 'INATIVO');

-- CreateEnum
CREATE TYPE "StatusOrcamento" AS ENUM ('RASCUNHO', 'ENVIADO', 'EM_NEGOCIACAO', 'APROVADO', 'RECUSADO', 'EXPIRADO', 'CONVERTIDO');

-- CreateEnum
CREATE TYPE "Segmento" AS ENUM ('OFICINA', 'USINAGEM', 'CALDEIRARIA');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametros" (
    "tenantId" TEXT NOT NULL,
    "criterioRateio" TEXT NOT NULL DEFAULT 'horas',
    "metodoPreco" TEXT NOT NULL DEFAULT 'divisor',
    "impostosPadrao" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "comissaoPadrao" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "margemAlvo" DECIMAL(9,6) NOT NULL DEFAULT 0.2,
    "margemMinima" DECIMAL(9,6) NOT NULL DEFAULT 0.15,
    "validadeOrcamentoDias" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "Parametros_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT NOT NULL DEFAULT '',
    "vinculo" "Vinculo" NOT NULL DEFAULT 'CLT',
    "salario" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "encargos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "beneficios" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "jornadaHoras" DECIMAL(9,2) NOT NULL DEFAULT 220,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroTrabalho" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'maquina',
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "horasExpediente" DECIMAL(9,2) NOT NULL DEFAULT 220,
    "eficiencia" DECIMAL(9,6) NOT NULL DEFAULT 0.75,
    "manutencao" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "insumos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outros" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorAquisicao" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "valorResidual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vidaUtilMeses" INTEGER NOT NULL DEFAULT 0,
    "potenciaKw" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "fatorCarga" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "tarifaKwh" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "pesoManual" DECIMAL(9,6),
    "areaM2" DECIMAL(12,2),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroTrabalho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroOperador" (
    "tenantId" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "alocacao" DECIMAL(9,6) NOT NULL,

    CONSTRAINT "CentroOperador_pkey" PRIMARY KEY ("centroId","colaboradorId")
);

-- CreateTable
CREATE TABLE "LancamentoCustoFixo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "valor" DECIMAL(14,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LancamentoCustoFixo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TabelaCustos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" "StatusTabela" NOT NULL DEFAULT 'RASCUNHO',
    "desatualizada" BOOLEAN NOT NULL DEFAULT false,
    "entrada" JSONB NOT NULL,
    "resultado" JSONB NOT NULL,
    "publicadaEm" TIMESTAMP(3),
    "encerradaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabelaCustos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoPessoa" NOT NULL,
    "documento" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fantasia" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "telefone" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "uf" TEXT NOT NULL DEFAULT '',
    "status" "StatusCliente" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orcamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tabelaCustosId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "segmento" "Segmento" NOT NULL,
    "lote" INTEGER NOT NULL,
    "validade" DATE NOT NULL,
    "impostos" DECIMAL(9,6) NOT NULL,
    "comissao" DECIMAL(9,6) NOT NULL,
    "margemAlvo" DECIMAL(9,6) NOT NULL,
    "margemMinima" DECIMAL(9,6) NOT NULL,
    "desconto" DECIMAL(9,6) NOT NULL,
    "metodo" TEXT NOT NULL DEFAULT 'divisor',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "linhas" JSONB NOT NULL,
    "resultado" JSONB NOT NULL,
    "status" "StatusOrcamento" NOT NULL DEFAULT 'RASCUNHO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "precoFinalLote" DECIMAL(18,10) NOT NULL,
    "margemEfetiva" DECIMAL(18,10) NOT NULL,
    "situacaoMargem" TEXT NOT NULL,
    "exigeAprovacao" BOOLEAN NOT NULL DEFAULT false,
    "margemLiberada" BOOLEAN NOT NULL DEFAULT false,
    "justificativaLiberacao" TEXT,
    "liberadaPorId" TEXT,
    "motivoRecusa" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "aprovadoEm" TIMESTAMP(3),
    "recusadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrcamentoHistorico" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" "StatusOrcamento" NOT NULL,
    "evento" TEXT NOT NULL,
    "precoFinalLote" DECIMAL(18,10) NOT NULL,
    "usuarioId" TEXT,
    "detalhe" TEXT,
    "snapshot" JSONB,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrcamentoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequencia" (
    "tenantId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequencia_pkey" PRIMARY KEY ("tenantId","chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_tenantId_idx" ON "Usuario"("tenantId");

-- CreateIndex
CREATE INDEX "Colaborador_tenantId_idx" ON "Colaborador"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CentroTrabalho_tenantId_codigo_key" ON "CentroTrabalho"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "CentroOperador_tenantId_idx" ON "CentroOperador"("tenantId");

-- CreateIndex
CREATE INDEX "CentroOperador_colaboradorId_idx" ON "CentroOperador"("colaboradorId");

-- CreateIndex
CREATE INDEX "LancamentoCustoFixo_tenantId_competencia_idx" ON "LancamentoCustoFixo"("tenantId", "competencia");

-- CreateIndex
CREATE INDEX "TabelaCustos_tenantId_status_idx" ON "TabelaCustos"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TabelaCustos_tenantId_competencia_versao_key" ON "TabelaCustos"("tenantId", "competencia", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tenantId_documento_key" ON "Cliente"("tenantId", "documento");

-- CreateIndex
CREATE INDEX "Orcamento_tenantId_status_idx" ON "Orcamento"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Orcamento_clienteId_idx" ON "Orcamento"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Orcamento_tenantId_numero_key" ON "Orcamento"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "OrcamentoHistorico_orcamentoId_idx" ON "OrcamentoHistorico"("orcamentoId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parametros" ADD CONSTRAINT "Parametros_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroTrabalho" ADD CONSTRAINT "CentroTrabalho_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroOperador" ADD CONSTRAINT "CentroOperador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroOperador" ADD CONSTRAINT "CentroOperador_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "CentroTrabalho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroOperador" ADD CONSTRAINT "CentroOperador_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoCustoFixo" ADD CONSTRAINT "LancamentoCustoFixo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TabelaCustos" ADD CONSTRAINT "TabelaCustos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_tabelaCustosId_fkey" FOREIGN KEY ("tabelaCustosId") REFERENCES "TabelaCustos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrcamentoHistorico" ADD CONSTRAINT "OrcamentoHistorico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrcamentoHistorico" ADD CONSTRAINT "OrcamentoHistorico_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequencia" ADD CONSTRAINT "Sequencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
