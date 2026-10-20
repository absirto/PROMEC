import { Module } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { EstoqueService } from './estoque.service';
import { FornecedoresService } from './fornecedores.service';
import { ItensService } from './itens.service';
import { ComprasController, EstoqueController, FornecedoresController, ItensController } from './suprimentos.controller';

@Module({
  controllers: [ItensController, FornecedoresController, EstoqueController, ComprasController],
  providers: [ItensService, FornecedoresService, EstoqueService, ComprasService],
  exports: [EstoqueService]
})
export class SuprimentosModule {}
