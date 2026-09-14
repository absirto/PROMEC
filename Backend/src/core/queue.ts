import Bull from 'bull';
import { logger } from '../utils/logger';
import { sendWelcomeEmail } from '../utils/mailer';
import * as Sentry from '@sentry/node';

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = Number(process.env.REDIS_PORT) || 6379;

export const generalQueue =
  process.env.NODE_ENV === 'test'
    ? null
    : new Bull('general-queue', {
        redis: redisUrl
          ? redisUrl
          : { host: redisHost, port: redisPort },
      });

if (generalQueue) {
  generalQueue.process(async (job) => {
    logger.info(`Processando job: ${job.id} | Tipo: ${job.data.type}`);
    switch (job.data.type) {
      case 'email': {
        const { to, firstName } = job.data.payload as { to: string; firstName: string };
        await sendWelcomeEmail(to, firstName);
        break;
      }
      case 'relatorio':
        // TODO: nenhum fluxo de relatório usa fila hoje — ReportsController gera tudo
        // de forma síncrona. Implementar quando houver necessidade de relatório assíncrono.
        break;
      default:
        logger.warn('Tipo de job desconhecido:', job.data.type);
    }
  });

  generalQueue.on('completed', (job) => {
    logger.info(`Job ${job.id} concluído!`);
  });

  generalQueue.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} falhou: ${err}`);
    Sentry.captureException(err, {
      extra: { jobId: job?.id, jobData: job?.data },
      tags: { queue: 'general-queue' },
    });
  });
}
