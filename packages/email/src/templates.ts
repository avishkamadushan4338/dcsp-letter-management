import { DIVISION_NAMES, type DivisionCode } from "@dcsp-letter-management/domain/division";

type OfficerRole = "subjectOfficer" | "relevantOfficer";

export type LetterLinkEmailInput = {
  role: OfficerRole;
  referenceNumber: string;
  subject: string | null;
  fromWhom: string | null;
  division: DivisionCode;
  actionUrl: string;
  /** Present only when this link is for a Relevant Officer who received the letter via reassignment. */
  reassignment?: {
    fromOfficerName: string;
    note: string | null;
  };
};

const ROLE_LABEL: Record<OfficerRole, string> = {
  subjectOfficer: "Subject Officer",
  relevantOfficer: "Relevant Officer",
};

function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;">
      <h1 style="font-size:16px;margin:0 0 16px;">${title}</h1>
      ${bodyHtml}
    </div>
  </body>
</html>`;
}

export function letterLinkEmailSubject(input: LetterLinkEmailInput) {
  return `Letter ${input.referenceNumber} — action needed`;
}

export function letterLinkEmailHtml(input: LetterLinkEmailInput) {
  const details = `
    <table style="width:100%;font-size:14px;margin:0 0 16px;border-collapse:collapse;">
      <tr><td style="color:#71717a;padding:2px 0;">Reference</td><td style="padding:2px 0;">${input.referenceNumber}</td></tr>
      <tr><td style="color:#71717a;padding:2px 0;">Division</td><td style="padding:2px 0;">${DIVISION_NAMES[input.division]}</td></tr>
      <tr><td style="color:#71717a;padding:2px 0;">Subject</td><td style="padding:2px 0;">${input.subject ?? "—"}</td></tr>
      <tr><td style="color:#71717a;padding:2px 0;">From</td><td style="padding:2px 0;">${input.fromWhom ?? "—"}</td></tr>
    </table>`;

  const reassignmentNotice = input.reassignment
    ? `<p style="font-size:14px;background:#fef9c3;border-radius:6px;padding:10px 12px;margin:0 0 16px;">
        This letter was reassigned to you by <strong>${input.reassignment.fromOfficerName}</strong>.
        ${input.reassignment.note ? `Note: ${input.reassignment.note}` : ""}
      </p>`
    : "";

  const button = `
    <a href="${input.actionUrl}"
       style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">
      Open letter
    </a>`;

  return layout(
    `You've been sent a letter as ${ROLE_LABEL[input.role]}`,
    `${details}${reassignmentNotice}${button}
     <p style="font-size:12px;color:#71717a;margin:16px 0 0;">This link is unique to you and this letter — please don't forward it.</p>`,
  );
}
