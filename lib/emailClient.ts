import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

export function getEmailTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('Email not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing');
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  return transporter;
}

export interface PlanChangeEmailParams {
  to: string;
  customerName: string;
  requestId: string;
  currentPlanName: string;
  newPlanName: string;
  effectiveDate: string;
}

export async function sendPlanChangeNotification(params: PlanChangeEmailParams): Promise<boolean> {
  const emailTransporter = getEmailTransporter();

  if (!emailTransporter) {
    console.log('Email skipped: transporter not configured');
    return false;
  }

  try {
    await emailTransporter.sendMail({
      from: process.env.GMAIL_USER,
      to: params.to,
      subject: `【電力サポート】プラン変更申請を受け付けました（受付番号: ${params.requestId}）`,
      html: `
        <h2>プラン変更申請のお知らせ</h2>
        <p>${params.customerName} 様</p>
        <p>プラン変更申請を受け付けました。</p>
        <hr>
        <h3>変更内容</h3>
        <ul>
          <li><strong>受付番号:</strong> ${params.requestId}</li>
          <li><strong>現在のプラン:</strong> ${params.currentPlanName}</li>
          <li><strong>変更後のプラン:</strong> ${params.newPlanName}</li>
          <li><strong>適用開始:</strong> ${params.effectiveDate}</li>
        </ul>
        <hr>
        <p>変更内容に誤りがある場合は、お電話にてお問い合わせください。</p>
        <p>株式会社 電力サポート</p>
      `
    });

    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}
