-- CreateEnum
CREATE TYPE "TipoItem" AS ENUM ('MATERIA_PRIMA', 'PECA_REPOSICAO', 'INSUMO', 'FERRAMENTA_GERAL', 'FERRAMENTA_ESPECIFICA', 'PRODUTO_ACABADO', 'SERVICO_EXTERNO');

-- CreateEnum
CREATE TYPE "TipoLocal" AS ENUM ('ALMOXARIFADO', 'PECAS', 'MATERIA_PRIMA', 'FERRAMENTARIA');

-- CreateEnum
CREATE TYPE "TipoMovimento" AS ENUM ('ENTRADA_RECEBIMENTO', 'ENTRADA_AVULSA', 'SAIDA_OS', 'ESTORNO_OS', 'SAIDA_CENTRO', 'AJUSTE', 'TRANSFERENCIA', 'PERDA', 'DEVOLUCAO');

-- CreateEnum
CREATE TYPE "StatusReserva" AS ENUM ('ATIVA', 'ATENDIDA', 'LIBERADA');

-- CreateEnum
CREATE TYPE "StatusRequisicao" AS ENUM ('ABERTA', 'EM_COTACAO', 'ATENDIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "OrigemRequisicao" AS ENUM ('OS', 'PONTO_PEDIDO', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusCotacao" AS ENUM ('ABERTA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('AGUARDANDO_APROVACAO', 'APROVADO', 'PARCIAL', 'RECEBIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "OrigemNc" AS ENUM ('MATERIAL', 'PROCESSO', 'OPERADOR', 'PROJETO', 'FORNECEDOR');

-- CreateEnum
CREATE TYPE "StatusNc" AS ENUM ('ABERTA', 'EM_TRATAMENTO', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "StatusGarantia" AS ENUM ('EM_ANALISE', 'PROCEDENTE', 'IMPROCEDENTE');

-- AlterTable
ALTER TABLE "Orcamento" ADD COLUMN     "custoDesatualizado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrdemServico" ADD COLUMN     "garantiaDeId" TEXT,
ADD COLUMN     "planoInspecaoId" TEXT,
ADD COLUMN     "planoVersao" INTEGER;

-- AlterTable
ALTER TABLE "OsCusto" ADD COLUMN     "itemId" TEXT;

-- AlterTable
ALTER TABLE "Parametros" ADD COLUMN     "garantiaDias" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "limiteAprovacaoCompra" DECIMAL(14,2) NOT NULL DEFAULT 5000;

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoItem" NOT NULL,
    "unidadeCompra" TEXT NOT NULL,
    "unidadeConsumo" TEXT NOT NULL,
    "fatorConversao" DECIMAL(20,10) NOT NULL DEFAULT 1,
    "pesoPorMetroKg" DECIMAL(14,6),
    "custoMedio" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "ultimoCusto" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "precoVenda" DECIMAL(14,4),
    "margemPeca" DECIMAL(9,6),
    "estoqueMinimo" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "estoqueMaximo" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "fornecedorPreferidoId" TEXT,
    "rastreavel" BOOLEAN NOT NULL DEFAULT false,
    "categoriaDespesa" TEXT NOT NULL DEFAULT '',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
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
    "categorias" TEXT[],
    "prazoMedioDias" INTEGER NOT NULL DEFAULT 0,
    "condicaoPagamento" TEXT NOT NULL DEFAULT '',
    "avaliacao" DECIMAL(14,10) NOT NULL DEFAULT 3,
    "entregas" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusCliente" NOT NULL DEFAULT 'ATIVO',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FornecedorItem" (
    "tenantId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "ultimoPreco" DECIMAL(20,10) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FornecedorItem_pkey" PRIMARY KEY ("fornecedorId","itemId")
);

-- CreateTable
CREATE TABLE "LocalEstoque" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoLocal" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Saldo" (
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "fisico" DECIMAL(20,10) NOT NULL DEFAULT 0,

    CONSTRAINT "Saldo_pkey" PRIMARY KEY ("itemId","localId")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "recebimentoId" TEXT,
    "localId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantidadeInicial" DECIMAL(20,10) NOT NULL,
    "saldo" DECIMAL(20,10) NOT NULL,
    "certificado" JSONB,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoMovimento" NOT NULL,
    "itemId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "quantidade" DECIMAL(20,10) NOT NULL,
    "custoUnitario" DECIMAL(20,10) NOT NULL,
    "valor" DECIMAL(20,10) NOT NULL,
    "loteId" TEXT,
    "osId" TEXT,
    "osCustoId" TEXT,
    "centroId" TEXT,
    "recebimentoId" TEXT,
    "inventarioId" TEXT,
    "estornoDeId" TEXT,
    "estornado" BOOLEAN NOT NULL DEFAULT false,
    "usuarioId" TEXT,
    "observacao" TEXT,

    CONSTRAINT "Movimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "quantidade" DECIMAL(20,10) NOT NULL,
    "consumida" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "status" "StatusReserva" NOT NULL DEFAULT 'ATIVA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisicao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" "StatusRequisicao" NOT NULL DEFAULT 'ABERTA',
    "origem" "OrigemRequisicao" NOT NULL DEFAULT 'MANUAL',
    "osId" TEXT,
    "cotacaoId" TEXT,
    "pedidoId" TEXT,
    "observacao" TEXT NOT NULL DEFAULT '',
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Requisicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequisicaoItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requisicaoId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantidade" DECIMAL(20,10) NOT NULL,

    CONSTRAINT "RequisicaoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" "StatusCotacao" NOT NULL DEFAULT 'ABERTA',
    "requisicaoIds" TEXT[],
    "fornecedorIds" TEXT[],
    "itens" JSONB NOT NULL,
    "fornecedorEscolhidoId" TEXT,
    "justificativa" TEXT,
    "pedidoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cotacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotacaoResposta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cotacaoId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "itens" JSONB NOT NULL,
    "frete" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "prazoDias" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CotacaoResposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "cotacaoId" TEXT,
    "status" "StatusPedido" NOT NULL,
    "frete" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(20,10) NOT NULL,
    "previsaoEntrega" DATE NOT NULL,
    "condicaoPagamento" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "aprovadoPorId" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantidade" DECIMAL(20,10) NOT NULL,
    "precoUnitario" DECIMAL(20,10) NOT NULL,
    "recebido" DECIMAL(20,10) NOT NULL DEFAULT 0,

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recebimento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "notaFiscal" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itens" JSONB NOT NULL,
    "divergencias" JSONB NOT NULL,
    "noPrazo" BOOLEAN NOT NULL,
    "contaPagar" JSONB NOT NULL,
    "observacao" TEXT,
    "usuarioId" TEXT,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itens" JSONB NOT NULL,
    "usuarioId" TEXT,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanoInspecao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "segmento" "Segmento" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "exigeInspecao" BOOLEAN NOT NULL DEFAULT true,
    "itens" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanoInspecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NaoConformidade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "origem" "OrigemNc" NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "StatusNc" NOT NULL DEFAULT 'ABERTA',
    "osId" TEXT,
    "centroId" TEXT,
    "loteId" TEXT,
    "fornecedorId" TEXT,
    "colaboradorId" TEXT,
    "causa" TEXT,
    "acaoCorretiva" TEXT,
    "responsavelId" TEXT,
    "prazo" DATE,
    "eficaz" BOOLEAN,
    "encerradaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NaoConformidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garantia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "osId" TEXT NOT NULL,
    "relato" TEXT NOT NULL,
    "status" "StatusGarantia" NOT NULL DEFAULT 'EM_ANALISE',
    "analise" TEXT,
    "osGarantiaId" TEXT,
    "decididaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Garantia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_tenantId_codigo_key" ON "Item"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_tenantId_documento_key" ON "Fornecedor"("tenantId", "documento");

-- CreateIndex
CREATE INDEX "LocalEstoque_tenantId_idx" ON "LocalEstoque"("tenantId");

-- CreateIndex
CREATE INDEX "Saldo_tenantId_idx" ON "Saldo"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_tenantId_itemId_codigo_key" ON "Lote"("tenantId", "itemId", "codigo");

-- CreateIndex
CREATE INDEX "Movimento_tenantId_itemId_idx" ON "Movimento"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "Movimento_tenantId_osId_idx" ON "Movimento"("tenantId", "osId");

-- CreateIndex
CREATE INDEX "Movimento_tenantId_data_idx" ON "Movimento"("tenantId", "data");

-- CreateIndex
CREATE INDEX "Reserva_tenantId_itemId_idx" ON "Reserva"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "Reserva_osId_idx" ON "Reserva"("osId");

-- CreateIndex
CREATE UNIQUE INDEX "Requisicao_tenantId_numero_key" ON "Requisicao"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "RequisicaoItem_itemId_idx" ON "RequisicaoItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Cotacao_tenantId_numero_key" ON "Cotacao"("tenantId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "CotacaoResposta_cotacaoId_fornecedorId_key" ON "CotacaoResposta"("cotacaoId", "fornecedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_tenantId_numero_key" ON "Pedido"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "PlanoInspecao_tenantId_idx" ON "PlanoInspecao"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanoInspecao_planoId_versao_key" ON "PlanoInspecao"("planoId", "versao");

-- CreateIndex
CREATE INDEX "NaoConformidade_tenantId_osId_idx" ON "NaoConformidade"("tenantId", "osId");

-- CreateIndex
CREATE UNIQUE INDEX "NaoConformidade_tenantId_numero_key" ON "NaoConformidade"("tenantId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Garantia_tenantId_numero_key" ON "Garantia"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FornecedorItem" ADD CONSTRAINT "FornecedorItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FornecedorItem" ADD CONSTRAINT "FornecedorItem_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FornecedorItem" ADD CONSTRAINT "FornecedorItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalEstoque" ADD CONSTRAINT "LocalEstoque_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saldo" ADD CONSTRAINT "Saldo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saldo" ADD CONSTRAINT "Saldo_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saldo" ADD CONSTRAINT "Saldo_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalEstoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimento" ADD CONSTRAINT "Movimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimento" ADD CONSTRAINT "Movimento_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisicao" ADD CONSTRAINT "Requisicao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicaoItem" ADD CONSTRAINT "RequisicaoItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisicaoItem" ADD CONSTRAINT "RequisicaoItem_requisicaoId_fkey" FOREIGN KEY ("requisicaoId") REFERENCES "Requisicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotacao" ADD CONSTRAINT "Cotacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotacaoResposta" ADD CONSTRAINT "CotacaoResposta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotacaoResposta" ADD CONSTRAINT "CotacaoResposta_cotacaoId_fkey" FOREIGN KEY ("cotacaoId") REFERENCES "Cotacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoInspecao" ADD CONSTRAINT "PlanoInspecao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaoConformidade" ADD CONSTRAINT "NaoConformidade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garantia" ADD CONSTRAINT "Garantia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
