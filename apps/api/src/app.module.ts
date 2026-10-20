import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CentrosModule } from './centros-trabalho/centros.module';
import { ClientesModule } from './clientes/clientes.module';
import { ColaboradoresModule } from './colaboradores/colaboradores.module';
import { CustoFixoModule } from './custo-fixo/custo-fixo.module';
import { OrcamentosModule } from './orcamentos/orcamentos.module';
import { OrdensModule } from './ordens/ordens.module';
import { AgendaModule } from './agenda/agenda.module';
import { PainelModule } from './painel/painel.module';
import { PlanejamentoModule } from './planejamento/planejamento.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { AcessoModule } from './acesso/acesso.module';
import { AuditoriaModule } from './auditoria/auditoria.controller';
import { CrmModule } from './crm/crm.controller';
import { NotificacoesModule } from './notificacoes/notificacoes.controller';
import { PortalModule } from './portal/portal.controller';
import { ManutencaoModule } from './manutencao/manutencao.controller';
import { RhModule } from './rh/rh.controller';
import { QualidadeModule } from './qualidade/qualidade.module';
import { SuprimentosModule } from './suprimentos/suprimentos.module';
import { ParametrosModule } from './parametros/parametros.module';
import { PrismaModule } from './prisma/prisma.service';
import { TabelasModule } from './tabelas-custos/tabelas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ParametrosModule,
    ColaboradoresModule,
    CentrosModule,
    CustoFixoModule,
    TabelasModule,
    ClientesModule,
    OrcamentosModule,
    OrdensModule,
    PlanejamentoModule,
    AgendaModule,
    SuprimentosModule,
    QualidadeModule,
    FinanceiroModule,
    AcessoModule,
    AuditoriaModule,
    NotificacoesModule,
    CrmModule,
    PortalModule,
    ManutencaoModule,
    RhModule,
    PainelModule
  ]
})
export class AppModule {}
