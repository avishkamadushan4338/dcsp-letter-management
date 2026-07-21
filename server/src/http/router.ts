import { FileSystem, HttpRouter, HttpServerRequest, HttpServerResponse, Path } from "@effect/platform";
import { Effect } from "effect";
import nodePath from "node:path";
import nodeUrl from "node:url";
import { authRoutes } from "./routes/authRoutes.ts";
import { lettersRoutes } from "./routes/lettersRoutes.ts";
import { linksRoutes } from "./routes/linksRoutes.ts";
import { numbersRoutes } from "./routes/numbersRoutes.ts";
import { officersRoutes } from "./routes/officersRoutes.ts";
import { subjectOfficerRoutes } from "./routes/subjectOfficerRoutes.ts";
import type { ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } from "../domain/errors.ts";

const currentDir = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const staticRoot = nodePath.resolve(currentDir, "../../../web/dist");

const serveStatic = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest;
  const fs = yield* FileSystem.FileSystem;
  const p = yield* Path.Path;

  const indexPath = p.join(staticRoot, "index.html");
  const url = new URL(req.url, "http://internal");
  const requestedPath = p.join(staticRoot, p.normalize(url.pathname));

  if (!requestedPath.startsWith(staticRoot)) {
    return yield* HttpServerResponse.file(indexPath);
  }

  const exists = yield* fs.exists(requestedPath).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return yield* HttpServerResponse.file(indexPath);
  }

  const info = yield* fs.stat(requestedPath).pipe(Effect.orElseSucceed(() => null));
  if (!info || info.type !== "File") {
    return yield* HttpServerResponse.file(indexPath);
  }

  return yield* HttpServerResponse.file(requestedPath);
});

const errorHandler = HttpRouter.catchTags({
  ValidationError: (e: ValidationError) =>
    HttpServerResponse.json({ error: e.message }, { status: 400 }),
  UnauthorizedError: (e: UnauthorizedError) =>
    HttpServerResponse.json({ error: e.message }, { status: 401 }),
  ForbiddenError: (e: ForbiddenError) =>
    HttpServerResponse.json({ error: e.message }, { status: 403 }),
  NotFoundError: (e: NotFoundError) =>
    HttpServerResponse.json({ error: e.message }, { status: 404 }),
  ConflictError: (e: ConflictError) =>
    HttpServerResponse.json({ error: e.message }, { status: 409 }),
});

export const appRouter = HttpRouter.empty.pipe(
  HttpRouter.concat(authRoutes),
  HttpRouter.concat(lettersRoutes),
  HttpRouter.concat(numbersRoutes),
  HttpRouter.concat(officersRoutes),
  HttpRouter.concat(linksRoutes),
  HttpRouter.concat(subjectOfficerRoutes),
  HttpRouter.get("*", serveStatic),
  errorHandler,
  HttpRouter.catchAllCause((cause) =>
    Effect.gen(function* () {
      yield* Effect.logError(cause);
      return yield* HttpServerResponse.json({ error: "Internal server error" }, { status: 500 });
    })
  )
);

export const apiRouter = HttpRouter.empty.pipe(
  HttpRouter.concat(authRoutes),
  HttpRouter.concat(lettersRoutes),
  HttpRouter.concat(numbersRoutes),
  HttpRouter.concat(officersRoutes),
  HttpRouter.concat(linksRoutes),
  HttpRouter.concat(subjectOfficerRoutes),
  errorHandler,
  HttpRouter.catchAllCause((cause) =>
    Effect.gen(function* () {
      yield* Effect.logError(cause);
      return yield* HttpServerResponse.json({ error: "Internal server error" }, { status: 500 });
    })
  )
);
