import { HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { AppConfig } from "../../config/AppConfig.js";
import { ConflictError, ForbiddenError, ValidationError } from "../../domain/errors.js";
import * as LetterRepo from "../../repositories/LetterRepo.js";
import * as LinkRepo from "../../repositories/LinkRepo.js";
import * as OfficerRepo from "../../repositories/OfficerRepo.js";
import * as ReassignmentRepo from "../../repositories/ReassignmentRepo.js";
import * as MailService from "../../services/MailService.js";
import * as TokenService from "../../services/TokenService.js";
import type { Letter, LinkOfficerRole, LinkRow } from "../../domain/types.js";

// No cookie/session auth on this whole group - subject/relevant officers
// never log in, they're authenticated implicitly by possessing a valid,
// unexpired signed token. Direct port of server/routes/links.routes.js.

interface ResolvedLink {
  readonly link: LinkRow;
  readonly letter: Letter;
  readonly role: LinkOfficerRole;
}

const resolveLink = (token: string) =>
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const payload = TokenService.verify(config.linkSecret, token);
    if (!payload) {
      return yield* new ValidationError({ message: "This link is invalid or has expired." });
    }

    const link = yield* LinkRepo.findByTokenLetterRole(token, payload.letterId, payload.role);
    if (!link) {
      return yield* new ValidationError({ message: "This link is invalid or has expired." });
    }
    if (new Date(link.expires_at) < new Date()) {
      return yield* new ValidationError({ message: "This link has expired." });
    }

    const letter = yield* LetterRepo.findById(link.letter_id);
    if (!letter) {
      return yield* new ValidationError({ message: "Letter not found." });
    }

    return { link, letter, role: payload.role } satisfies ResolvedLink;
  });

interface ActionBody {
  readonly notes?: string;
}

interface ReassignBody {
  readonly officerId?: number | string;
  readonly note?: string;
}

export const linksRoutes = HttpRouter.empty.pipe(
  // GET /api/links/:token - fetch letter details for the emailed link.
  // Includes reassignment history so an officer who was handed this letter
  // by a colleague can see who sent it to them and why.
  HttpRouter.get(
    "/api/links/:token",
    Effect.gen(function* () {
      const { token } = yield* HttpRouter.params;
      const { letter, role } = yield* resolveLink(token!);
      const reassignments = yield* ReassignmentRepo.findByLetterId(letter.id);
      return yield* HttpServerResponse.json({ letter, role, reassignments });
    })
  ),

  // POST /api/links/:token/receive - either officer marks the letter received
  HttpRouter.post(
    "/api/links/:token/receive",
    Effect.gen(function* () {
      const { token } = yield* HttpRouter.params;
      const { letter, role } = yield* resolveLink(token!);

      if (role === "relevant" && !letter.sent_to_relevant_at) {
        return yield* new ConflictError({ message: "The subject officer has not forwarded this letter yet." });
      }

      const fields =
        role === "subject"
          ? { subject_officer_received_at: new Date(), status: "with_subject_officer" }
          : { relevant_officer_received_at: new Date(), status: "with_relevant_officer" };

      const updated = yield* LetterRepo.updateStatus(letter.id, fields);
      return yield* HttpServerResponse.json({ letter: updated });
    })
  ),

  // POST /api/links/:token/send - subject officer forwards to the relevant officer
  HttpRouter.post(
    "/api/links/:token/send",
    Effect.gen(function* () {
      const { token } = yield* HttpRouter.params;
      const { letter, role, link } = yield* resolveLink(token!);

      if (role !== "subject") {
        return yield* new ForbiddenError({ message: "Only the subject officer can forward this letter." });
      }
      if (!letter.subject_officer_received_at) {
        return yield* new ConflictError({ message: "Mark the letter as received before forwarding it." });
      }

      const updated = yield* LetterRepo.updateStatus(letter.id, {
        sent_to_relevant_at: new Date(),
        status: "sent_to_relevant",
      });
      yield* LinkRepo.markUsed(link.id);
      return yield* HttpServerResponse.json({ letter: updated });
    })
  ),

  // POST /api/links/:token/action - relevant officer records the action taken
  HttpRouter.post(
    "/api/links/:token/action",
    Effect.gen(function* () {
      const { token } = yield* HttpRouter.params;
      const { letter, role, link } = yield* resolveLink(token!);

      if (role !== "relevant") {
        return yield* new ForbiddenError({ message: "Only the relevant officer can record an action." });
      }
      if (!letter.relevant_officer_received_at) {
        return yield* new ConflictError({ message: "Mark the letter as received before recording an action." });
      }

      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = (yield* req.json) as ActionBody;
      if (!body.notes) {
        return yield* new ValidationError({ message: "Action notes are required." });
      }

      const updated = yield* LetterRepo.updateStatus(letter.id, {
        action_taken_at: new Date(),
        action_notes: body.notes,
        status: "action_taken",
      });
      yield* LinkRepo.markUsed(link.id);
      return yield* HttpServerResponse.json({ letter: updated });
    })
  ),

  // GET /api/links/:token/officers - relevant officer picks a colleague to
  // hand the letter to. Not scoped to the letter's division - reassignment
  // is a manual judgment call by the current officer.
  HttpRouter.get(
    "/api/links/:token/officers",
    Effect.gen(function* () {
      const { token } = yield* HttpRouter.params;
      const { role } = yield* resolveLink(token!);
      if (role !== "relevant") {
        return yield* new ForbiddenError({ message: "Only the relevant officer can view this list." });
      }

      const officers = yield* OfficerRepo.findAll();
      return yield* HttpServerResponse.json({ officers });
    })
  ),

  // POST /api/links/:token/reassign - relevant officer hands the letter to a
  // different relevant officer. Expires every relevant-officer link issued
  // so far for this letter and mints a fresh one for the new officer.
  HttpRouter.post(
    "/api/links/:token/reassign",
    Effect.gen(function* () {
      const { token } = yield* HttpRouter.params;
      const { letter, role } = yield* resolveLink(token!);

      if (role !== "relevant") {
        return yield* new ForbiddenError({ message: "Only the relevant officer can reassign this letter." });
      }
      if (!letter.relevant_officer_received_at) {
        return yield* new ConflictError({ message: "Mark the letter as received before reassigning it." });
      }
      if (letter.action_taken_at) {
        return yield* new ConflictError({
          message: "This letter is already closed out and can no longer be reassigned.",
        });
      }

      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = (yield* req.json) as ReassignBody;
      if (!body.officerId) {
        return yield* new ValidationError({ message: "officerId is required" });
      }

      const officer = yield* OfficerRepo.findById(body.officerId);
      if (!officer || !officer.active) {
        return yield* new ValidationError({ message: "Selected officer was not found." });
      }
      if (Number(body.officerId) === Number(letter.relevant_officer_id)) {
        return yield* new ValidationError({ message: "This letter is already assigned to that officer." });
      }

      yield* LinkRepo.expireRelevantLinksForLetter(letter.id);

      yield* ReassignmentRepo.create({
        letterId: letter.id,
        fromOfficerId: letter.relevant_officer_id,
        toOfficerId: officer.id,
        note: body.note,
      });

      const updated = yield* LetterRepo.updateStatus(letter.id, {
        relevant_officer_id: officer.id,
        relevant_officer_received_at: null,
        sent_to_relevant_at: new Date(),
        status: "sent_to_relevant",
      });
      if (!updated) return yield* new ValidationError({ message: "Letter not found." });

      yield* MailService.sendRelevantOfficerLink(updated, officer, {
        fromOfficerName: letter.relevant_officer_name,
        note: body.note,
      });

      return yield* HttpServerResponse.json({ letter: updated });
    })
  )
);
