import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Composicao } from './Composicao';
import { gruposComposicao } from './portal';

afterEach(cleanup);

describe('Composicao (portal)', () => {
  it('mostra os 3 grupos com percentual e valor, sem custo nem margem', () => {
    const grupos = gruposComposicao({ composicao: [{ grupo: 'MATERIAL_PECAS', valor: '600.00' }, { grupo: 'MAO_DE_OBRA_MAQUINA', valor: '300.00' }, { grupo: 'TERCEIROS_FRETE', valor: '100.00' }] });
    const { container } = render(<Composicao grupos={grupos} />);
    expect(screen.getByText('Material e peças')).toBeTruthy();
    expect(screen.getByText('Mão de obra e máquina')).toBeTruthy();
    expect(screen.getByText('Serviços de terceiros e frete')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Material e peças 60%');
    expect(container.textContent).not.toMatch(/margem|custo-hora|imposto/i);
  });
  it('não renderiza nada sem composição', () => {
    const { container } = render(<Composicao grupos={gruposComposicao(null)} />);
    expect(container.innerHTML).toBe('');
  });
});
