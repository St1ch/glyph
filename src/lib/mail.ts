import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let transporter: Transporter | null = null;

function getMailConfig() {
  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.MAIL_FROM || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false",
    user,
    pass,
    from,
  };
}

export function isMailConfigured() {
  return Boolean(getMailConfig());
}

function getTransporter() {
  const config = getMailConfig();

  if (!config) {
    throw new Error("SMTP не настроен.");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  return { transporter, from: config.from };
}

export async function sendMail(input: SendMailInput) {
  const mailer = getTransporter();

  await mailer.transporter.sendMail({
    from: mailer.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export async function sendVerificationEmail(to: string, verificationLink: string) {
  await sendMail({
    to,
    subject: "Подтвердите регистрацию в GLYPH",
    text: `Подтвердите почту и завершите регистрацию: ${verificationLink}`,
    html: `
      <div style="background:#111111;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f5f5;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border:1px solid #2e2e2e;border-radius:24px;padding:32px;">
          <div style="font-size:28px;font-weight:700;letter-spacing:0.04em;">GLYPH</div>
          <h1 style="margin:24px 0 12px;font-size:28px;line-height:1.2;">Подтвердите почту</h1>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#b9b9b9;">
            Чтобы завершить регистрацию и войти в аккаунт, подтвердите ваш email.
          </p>
          <a href="${verificationLink}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#84b82c;color:#111111;text-decoration:none;font-weight:700;">
            Подтвердить email
          </a>
          <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#8b8b8b;">
            Если кнопка не открывается, используйте эту ссылку:<br />
            <a href="${verificationLink}" style="color:#b8df62;word-break:break-all;">${verificationLink}</a>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  await sendMail({
    to,
    subject: "Смена пароля в GLYPH",
    text: `Перейдите по ссылке, чтобы задать новый пароль: ${resetLink}`,
    html: `
      <div style="background:#111111;padding:32px 16px;font-family:Arial,sans-serif;color:#f5f5f5;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border:1px solid #2e2e2e;border-radius:24px;padding:32px;">
          <div style="font-size:28px;font-weight:700;letter-spacing:0.04em;">GLYPH</div>
          <h1 style="margin:24px 0 12px;font-size:28px;line-height:1.2;">Смена пароля</h1>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#b9b9b9;">
            Если вы запросили смену пароля, перейдите по кнопке ниже и задайте новый пароль для аккаунта.
          </p>
          <a href="${resetLink}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#84b82c;color:#111111;text-decoration:none;font-weight:700;">
            Изменить пароль
          </a>
          <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#8b8b8b;">
            Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.<br />
            Прямая ссылка: <a href="${resetLink}" style="color:#b8df62;word-break:break-all;">${resetLink}</a>
          </p>
        </div>
      </div>
    `,
  });
}
