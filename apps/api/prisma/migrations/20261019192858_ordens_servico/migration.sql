-- CreateEnum
CREATE TYPE "StatusOs" AS ENUM ('ABERTA', 'EM_FILA', 'EM_EXECUCAO', 'PAUSADA', 'CONTROLE_QUALIDADE', 'CONCLUIDA', 'ENTREGUE', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('BAIXA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "StatusOperacao" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "TipoApontamento" AS ENUM ('SETUP', 'PRODUCAO');

-- AlterTable
ALTER TABLE "Parametros" ADD COLUMN     "limiteServicoRapido" DECIMAL(14,2) NOT NULL DEFAULT 1500;

-- CreateTable
CREATE TABLE "OrdemServico" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "orcamentoId" TEXT,
    "clienteId" TEXT NOT NULL,
    "tabelaCustosId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "segmento" "Segmento" NOT NULL,
    "lote" INTEGER NOT NULL,
    "prazo" DATE NOT NULL,
    "prioridade" "Prioridade" NOT NULL DEFAULT 'NORMAL',
    "objeto" JSONB NOT NULL,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "status" "StatusOs" NOT NULL DEFAULT 'ABERTA',
    "precoFinalLote" DECIMAL(18,10) NOT NULL,
    "impostos" DECIMAL(9,6) NOT NULL,
    "comissao" DECIMAL(9,6) NOT NULL,
    "margemMinima" DECIMAL(9,6) NOT NULL,
    "custoRealFinal" DECIMAL(18,10),
    "desvioFinal" DECIMAL(18,10),
    "recebidoPor" TEXT,
    "documentoEntrega" TEXT,
    "observacaoEntrega" TEXT,
    "entregueEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdemServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OsOperacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "colaboradorId" TEXT,
    "custoHora" DECIMAL(18,10) NOT NULL,
    "setupOrcadoHoras" DECIMAL(12,4) NOT NULL,
    "cicloOrcadoHorasPorPeca" DECIMAL(12,6) NOT NULL,
    "setupConcluido" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusOperacao" NOT NULL DEFAULT 'PENDENTE',
    "retrabalho" BOOLEAN NOT NULL DEFAULT false,
    "orcada" BOOLEAN NOT NULL DEFAULT true,
    "justificativa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OsOperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OsCusto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "orcado" DECIMAL(18,10) NOT NULL,
    "real" DECIMAL(18,10),
    "doOrcamento" BOOLEAN NOT NULL DEFAULT false,
    "justificativa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OsCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apontamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "operacaoId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" "TipoApontamento" NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "horas" DECIMAL(12,6),
    "quantidadeBoa" INTEGER NOT NULL DEFAULT 0,
    "refugo" INTEGER NOT NULL DEFAULT 0,
    "observacao" TEXT,

    CONSTRAINT "Apontamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    "horas" DECIMAL(12,6),
    "observacao" TEXT,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspecao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "itens" JSONB NOT NULL,
    "observacao" TEXT,
    "centroRetrabalhoId" TEXT,
    "usuarioId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OsHistorico" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "status" "StatusOs" NOT NULL,
    "evento" TEXT NOT NULL,
    "detalhe" TEXT,
    "usuarioId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OsHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_orcamentoId_key" ON "OrdemServico"("orcamentoId");

-- CreateIndex
CREATE INDEX "OrdemServico_tenantId_status_idx" ON "OrdemServico"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemServico_tenantId_numero_key" ON "OrdemServico"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "OsOperacao_osId_idx" ON "OsOperacao"("osId");

-- CreateIndex
CREATE INDEX "OsOperacao_tenantId_centroId_idx" ON "OsOperacao"("tenantId", "centroId");

-- CreateIndex
CREATE INDEX "OsCusto_osId_idx" ON "OsCusto"("osId");

-- CreateIndex
CREATE INDEX "Apontamento_osId_idx" ON "Apontamento"("osId");

-- CreateIndex
CREATE INDEX "Apontamento_tenantId_colaboradorId_fim_idx" ON "Apontamento"("tenantId", "colaboradorId", "fim");

-- CreateIndex
CREATE INDEX "Ocorrencia_osId_idx" ON "Ocorrencia"("osId");

-- CreateIndex
CREATE INDEX "Inspecao_osId_idx" ON "Inspecao"("osId");

-- CreateIndex
CREATE INDEX "OsHistorico_osId_idx" ON "OsHistorico"("osId");

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_tabelaCustosId_fkey" FOREIGN KEY ("tabelaCustosId") REFERENCES "TabelaCustos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsOperacao" ADD CONSTRAINT "OsOperacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsOperacao" ADD CONSTRAINT "OsOperacao_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsOperacao" ADD CONSTRAINT "OsOperacao_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "CentroTrabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsOperacao" ADD CONSTRAINT "OsOperacao_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsCusto" ADD CONSTRAINT "OsCusto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsCusto" ADD CONSTRAINT "OsCusto_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apontamento" ADD CONSTRAINT "Apontamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apontamento" ADD CONSTRAINT "Apontamento_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apontamento" ADD CONSTRAINT "Apontamento_operacaoId_fkey" FOREIGN KEY ("operacaoId") REFERENCES "OsOperacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apontamento" ADD CONSTRAINT "Apontamento_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspecao" ADD CONSTRAINT "Inspecao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspecao" ADD CONSTRAINT "Inspecao_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsHistorico" ADD CONSTRAINT "OsHistorico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OsHistorico" ADD CONSTRAINT "OsHistorico_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
