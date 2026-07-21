import { HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";
import { ValidationError } from "../../domain/errors.js";
import * as NumberService from "../../services/NumberService.js";
import { requireDcs } from "../auth.js";

interface IssueNumbersBody {
  readonly division?: string;
  readonly count?: number;
}

// Direct port of server/controllers/numbers.controller.js#issue.
export const numbersRoutes = HttpRouter.empty.pipe(
  HttpRouter.post(
    "/api/numbers/issue",
    Effect.gen(function* () {
      yield* requireDcs;
      const req = yield* HttpServerRequest.HttpServerRequest;
      const body = (yield* req.json) as IssueNumbersBody;

      if (!body.division) {
        return yield* new ValidationError({ message: "division is required" });
      }
      const n = Math.max(1, Math.min(Number(body.count) || 1, 100));

      const numbers =
        n === 1 ? [yield* NumberService.issueNext(body.division)] : yield* NumberService.issueBatch(body.division, n);

      return yield* HttpServerResponse.json({ numbers }, { status: 201 });
    })
  )
);
