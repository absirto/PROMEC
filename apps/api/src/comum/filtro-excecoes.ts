import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

interface Corpo {
  mensagem: string;
  codigo: string;
  detalhes?: unknown;
}

const PADRAO: Record<number, Corpo> = {
  400: { codigo: 'VALIDACAO', mensagem: 'Não conseguimos entender os dados enviados. Confira os campos e tente de novo.' },
  401: { codigo: 'NAO_AUTENTICADO', mensagem: 'Você precisa entrar no ProMEC para continuar. Faça login e tente de novo.' },
  403: { codigo: 'SEM_PERMISSAO', mensagem: 'Seu perfil não permite essa ação. Peça a um gestor da empresa para fazê-la.' },
  404: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Esse endereço não existe na API do ProMEC. Confira o caminho e o método da requisição.' },
  413: { codigo: 'CORPO_GRANDE', mensagem: 'Os dados enviados passaram do tamanho aceito. Divida em partes menores e envie de novo.' }
};

const INTERNO: Corpo = {
  codigo: 'ERRO_INTERNO',
  mensagem: 'Algo saiu do esperado do nosso lado e nada foi alterado. Tente de novo em instantes; se continuar, fale com o suporte.'
};

@Catch()
export class FiltroExcecoes implements ExceptionFilter {
  private readonly log = new Logger('API');

  catch(ex: unknown, host: ArgumentsHost) {
    const [status, corpo] = this.traduzir(ex);
    if (status >= 500) this.log.error(ex instanceof Error ? ex.stack : String(ex));
    host.switchToHttp().getResponse<Response>().status(status).json(corpo);
  }

  private traduzir(ex: unknown): [number, Corpo] {
    if (ex instanceof HttpException) {
      const status = ex.getStatus();
      const r = ex.getResponse();
      if (typeof r === 'object' && r && 'mensagem' in r && 'codigo' in r) return [status, r as Corpo];
      return [status, PADRAO[status] ?? (status >= 500 ? INTERNO : { codigo: `HTTP_${status}`, mensagem: ex.message })];
    }
    if (ex instanceof Prisma.PrismaClientKnownRequestError) {
      if (ex.code === 'P2002')
        return [409, { codigo: 'DUPLICADO', mensagem: 'Já existe um registro com esses dados. Confira se ele não foi cadastrado antes.' }];
      if (ex.code === 'P2025') return [404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Não encontramos esse registro. Ele pode ter sido removido; volte à lista.' }];
      if (ex.code === 'P2003')
        return [409, { codigo: 'EM_USO', mensagem: 'Esse registro está em uso por outros cadastros e não pode ser removido. Inative-o no lugar.' }];
    }
    if (ex instanceof RangeError) {
      return [422, { codigo: 'CALCULO_INVALIDO', mensagem: `${ex.message} Ajuste os valores e calcule de novo.` }];
    }
    return [500, INTERNO];
  }
}
