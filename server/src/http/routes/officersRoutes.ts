import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import { Effect } from "effect";
import { ValidationError } from "../../domain/errors.ts";
import * as OfficerRepo from "../../repositories/OfficerRepo.ts";
import * as SettingsRepo from "../../repositories/SettingsRepo.ts";
import { requireDcs } from "../auth.ts";

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

export const officersRoutesLayer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    yield* router.add("GET", "/api/officers/subject-officer",
      Effect.gen(function* () {
        yield* requireDcs;
        const id = yield* SettingsRepo.get(SUBJECT_OFFICER_SETTING_KEY);
        const officer = id ? yield* OfficerRepo.findById(id) : null;
        return yield* HttpServerResponse.json({ officer });
      })
    );

    yield* router.add("PUT", "/api/officers/subject-officer",
      Effect.gen(function* () {
        yield* requireDcs;
        const body = (yield* HttpServerRequest.schemaBodyJson(Schema.Unknown)) as OfficerBody;
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
    );

    yield* router.add("GET", "/api/officers",
      Effect.gen(function* () {
        yield* requireDcs;
        const params = yield* HttpServerRequest.ParsedSearchParams;
        const officers = yield* OfficerRepo.findAll({ division: asSingleParam(params.division) });
        return yield* HttpServerResponse.json({ officers });
      })
    );

    yield* router.add("POST", "/api/officers",
      Effect.gen(function* () {
        yield* requireDcs;
        const body = (yield* HttpServerRequest.schemaBodyJson(Schema.Unknown)) as OfficerBody;
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
    );

    yield* router.add("PUT", "/api/officers/:id",
      Effect.gen(function* () {
        yield* requireDcs;
        const { id } = yield* HttpRouter.params;
        const body = (yield* HttpServerRequest.schemaBodyJson(Schema.Unknown)) as OfficerBody;
        const officer = yield* OfficerRepo.update(id!, {
          name: body.name!,
          email: body.email!,
          designation: body.designation,
          division: body.division,
          active: body.active,
        });
        return yield* HttpServerResponse.json({ officer });
      })
    );
  })
);
