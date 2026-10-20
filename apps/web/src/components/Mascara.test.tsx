import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CustoHora } from './Mascara';
import { DICA_MASCARA } from '../lib/permissoes';

const perm = { ver: true };
vi.mock('../lib/auth', () => ({ useAuth: () => ({ pode: (c: string) => c !== 'custo.ver_custo_hora' || perm.ver }) }));
afterEach(cleanup);

describe('CustoHora', () => {
  it('mostra o valor para quem pode ver', () => {
    perm.ver = true;
    render(<CustoHora valor="117.78" sufixo="/h" />);
    expect(screen.getByText(/R\$\s?117,78\/h/)).toBeTruthy();
  });
  it('mascara sem permissão, com a dica', () => {
    perm.ver = false;
    render(<CustoHora valor="117.78" />);
    const m = screen.getByLabelText(DICA_MASCARA);
    expect(m.textContent).toContain('••••');
    expect(m.getAttribute('title')).toBe(DICA_MASCARA);
    expect(screen.queryByText(/117/)).toBeNull();
  });
  it('mascara quando a API devolve null', () => {
    perm.ver = true;
    render(<CustoHora valor={null} />);
    expect(screen.getByLabelText(DICA_MASCARA)).toBeTruthy();
  });
});
