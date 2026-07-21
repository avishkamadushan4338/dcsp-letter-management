import { HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors.ts";
import * as LetterRepo from "../../repositories/LetterRepo.ts";
import * as OfficerRepo from "../../repositories/OfficerRepo.ts";
import * as SettingsRepo from "../../repositories/SettingsRepo.ts";
import * as MailService from "../../services/MailService.ts";
import * as NumberService from "../../services/NumberService.ts";
import { requireSubjectOfficer } from "../auth.ts";

const asSingleParam = (value: string | ReadonlyArray<string> | undefined): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

interface CreateOfficerBody {
  readonly name?: string;
  readonly email?: string;
  readonly designation?: string;
  readonly division?: string;
}

interface CreateLetterBody {
  readonly division?: string;
  readonly subject?: string;
  readonly senderName?: string;
  readonly receivedDate?: string;
  readonly relevantOfficerId?: number | string | null;
  readonly routing?: "direct" | "via_admin";
}

// Direct port of server/routes/subject-officer.routes.js. There is a
// single, permanent Subject Officer for the whole office, so "my letters"
// is simply every letter - this dashboard exists so they can see all of
// them in one place and update receive/send status directly.
export const subjectOfficerRoutes = HttpRouter.empty.pipe(
  // Roster of officers (Division / Position / Name / Email) that can later
  // be picked as a Relevant Officer on new-letter.html. The Subject Officer
  // maintains this list directly from their own dashboard.
  HttpRouter.get(
    "/api/subject-officer/officers",
    Effect.gen(function* () {
      yield* requireSubjectOfficer;
      const params = yield* HttpServerRequest.ParsedSearchParams;
      const officers = yield* OfficerRepo.findAll({ division: asSingleParam(params.division) });
      return yield* HttpServerResponse.json({ officers });
    })
  ),

  HttpRouter.post(
    "/api/subject-officer/officers",
    Effect.gen(function* () {
      yield* requireSubjectOfficer;
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = (yield* req.json) as CreateOfficerBody;
      if (!body.name || !body.email) {
        return yield* new ValidationError({ message: "name and email are required" });
      }
      const officer = yield* OfficerRepo.create({
        name: body.name,
        email: body.email,
        designation: body.designation,
        division: body.division,
      });
      return yield* HttpServerResponse.json({ officer }, { status: 201 });
    })
  ),

  HttpRouter.del(
    "/api/subject-officer/officers/:id",
    Effect.gen(function* () {
      yield* requireSubjectOfficer;
      const { id } = yield* HttpRouter.params;
      const officer = yield* OfficerRepo.findById(id!);
      if (!officer) return yield* new NotFoundError({ message: "Officer not found" });
      yield* OfficerRepo.deactivate(officer.id);
      return yield* HttpServerResponse.json({ ok: true });
    })
  ),

  HttpRouter.get(
    "/api/subject-officer/letters",
    Effect.gen(function* () {
      yield* requireSubjectOfficer;
      const params = yield* HttpServerRequest.ParsedSearchParams;
      const letters = yield* LetterRepo.findAll({
        status: asSingleParam(params.status),
        division: asSingleParam(params.division),
        search: asSingleParam(params.search),
      });
      return yield* HttpServerResponse.json({ letters });
    })
  ),

  // POST /letters - the Subject Officer originates a letter themselves,
  // with a choice of routing:
  //   'direct'    - skip DCS entirely, goes straight to the Relevant Officer.
  //   'via_admin' - DCS still needs to review it and assign/confirm the
  //                 Relevant Officer; the letter sits as 'pending_review'
  //                 until DCS uses POST /api/letters/:id/review.
  HttpRouter.post(
    "/api/subject-officer/letters",
    Effect.gen(function* () {
      yield* requireSubjectOfficer;
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = (yield* req.json) as CreateLetterBody;

      if (!body.division) {
        return yield* new ValidationError({ message: "division is required" });
      }
      if (body.routing !== "direct" && body.routing !== "via_admin") {
        return yield* new ValidationError({ message: 'routing must be "direct" or "via_admin"' });
      }

      const subjectOfficerId = yield* SettingsRepo.get("subject_officer_id");
      if (!subjectOfficerId) {
        return yield* new ValidationError({
          message: "No Subject Officer configured yet. Set one from the dashboard first.",
        });
      }

      const letterNumber = yield* NumberService.issueNext(body.division);

      if (body.routing === "direct") {
        if (!body.relevantOfficerId) {
          return yield* new ValidationError({
            message: "relevantOfficerId is required to send directly to a Relevant Officer.",
          });
        }
        const officer = yield* OfficerRepo.findById(body.relevantOfficerId);
        if (!officer || !officer.active) {
          return yield* new ValidationError({ message: "Selected Relevant Officer was not found." });
        }

        const now = new Date();
        const letter = yield* LetterRepo.create({
          letterNumber,
          division: body.division,
          subject: body.subject,
          senderName: body.senderName,
          receivedDate: body.receivedDate,
          subjectOfficerId,
          relevantOfficerId: body.relevantOfficerId,
          status: "sent_to_relevant",
          createdByRole: "subject_officer",
          subjectOfficerReceivedAt: now,
          sentToRelevantAt: now,
        });
        if (!letter) return yield* new NotFoundError({ message: "Letter not found" });

        yield* MailService.sendRelevantOfficerLink(letter, officer);
        return yield* HttpServerResponse.json({ letter }, { status: 201 });
      }

      const letter = yield* LetterRepo.create({
        letterNumber,
        division: body.division,
        subject: body.subject,
        senderName: body.senderName,
        receivedDate: body.receivedDate,
        subjectOfficerId,
        relevantOfficerId: body.relevantOfficerId || null,
        status: "pending_review",
        createdByRole: "subject_officer",
      });

      return yield* HttpServerResponse.json({ letter }, { status: 201 });
    })
  ),

  HttpRouter.post(
    "/api/subject-officer/letters/:id/receive",
    Effect.gen(function* () {
      yield* requireSubjectOfficer;
      const { id } = yield* HttpRouter.params;
      const letter = yield* LetterRepo.findById(id!);
      if (!letter) return yield* new NotFoundError({ message: "Letter not found" });

      const updated = yield* LetterRepo.updateStatus(letter.id, {
        subject_officer_received_at: new Date(),
        status: "with_subject_officer",
      });
      return yield* HttpServerResponse.json({ letter: updated });
    })
  ),

  HttpRouter.post(
    "/api/subject-officer/letters/:id/send",
    Effect.gen(function* () {
      yield* requireSubjectOfficer;
      const { id } = yield* HttpRouter.params;
      const letter = yield* LetterRepo.findById(id!);
      if (!letter) return yield* new NotFoundError({ message: "Letter not found" });
      if (!letter.subject_officer_received_at) {
        return yield* new ConflictError({ message: "Mark the letter as received before forwarding it." });
      }

      const updated = yield* LetterRepo.updateStatus(letter.id, {
        sent_to_relevant_at: new Date(),
        status: "sent_to_relevant",
      });
      return yield* HttpServerResponse.json({ letter: updated });
    })
  )
);
