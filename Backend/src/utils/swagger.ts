import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import { Express } from 'express';
import path from 'path';

const defaultPort = process.env.PORT || '3000';
const swaggerServerUrl = process.env.SWAGGER_SERVER_URL || `http://localhost:${defaultPort}`;

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
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, '../routes/*.js'), path.join(__dirname, '../controllers/*.js')],
};

const optionsDev = {
  swaggerDefinition,
  apis: [path.join(__dirname, '../routes/*.ts'), path.join(__dirname, '../controllers/*.ts')],
};

export const swaggerSpec = swaggerJSDoc(
  process.env.NODE_ENV === 'production' ? options : optionsDev,
);

export function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
