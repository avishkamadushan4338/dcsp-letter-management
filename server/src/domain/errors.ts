import { Data } from "effect";

// Mirrors the Express app's convention of throwing an Error with a `.status`
// that the central error middleware reads (server/server.js) - one tagged
// error per status code it used, mapped back to the same status in
// http/router.ts.

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly message: string;
}> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
  readonly message: string;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
}> {}

export class ConflictError extends Data.TaggedError("ConflictError")<{
  readonly message: string;
}> {}

export type ApiError =
  | ValidationError
  | UnauthorizedError
  | ForbiddenError
  | NotFoundError
  | ConflictError;
