import nodemailer from "nodemailer";
import { Context, Effect, Layer } from "effect";
import { AppConfig } from "../config/AppConfig.ts";
import * as LinkRepo from "../repositories/LinkRepo.ts";
import * as TokenService from "./TokenService.ts";
import type { Letter, LinkOfficerRole, Officer } from "../domain/types.ts";

// Transporter is built once (from AppConfig) and shared, same as the
// module-level `nodemailer.createTransport(...)` in the old
// server/services/mailService.js.
export class MailTransporter extends Context.Service<MailTransporter, nodemailer.Transporter>()("MailTransporter") {}

export const MailTransporterLive = Layer.effect(
  MailTransporter,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  })
);

interface SendMailInput {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
}

const sendMail = ({ to, subject, html }: SendMailInput) =>
  Effect.gen(function* () {
    const transporter = yield* MailTransporter;
    const config = yield* AppConfig;
    return yield* Effect.tryPromise(() =>
      transporter.sendMail({ from: config.smtpFrom || config.smtpUser, to, subject, html })
    );
  });

interface OfficerLinkEmailInput {
  readonly officerName: string | null;
  readonly roleLabel: string;
  readonly letter: Pick<Letter, "letter_number" | "subject">;
  readonly link: string;
  readonly reassignedFrom?: string | null;
  readonly reassignNote?: string | null;
}

const officerLinkEmail = ({
  officerName,
  roleLabel,
  letter,
  link,
  reassignedFrom,
  reassignNote,
}: OfficerLinkEmailInput) => {
  const subject = `Letter ${letter.letter_number} - action required (${roleLabel})`;
  const reassignRow = reassignedFrom
    ? `<tr><td><strong>Reassigned by</strong></td><td>${reassignedFrom}${reassignNote ? ` - ${reassignNote}` : ""}</td></tr>`
    : "";
  const html = `
    <p>Dear ${officerName},</p>
    <p>A letter has been routed to you as the <strong>${roleLabel}</strong>.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><strong>Letter No.</strong></td><td>${letter.letter_number}</td></tr>
      <tr><td><strong>Subject</strong></td><td>${letter.subject || "-"}</td></tr>
      ${reassignRow}
    </table>
    <p><a href="${link}">Open this letter</a></p>
    <p style="color:#777;font-size:12px">This link is unique to you and expires automatically. Do not forward it.</p>
  `;
  return { subject, html };
};

const issueAndRecordLink = (letterId: number, role: LinkOfficerRole) =>
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const { token, expiresAt } = TokenService.createLetterLinkToken(
      config.linkSecret,
      letterId,
      role,
      config.linkExpiryHours
    );
    yield* LinkRepo.record(letterId, role, token, expiresAt);
    return token;
  });

// Emails both the subject officer and the relevant officer their unique,
// signed link for this letter, and records each link for one-time use -
// port of email.controller.js#sendOfficerLinks. Routes now live at
// /subject-officer?token=... and /relevant-officer?token=... (SPA routes)
// instead of the old *.html?token=... paths.
export const sendOfficerLinks = (letter: Letter) =>
  Effect.gen(function* () {
    const config = yield* AppConfig;

    if (letter.subject_officer_id && letter.subject_officer_email) {
      const token = yield* issueAndRecordLink(letter.id, "subject");
      const link = `${config.appBaseUrl}/subject-officer?token=${token}`;
      yield* sendMail({
        to: letter.subject_officer_email,
        ...officerLinkEmail({
          officerName: letter.subject_officer_name,
          roleLabel: "Subject Officer",
          letter,
          link,
        }),
      });
    }

    if (letter.relevant_officer_id && letter.relevant_officer_email) {
      const token = yield* issueAndRecordLink(letter.id, "relevant");
      const link = `${config.appBaseUrl}/relevant-officer?token=${token}`;
      yield* sendMail({
        to: letter.relevant_officer_email,
        ...officerLinkEmail({
          officerName: letter.relevant_officer_name,
          roleLabel: "Relevant Officer",
          letter,
          link,
        }),
      });
    }
  });

// Mints a fresh relevant-officer link for a specific officer and emails it -
// used when the current relevant officer reassigns the letter to a
// colleague (links.routes.js POST /:token/reassign). fromOfficerName/note
// let the new officer see who sent it to them and why right in the email.
export const sendRelevantOfficerLink = (
  letter: Letter,
  officer: Officer,
  { fromOfficerName, note }: { fromOfficerName?: string | null; note?: string | null } = {}
) =>
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const token = yield* issueAndRecordLink(letter.id, "relevant");
    const link = `${config.appBaseUrl}/relevant-officer?token=${token}`;
    return yield* sendMail({
      to: officer.email,
      ...officerLinkEmail({
        officerName: officer.name,
        roleLabel: "Relevant Officer",
        letter,
        link,
        reassignedFrom: fromOfficerName,
        reassignNote: note,
      }),
    });
  });
