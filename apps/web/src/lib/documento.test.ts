import { describe, expect, it } from 'vitest';
import { cnpjValido, cpfValido, mascaraCnpj, mascaraCpf, mascaraTelefone } from './documento';

describe('CPF e CNPJ', () => {
  it('valida dígitos do CPF', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });
  it('valida dígitos do CNPJ', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
  });
  it('aplica máscaras enquanto digita', () => {
    expect(mascaraCpf('52998224725')).toBe('529.982.247-25');
    expect(mascaraCpf('5299')).toBe('529.9');
    expect(mascaraCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(mascaraCnpj('112223')).toBe('11.222.3');
    expect(mascaraTelefone('47999990000')).toBe('(47) 99999-0000');
    expect(mascaraTelefone('4733330000')).toBe('(47) 3333-0000');
  });
});
