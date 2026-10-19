import { Matches } from 'class-validator';

export class CriarTabelaDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  competencia: string;
}
