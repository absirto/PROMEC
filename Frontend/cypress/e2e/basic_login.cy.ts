// cypress/e2e/basic_login.cy.ts

describe('Login e navegação básica', () => {
  it('Deve exibir tela de login e autenticar usuário', () => {
    cy.visit('/login');
    cy.get('input[name="username"], input[type="email"]').type('admin@admin.com');
    cy.get('input[name="password"]').type('123456');
    cy.get('button[type="submit"]').click();
    cy.url().should('not.include', '/login');
    cy.contains('Dashboard');
  });

  it('Deve navegar para página de funcionários', () => {
    cy.login('admin@admin.com', '123456'); // custom command opcional
    cy.visit('/employees');
    cy.contains('Funcionários');
  });
});
