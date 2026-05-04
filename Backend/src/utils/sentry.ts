import * as Sentry from '@sentry/node';

export function setupSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
  });
}
