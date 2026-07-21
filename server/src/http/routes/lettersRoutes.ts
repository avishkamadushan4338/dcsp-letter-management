import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import { Effect } from "effect";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors.ts";
import * as LetterRepo from "../../repositories/LetterRepo.ts";
import * as ReassignmentRepo from "../../repositories/ReassignmentRepo.ts";
import * as SettingsRepo from "../../repositories/SettingsRepo.ts";
import * as MailService from "../../services/MailService.ts";
import * as NumberService from "../../services/NumberService.ts";
import { requireDcs } from "../auth.ts";

interface CreateLetterBody {
  readonly letterNumber?: string;
  readonly division?: string;
  readonly subject?: string;
  readonly senderName?: string;
  readonly receivedDate?: string;
  readonly relevantOfficerId?: number | string;
  readonly subjectOfficerId?: number | string;
}

interface ReviewLetterBody {
  readonly relevantOfficerId?: number | string;
}

const asSingleParam = (value: string | ReadonlyArray<string> | undefined): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

export const lettersRoutesLayer = HttpRouter.use(() =>
  Effect.gen(function* () {
    yield* HttpRouter.add("GET", "/api/letters",
      Effect.gen(function* () {
        yield* requireDcs;
        const params = yield* HttpServerRequest.ParsedSearchParams;
        const letters = yield* LetterRepo.findAll({
          status: asSingleParam(params.status),
          division: asSingleParam(params.division),
          search: asSingleParam(params.search),
        });
        return yield* HttpServerResponse.json({ letters });
      })
    );

    yield* HttpRouter.add("POST", "/api/letters",
      Effect.gen(function* () {
        yield* requireDcs;
        const body = (yield* HttpServerRequest.schemaBodyJson(Schema.Unknown)) as CreateLetterBody;

        if (!body.division) {
          return yield* new ValidationError({ message: "division is required" });
        }
        if (!body.relevantOfficerId) {
          return yield* new ValidationError({ message: "relevantOfficerId is required" });
        }

        const subjectOfficerId = body.subjectOfficerId || (yield* SettingsRepo.get("subject_officer_id"));
        if (!subjectOfficerId) {
          return yield* new ValidationError({
            message: "No Subject Officer configured yet. Set one from the dashboard first.",
          });
        }

        const finalNumber = body.letterNumber || (yield* NumberService.issueNext(body.division));

        const letter = yield* LetterRepo.create({
          letterNumber: finalNumber,
          division: body.division,
          subject: body.subject,
          senderName: body.senderName,
          receivedDate: body.receivedDate,
          subjectOfficerId,
          relevantOfficerId: body.relevantOfficerId,
          createdByRole: "dcs",
        });
        if (!letter) return yield* new NotFoundError({ message: "Letter not found" });

        yield* MailService.sendOfficerLinks(letter);
        yield* LetterRepo.updateStatus(letter.id, { status: "sent_to_subject" });

        const finalLetter = yield* LetterRepo.findById(letter.id);
        return yield* HttpServerResponse.json({ letter: finalLetter }, { status: 201 });
      })
    );

    yield* HttpRouter.add("POST", "/api/letters/:id/review",
      Effect.gen(function* () {
        yield* requireDcs;
        const { id } = yield* HttpRouter.params;
        const body = (yield* HttpServerRequest.schemaBodyJson(Schema.Unknown)) as ReviewLetterBody;

        const letter = yield* LetterRepo.findById(id!);
        if (!letter) return yield* new NotFoundError({ message: "Letter not found" });
        if (letter.status !== "pending_review") {
          return yield* new ConflictError({ message: "This letter is not awaiting review." });
        }
        if (!body.relevantOfficerId) {
          return yield* new ValidationError({ message: "relevantOfficerId is required" });
        }

        yield* LetterRepo.updateStatus(letter.id, {
          relevant_officer_id: body.relevantOfficerId,
          status: "sent_to_subject",
        });

        const updated = yield* LetterRepo.findById(letter.id);
        if (!updated) return yield* new NotFoundError({ message: "Letter not found" });
        yield* MailService.sendOfficerLinks(updated);

        return yield* HttpServerResponse.json({ letter: updated });
      })
    );

    yield* HttpRouter.add("GET", "/api/letters/:id",
      Effect.gen(function* () {
        yield* requireDcs;
        const { id } = yield* HttpRouter.params;
        const letter = yield* LetterRepo.findById(id!);
        if (!letter) return yield* new NotFoundError({ message: "Letter not found" });
        const reassignments = yield* ReassignmentRepo.findByLetterId(letter.id);
        return yield* HttpServerResponse.json({ letter, reassignments });
      })
    );
  })
);
