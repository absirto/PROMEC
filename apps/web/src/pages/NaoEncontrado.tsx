import { Home } from 'lucide-react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/Button';
import { useTitulo } from '../layout/titulo';

export function NaoEncontrado() {
  useTitulo('Página não encontrada');
  return (
    <Card>
      <EmptyState
        ilustracao="paquimetro"
        titulo="Essa peça não está na prateleira"
        texto="O endereço não existe ou mudou de lugar. Volte ao painel e siga de lá."
        acao={<Button variante="primario" icone={Home} to="/">Ir para o painel</Button>}
      />
    </Card>
  );
}
