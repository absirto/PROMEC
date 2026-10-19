import { cnpjValido, completarCnpj, cpfValido } from './documento';

describe('documento', () => {
  it('confere CNPJ pelos dígitos verificadores', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
    expect(cnpjValido(completarCnpj('128473650001'))).toBe(true);
  });

  it('confere CPF pelos dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('00000000000')).toBe(false);
  });
});
