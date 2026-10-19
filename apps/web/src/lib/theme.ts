import { useEffect, useState } from 'react';
import { gravar, ler } from './storage';

export type Tema = 'claro' | 'escuro' | 'alto-contraste';
const CHAVE = 'promec.tema';

const inicial = (): Tema => {
  const t = ler(CHAVE);
  return t === 'escuro' || t === 'alto-contraste' ? t : 'claro';
};

export function aplicarTemaInicial() {
  document.documentElement.dataset.theme = inicial();
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(inicial);
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    gravar(CHAVE, tema);
  }, [tema]);
  return [tema, setTema] as const;
}
