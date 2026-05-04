import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { swaggerSpec } from '../src/utils/swagger';

const out = join(__dirname, '..', '..', 'openapi', 'v1.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(swaggerSpec, null, 2), 'utf8');
// eslint-disable-next-line no-console
console.log('OpenAPI written to', out);
