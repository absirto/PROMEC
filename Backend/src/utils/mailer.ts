import nodemailer from 'nodemailer';
import { logger } from './logger';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpSecure = process.env.SMTP_SECURE === 'true';
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
const mailFrom = process.env.MAIL_FROM || 'ProMEC <no-reply@promec.com.br>';

const transporter = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser ? { user: smtpUser, pass: smtpPassword } : undefined,
    })
  : null;

export async function sendMail(options: { to: string; subject: string; html: string }) {
  if (!transporter) {
    logger.warn('SMTP não configurado (SMTP_HOST vazio) — e-mail não enviado: %s', options.subject);
    return;
  }
  await transporter.sendMail({ from: mailFrom, ...options });
}

export async function sendWelcomeEmail(to: string, firstName: string) {
  await sendMail({
    to,
    subject: 'Bem-vindo(a) ao ProMEC',
    html: `<p>Olá, ${firstName}!</p><p>Sua conta no ProMEC foi criada com sucesso.</p>`,
  });
}
