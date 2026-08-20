import nodemailer from 'nodemailer';
import env from '../config/env.js';

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (env.smtpHost) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

export async function sendReportEmail({ to, subject, text, attachments }) {
  if (!Array.isArray(to) || to.length === 0) {
    throw new Error('Recipients are required');
  }

  return getTransporter().sendMail({
    from: env.smtpFrom,
    to: to.join(','),
    subject,
    text,
    attachments
  });
}