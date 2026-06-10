// Função utilitária para obter a versão do deploy
export function getDeployVersion(): string {
  // Tenta obter de uma variável de ambiente, fallback para "1.0.0"
  return import.meta.env.VITE_VERSION || '1.0.0';
}
