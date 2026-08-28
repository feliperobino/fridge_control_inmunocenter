import { sendReportEmail } from './src/services/mailer.service.js';

try {
  const info = await sendReportEmail({
    to: ['felipe.robino@uc.cl'],
    subject: 'Test manual SMTP - diagnostico',
    text: 'Prueba manual de envio para diagnosticar reportes programados.',
    attachments: []
  });
  console.log('OK ==>', JSON.stringify(info, null, 2));
} catch (err) {
  console.error('FAIL ==>', err);
}
