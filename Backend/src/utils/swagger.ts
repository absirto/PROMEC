import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import { Express } from 'express';
import path from 'path';

const defaultPort = process.env.PORT || '3000';
const swaggerServerUrl = process.env.SWAGGER_SERVER_URL;

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ProMEC API',
    version: '1.0.0',
    description: 'Documentação automática da API ProMEC',
  },
  servers: [
    {
      url: swaggerServerUrl,
      description: 'Servidor local',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Autenticação e sessão do usuário' },
    { name: 'Audit', description: 'Trilha de auditoria de ações do sistema' },
    { name: 'Dashboard', description: 'Indicadores e resumos gerenciais' },
    { name: 'Employees', description: 'Funcionários' },
    { name: 'JobRoles', description: 'Cargos/funções de funcionários' },
    { name: 'External', description: 'Integrações e endpoints públicos externos' },
    { name: 'Finance', description: 'Financeiro' },
    { name: 'Materials', description: 'Materiais e catálogo de itens' },
    { name: 'Notifications', description: 'Notificações do usuário' },
    { name: 'People', description: 'Clientes e pessoas (físicas/jurídicas)' },
    { name: 'QualityControl', description: 'Controle de qualidade' },
    { name: 'Reports', description: 'Relatórios' },
    { name: 'Services', description: 'Catálogo de serviços' },
    { name: 'ServiceOrders', description: 'Ordens de serviço' },
    { name: 'Settings', description: 'Configurações do sistema' },
    { name: 'Stock', description: 'Estoque e movimentações (StockLog)' },
    { name: 'Users', description: 'Usuários do sistema' },
    { name: 'Groups', description: 'Grupos de acesso e permissões' },
    { name: 'WorkAreas', description: 'Áreas de trabalho' },
  ],
  // Aplicado a todas as operações por padrão; endpoints públicos (ex: login)
  // devem declarar `security: []` no próprio bloco @swagger para sobrescrever.
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
        description: 'JWT emitido em /v1/auth/login e enviado automaticamente pelo browser via cookie HttpOnly.',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Alternativa ao cookie para clientes não-browser (apps mobile, Postman): "Authorization: Bearer <token>".',
      },
    },
    schemas: {
      ErrorMessage: {
        type: 'object',
        description: 'Formato padrão de erro. Respostas de erro (status >= 400) não passam pelo envelope de sucesso.',
        properties: {
          error: { type: 'string', example: 'Recurso não encontrado.' },
          message: { type: 'string', example: 'Recurso não encontrado.' },
          details: { type: 'string', example: 'Detalhe adicional do erro.' },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        description: 'Erro de validação de payload (middleware validateBody, baseado em Joi).',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Erro de validação' },
          details: {
            type: 'array',
            items: { type: 'string' },
            example: ['"name" is required'],
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 42 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 3 },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Não autenticado — token ausente ou inválido.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorMessage' },
            examples: {
              semToken: { summary: 'Token não fornecido', value: { message: 'Token não fornecido' } },
              tokenInvalido: { summary: 'Token inválido', value: { message: 'Token inválido' } },
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Autenticado, porém sem permissão para executar esta ação.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorMessage' },
            examples: {
              permissaoInsuficiente: {
                summary: 'Permissão insuficiente',
                value: { message: 'Permissão insuficiente', required: ['modulo:gerenciar'] },
              },
            },
          },
        },
      },
      NotFoundError: {
        description: 'Recurso não encontrado.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorMessage' },
          },
        },
      },
      ValidationError: {
        description: 'Payload inválido.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
          },
        },
      },
      ServerError: {
        description: 'Erro interno inesperado.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorMessage' },
          },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, '../modules/*/routes/*.js'), path.join(__dirname, '../modules/*/controllers/*.js')],
};

const optionsDev = {
  swaggerDefinition,
  apis: [path.join(__dirname, '../modules/*/routes/*.ts'), path.join(__dirname, '../modules/*/controllers/*.ts')],
};

export const swaggerSpec = swaggerJSDoc(
  process.env.NODE_ENV === 'production' ? options : optionsDev,
);

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
