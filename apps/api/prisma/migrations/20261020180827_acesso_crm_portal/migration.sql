-- CreateEnum
CREATE TYPE "EtapaOportunidade" AS ENUM ('LEAD', 'CONTATO', 'ORCAMENTO_ENVIADO', 'NEGOCIACAO', 'GANHO', 'PERDIDO');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "telefone" TEXT;

-- AlterTable
ALTER TABLE "Orcamento" ADD COLUMN     "objeto" JSONB;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "colaboradorId" TEXT,
ADD COLUMN     "perfilId" TEXT,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "trocarSenha" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ultimoAcesso" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Perfil" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "papelLegado" "Papel",
    "permissoes" TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "acao" TEXT NOT NULL,
    "rota" TEXT,
    "antes" JSONB,
    "depois" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "link" TEXT,
    "chave" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oportunidade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "clienteId" TEXT,
    "contato" TEXT NOT NULL DEFAULT '',
    "origem" TEXT NOT NULL DEFAULT 'OUTRO',
    "etapa" "EtapaOportunidade" NOT NULL DEFAULT 'LEAD',
    "valorEstimado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "responsavelId" TEXT,
    "orcamentoId" TEXT,
    "motivoPerda" TEXT,
    "concorrente" TEXT,
    "precoAceito" DECIMAL(14,2),
    "observacao" TEXT,
    "ganhoEm" TIMESTAMP(3),
    "perdidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "clienteId" TEXT,
    "oportunidadeId" TEXT,
    "orcamentoId" TEXT,
    "responsavelId" TEXT NOT NULL,
    "observacao" TEXT,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "concluidaEm" TIMESTAMP(3),
    "resultado" TEXT,
    "chave" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemCliente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "link" TEXT,
    "usuarioId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AceiteOrcamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "precoFinalLote" DECIMAL(18,10) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AceiteOrcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoNps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "ip" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvaliacaoNps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_tenantId_nome_key" ON "Perfil"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entidade_entidadeId_idx" ON "AuditLog"("tenantId", "entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_data_idx" ON "AuditLog"("tenantId", "data");

-- CreateIndex
CREATE INDEX "Notificacao_tenantId_usuarioId_lida_idx" ON "Notificacao"("tenantId", "usuarioId", "lida");

-- CreateIndex
CREATE INDEX "Oportunidade_tenantId_etapa_idx" ON "Oportunidade"("tenantId", "etapa");

-- CreateIndex
CREATE INDEX "Oportunidade_orcamentoId_idx" ON "Oportunidade"("orcamentoId");

-- CreateIndex
CREATE INDEX "Atividade_tenantId_responsavelId_concluida_idx" ON "Atividade"("tenantId", "responsavelId", "concluida");

-- CreateIndex
CREATE UNIQUE INDEX "Atividade_tenantId_chave_key" ON "Atividade"("tenantId", "chave");

-- CreateIndex
CREATE INDEX "MensagemCliente_tenantId_clienteId_idx" ON "MensagemCliente"("tenantId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalLink_tipo_recursoId_key" ON "PortalLink"("tipo", "recursoId");

-- CreateIndex
CREATE UNIQUE INDEX "AceiteOrcamento_orcamentoId_key" ON "AceiteOrcamento"("orcamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoNps_osId_key" ON "AvaliacaoNps"("osId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemCliente" ADD CONSTRAINT "MensagemCliente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AceiteOrcamento" ADD CONSTRAINT "AceiteOrcamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoNps" ADD CONSTRAINT "AvaliacaoNps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
