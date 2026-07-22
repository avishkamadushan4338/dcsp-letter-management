import { env } from "@dcsp-letter-management/env/server";
import nodemailer from "nodemailer";

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransport() {
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: env.SMTP_SECURE === "true",
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return cachedTransport;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendMail({ to, subject, html }: SendMailInput) {
  await getTransport().sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
  });
}
