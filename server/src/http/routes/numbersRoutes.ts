import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import { Effect } from "effect";
import { ValidationError } from "../../domain/errors.ts";
import * as NumberService from "../../services/NumberService.ts";
import { requireDcs } from "../auth.ts";

interface IssueNumbersBody {
  readonly division?: string;
  readonly count?: number;
}

export const numbersRoutesLayer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    yield* router.add("POST", "/api/numbers/issue",
      Effect.gen(function* () {
        yield* requireDcs;
        const body = (yield* HttpServerRequest.schemaBodyJson(Schema.Unknown)) as IssueNumbersBody;

        if (!body.division) {
          return yield* new ValidationError({ message: "division is required" });
        }
        const n = Math.max(1, Math.min(Number(body.count) || 1, 100));

        const numbers =
          n === 1 ? [yield* NumberService.issueNext(body.division)] : yield* NumberService.issueBatch(body.division, n);

        return yield* HttpServerResponse.json({ numbers }, { status: 201 });
      })
    );
  })
);
