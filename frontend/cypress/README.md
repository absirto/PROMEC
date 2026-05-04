# E2E Frontend com Cypress

Este projeto utiliza o Cypress para testes end-to-end (E2E) da aplicação React.

## Estrutura
- `cypress/e2e/`: testes E2E
- `cypress/support/`: comandos customizados e setup
- `cypress.config.ts` e `cypress.json`: configuração Cypress

## Rodando os testes

1. Certifique-se que o frontend está rodando em http://localhost:3000
2. Instale as dependências do Cypress:
   ```bash
   npm install --save-dev cypress
   ```
3. Execute o Cypress:
   ```bash
   npx cypress open
   # ou para rodar em modo headless
   npx cypress run
   ```

## Exemplo de teste
Veja `cypress/e2e/basic_login.cy.ts` para um teste básico de login e navegação.

## Dicas
- Adicione mais comandos customizados em `cypress/support/commands.ts`.
- Use `cy.login()` para autenticação rápida nos testes.
