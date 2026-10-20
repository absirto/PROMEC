-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('BANCO', 'CAIXA');

-- CreateEnum
CREATE TYPE "TipoCentroCusto" AS ENUM ('FIXO', 'VARIAVEL');

-- CreateEnum
CREATE TYPE "TipoTitulo" AS ENUM ('RECEBER', 'PAGAR');

-- CreateEnum
CREATE TYPE "StatusTitulo" AS ENUM ('ABERTO', 'PARCIAL', 'PAGO', 'CANCELADO', 'RENEGOCIADO');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "bloqueioAutomatico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "condicaoPagamento" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "liberadoAte" DATE,
ADD COLUMN     "liberadoPorId" TEXT,
ADD COLUMN     "limiteCredito" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Orcamento" ADD COLUMN     "condicaoPagamento" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vendedorId" TEXT;

-- AlterTable
ALTER TABLE "Parametros" ADD COLUMN     "condicaoPadrao" TEXT NOT NULL DEFAULT 'à vista',
ADD COLUMN     "diasBloqueioInadimplencia" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "jurosMes" DECIMAL(9,6) NOT NULL DEFAULT 0.01,
ADD COLUMN     "multaAtraso" DECIMAL(9,6) NOT NULL DEFAULT 0.02,
ADD COLUMN     "rotinaExecutadaEm" DATE,
ADD COLUMN     "toleranciaCustoFixo" DECIMAL(9,6) NOT NULL DEFAULT 0.1;

-- CreateTable
CREATE TABLE "ContaFinanceira" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoConta" NOT NULL,
    "banco" TEXT,
    "agencia" TEXT,
    "numero" TEXT,
    "saldoInicial" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dataSaldoInicial" DATE NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transferencia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "origemId" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "data" DATE NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCusto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCentroCusto" NOT NULL,
    "compoeCustoFixo" BOOLEAN NOT NULL DEFAULT false,
    "categoriaCustoFixo" TEXT,
    "custoDiretoCentro" JSONB,
    "papel" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CentroCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Titulo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "TipoTitulo" NOT NULL,
    "pessoaTipo" TEXT NOT NULL,
    "clienteId" TEXT,
    "fornecedorId" TEXT,
    "usuarioId" TEXT,
    "pessoaNome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "parcela" TEXT,
    "grupoId" TEXT,
    "centroCustoId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "emissao" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "valorPago" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "StatusTitulo" NOT NULL DEFAULT 'ABERTO',
    "documentoFiscal" TEXT,
    "observacao" TEXT,
    "origemTipo" TEXT NOT NULL DEFAULT 'MANUAL',
    "origemId" TEXT,
    "origemNumero" TEXT,
    "recorrenciaId" TEXT,
    "renegociadoDeId" TEXT,
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Titulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baixa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "multa" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "juros" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "observacao" TEXT,
    "estornada" BOOLEAN NOT NULL DEFAULT false,
    "estornadaEm" TIMESTAMP(3),
    "motivoEstorno" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Baixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recorrencia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "centroCustoId" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "diaVencimento" INTEGER NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comissao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "baixaId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "base" DECIMAL(14,2) NOT NULL,
    "percentual" DECIMAL(9,6) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "estornada" BOOLEAN NOT NULL DEFAULT false,
    "fechamentoTituloId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComissaoFechamento" (
    "tenantId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "fechadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,

    CONSTRAINT "ComissaoFechamento_pkey" PRIMARY KEY ("tenantId","competencia")
);

-- CreateTable
CREATE TABLE "TituloHistorico" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tituloId" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "detalhe" TEXT,
    "usuarioId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TituloHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContaFinanceira_tenantId_idx" ON "ContaFinanceira"("tenantId");

-- CreateIndex
CREATE INDEX "Transferencia_tenantId_idx" ON "Transferencia"("tenantId");

-- CreateIndex
CREATE INDEX "CentroCusto_tenantId_idx" ON "CentroCusto"("tenantId");

-- CreateIndex
CREATE INDEX "Titulo_tenantId_tipo_status_idx" ON "Titulo"("tenantId", "tipo", "status");

-- CreateIndex
CREATE INDEX "Titulo_tenantId_origemId_idx" ON "Titulo"("tenantId", "origemId");

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_tenantId_numero_key" ON "Titulo"("tenantId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Titulo_recorrenciaId_competencia_key" ON "Titulo"("recorrenciaId", "competencia");

-- CreateIndex
CREATE INDEX "Baixa_tenantId_data_idx" ON "Baixa"("tenantId", "data");

-- CreateIndex
CREATE INDEX "Recorrencia_tenantId_idx" ON "Recorrencia"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Comissao_baixaId_key" ON "Comissao"("baixaId");

-- CreateIndex
CREATE INDEX "Comissao_tenantId_competencia_idx" ON "Comissao"("tenantId", "competencia");

-- CreateIndex
CREATE INDEX "TituloHistorico_tituloId_idx" ON "TituloHistorico"("tituloId");

-- AddForeignKey
ALTER TABLE "ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCusto" ADD CONSTRAINT "CentroCusto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baixa" ADD CONSTRAINT "Baixa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baixa" ADD CONSTRAINT "Baixa_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recorrencia" ADD CONSTRAINT "Recorrencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comissao" ADD CONSTRAINT "Comissao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComissaoFechamento" ADD CONSTRAINT "ComissaoFechamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TituloHistorico" ADD CONSTRAINT "TituloHistorico_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
