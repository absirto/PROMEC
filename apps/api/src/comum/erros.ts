import { HttpException } from '@nestjs/common';

export class ErroApi extends HttpException {
  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(detalhes === undefined ? { mensagem, codigo } : { mensagem, codigo, detalhes }, status);
    this.message = mensagem;
  }
}

export const naoEncontrado = (oQue: string, codigo = 'NAO_ENCONTRADO') =>
  new ErroApi(404, codigo, `Não encontramos ${oQue}. Ele pode ter sido removido; volte à lista e escolha de novo.`);

export const conflito = (codigo: string, mensagem: string, detalhes?: unknown) => new ErroApi(409, codigo, mensagem, detalhes);

export const regra = (codigo: string, mensagem: string, detalhes?: unknown) => new ErroApi(422, codigo, mensagem, detalhes);

export const invalido = (mensagem: string, detalhes?: unknown) => new ErroApi(400, 'VALIDACAO', mensagem, detalhes);
