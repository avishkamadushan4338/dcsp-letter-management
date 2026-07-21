import { FileSystem, HttpRouter, HttpServerRequest, HttpServerResponse, Path } from "@effect/platform";
import { Effect } from "effect";
import nodePath from "node:path";
import nodeUrl from "node:url";
import { authRoutes } from "./routes/authRoutes.js";
import { lettersRoutes } from "./routes/lettersRoutes.js";
import { linksRoutes } from "./routes/linksRoutes.js";
import { numbersRoutes } from "./routes/numbersRoutes.js";
import { officersRoutes } from "./routes/officersRoutes.js";
import { subjectOfficerRoutes } from "./routes/subjectOfficerRoutes.js";

// server/dist/http/router.js -> repo root is 3 levels up -> web/dist is the
// Vite build output, served the same way express.static(public/) did.
const currentDir = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
const staticRoot = nodePath.resolve(currentDir, "../../../web/dist");

// SPA fallback: unknown non-API GET paths resolve to index.html so React
// Router's client-side routes (e.g. /dashboard, /subject-officer?token=...)
// survive a full page load/refresh - the one behavioral addition required by
// moving from separate static HTML pages to a single-page app.
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

// Central error handling: tagged domain errors map to the same status codes
// the old Express error middleware used (server/server.js), fallback
// catchAllCause covers everything else (including defects) -> 500, matching
// Express's blanket try/catch-all behavior for unexpected errors.
export const appRouter = HttpRouter.empty.pipe(
  HttpRouter.concat(authRoutes),
  HttpRouter.concat(lettersRoutes),
  HttpRouter.concat(numbersRoutes),
  HttpRouter.concat(officersRoutes),
  HttpRouter.concat(linksRoutes),
  HttpRouter.concat(subjectOfficerRoutes),
  HttpRouter.get("*", serveStatic),
  HttpRouter.catchTag("ValidationError", (e) => HttpServerResponse.json({ error: e.message }, { status: 400 })),
  HttpRouter.catchTag("UnauthorizedError", (e) => HttpServerResponse.json({ error: e.message }, { status: 401 })),
  HttpRouter.catchTag("ForbiddenError", (e) => HttpServerResponse.json({ error: e.message }, { status: 403 })),
  HttpRouter.catchTag("NotFoundError", (e) => HttpServerResponse.json({ error: e.message }, { status: 404 })),
  HttpRouter.catchTag("ConflictError", (e) => HttpServerResponse.json({ error: e.message }, { status: 409 })),
  HttpRouter.catchAllCause((cause) =>
    Effect.gen(function* () {
      yield* Effect.logError(cause);
      return yield* HttpServerResponse.json({ error: "Internal server error" }, { status: 500 });
    })
  )
);
