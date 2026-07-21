import { HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { ValidationError } from "../../domain/errors.js";
import * as OfficerRepo from "../../repositories/OfficerRepo.js";
import * as SettingsRepo from "../../repositories/SettingsRepo.js";
import { requireDcs } from "../auth.js";

const SUBJECT_OFFICER_SETTING_KEY = "subject_officer_id";

interface OfficerBody {
  readonly name?: string;
  readonly email?: string;
  readonly designation?: string;
  readonly division?: string;
  readonly active?: boolean | number;
}

const asSingleParam = (value: string | ReadonlyArray<string> | undefined): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

// Direct port of server/controllers/officers.controller.js. The Subject
// Officer is a single permanent post (same person on every letter), unlike
// the Relevant Officer which is picked per letter - its identity is just an
// officers.id pointed to by app_settings.
export const officersRoutes = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/api/officers/subject-officer",
    Effect.gen(function* () {
      yield* requireDcs;
      const id = yield* SettingsRepo.get(SUBJECT_OFFICER_SETTING_KEY);
      const officer = id ? yield* OfficerRepo.findById(id) : null;
      return yield* HttpServerResponse.json({ officer });
    })
  ),
  HttpRouter.put(
    "/api/officers/subject-officer",
    Effect.gen(function* () {
      yield* requireDcs;
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = (yield* req.json) as OfficerBody;
      if (!body.name || !body.email) {
        return yield* new ValidationError({ message: "name and email are required" });
      }

      const existingId = yield* SettingsRepo.get(SUBJECT_OFFICER_SETTING_KEY);
      const officer = existingId
        ? yield* OfficerRepo.updateContact(existingId, { name: body.name, email: body.email })
        : yield* Effect.gen(function* () {
            const created = yield* OfficerRepo.create({
              name: body.name!,
              email: body.email!,
              designation: "Subject Officer",
            });
            if (created) yield* SettingsRepo.set(SUBJECT_OFFICER_SETTING_KEY, created.id);
            return created;
          });

      return yield* HttpServerResponse.json({ officer });
    })
  ),
  HttpRouter.get(
    "/api/officers",
    Effect.gen(function* () {
      yield* requireDcs;
      const params = yield* HttpServerRequest.ParsedSearchParams;
      const officers = yield* OfficerRepo.findAll({ division: asSingleParam(params.division) });
      return yield* HttpServerResponse.json({ officers });
    })
  ),
  HttpRouter.post(
    "/api/officers",
    Effect.gen(function* () {
      yield* requireDcs;
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = (yield* req.json) as OfficerBody;
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
  HttpRouter.put(
    "/api/officers/:id",
    Effect.gen(function* () {
      yield* requireDcs;
      const { id } = yield* HttpRouter.params;
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = (yield* req.json) as OfficerBody;
      const officer = yield* OfficerRepo.update(id!, {
        name: body.name!,
        email: body.email!,
        designation: body.designation,
        division: body.division,
        active: body.active,
      });
      return yield* HttpServerResponse.json({ officer });
    })
  )
);
