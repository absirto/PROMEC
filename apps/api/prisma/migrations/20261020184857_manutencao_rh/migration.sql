-- AlterTable
ALTER TABLE "Colaborador" ADD COLUMN     "diasSemana" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
ADD COLUMN     "encargosPercentual" DECIMAL(9,6),
ADD COLUMN     "turno" TEXT;

-- AlterTable
ALTER TABLE "Movimento" ADD COLUMN     "ordemManutencaoId" TEXT;

-- AlterTable
ALTER TABLE "ParadaCentro" ADD COLUMN     "ordemManutencaoId" TEXT,
ALTER COLUMN "fim" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Parametros" ADD COLUMN     "encargosPorVinculo" JSONB NOT NULL DEFAULT '{"CLT":"0.64","HORISTA":"0.64","PJ":"0","SOCIO":"0"}';

-- CreateTable
CREATE TABLE "PlanoManutencao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "intervaloHoras" DECIMAL(12,2),
    "intervaloDias" INTEGER,
    "duracaoHoras" DECIMAL(8,2) NOT NULL DEFAULT 4,
    "checklist" TEXT[],
    "ultimaExecucao" DATE,
    "contadorDesde" TIMESTAMP(3),
    "horasAjuste" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanoManutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdemManutencao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "planoId" TEXT,
    "execucao" TEXT NOT NULL DEFAULT 'INTERNA',
    "fornecedorId" TEXT,
    "descricao" TEXT NOT NULL,
    "prevista" DATE,
    "inicio" TIMESTAMP(3),
    "fim" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "bloqueiaAgenda" BOOLEAN NOT NULL DEFAULT false,
    "paradaId" TEXT,
    "horasParado" DECIMAL(10,4),
    "checklist" JSONB,
    "observacao" TEXT,
    "motivoCancelamento" TEXT,
    "osAfetadas" JSONB NOT NULL DEFAULT '[]',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdemManutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustoManutencao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ordemId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "itemId" TEXT,
    "quantidade" DECIMAL(20,10),
    "colaboradorId" TEXT,
    "horas" DECIMAL(10,4),
    "fornecedorId" TEXT,
    "valor" DECIMAL(14,2) NOT NULL,
    "movimentoId" TEXT,
    "tituloId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustoManutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ausencia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ausencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habilitacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "emissao" DATE NOT NULL,
    "validade" DATE NOT NULL,
    "documento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Habilitacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanoManutencao_tenantId_centroId_idx" ON "PlanoManutencao"("tenantId", "centroId");

-- CreateIndex
CREATE INDEX "OrdemManutencao_tenantId_centroId_status_idx" ON "OrdemManutencao"("tenantId", "centroId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrdemManutencao_tenantId_numero_key" ON "OrdemManutencao"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "CustoManutencao_tenantId_data_idx" ON "CustoManutencao"("tenantId", "data");

-- CreateIndex
CREATE INDEX "Ausencia_tenantId_colaboradorId_idx" ON "Ausencia"("tenantId", "colaboradorId");

-- CreateIndex
CREATE INDEX "Habilitacao_tenantId_colaboradorId_centroId_idx" ON "Habilitacao"("tenantId", "colaboradorId", "centroId");

-- AddForeignKey
ALTER TABLE "PlanoManutencao" ADD CONSTRAINT "PlanoManutencao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdemManutencao" ADD CONSTRAINT "OrdemManutencao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustoManutencao" ADD CONSTRAINT "CustoManutencao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustoManutencao" ADD CONSTRAINT "CustoManutencao_ordemId_fkey" FOREIGN KEY ("ordemId") REFERENCES "OrdemManutencao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habilitacao" ADD CONSTRAINT "Habilitacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
