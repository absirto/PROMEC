import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const arquivo = resolve(__dirname, '../.env');
if (existsSync(arquivo)) process.loadEnvFile(arquivo);
