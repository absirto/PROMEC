-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('MARCADO', 'CONFIRMADO', 'CHEGOU', 'NAO_VEIO', 'CANCELADO');

-- AlterTable
ALTER TABLE "CentroTrabalho" ADD COLUMN     "diasSemana" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];

-- AlterTable
ALTER TABLE "Orcamento" ADD COLUMN     "prazoPrometido" DATE;

-- AlterTable
ALTER TABLE "OrdemServico" ADD COLUMN     "posicaoFila" INTEGER;

-- CreateTable
CREATE TABLE "Feriado" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParadaCentro" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParadaCentro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT,
    "nomeCliente" TEXT,
    "telefone" TEXT,
    "placa" TEXT,
    "veiculo" TEXT,
    "servico" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "colaboradorId" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "duracaoHoras" DECIMAL(8,2) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'MARCADO',
    "osId" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feriado_tenantId_data_key" ON "Feriado"("tenantId", "data");

-- CreateIndex
CREATE INDEX "ParadaCentro_tenantId_centroId_idx" ON "ParadaCentro"("tenantId", "centroId");

-- CreateIndex
CREATE INDEX "Agendamento_tenantId_inicio_idx" ON "Agendamento"("tenantId", "inicio");

-- CreateIndex
CREATE INDEX "Agendamento_tenantId_centroId_idx" ON "Agendamento"("tenantId", "centroId");

-- AddForeignKey
ALTER TABLE "Feriado" ADD CONSTRAINT "Feriado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParadaCentro" ADD CONSTRAINT "ParadaCentro_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParadaCentro" ADD CONSTRAINT "ParadaCentro_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "CentroTrabalho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "CentroTrabalho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OrdemServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
