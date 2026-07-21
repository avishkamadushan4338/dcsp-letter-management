import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { Effect, Layer, Cause, Option } from "effect";
import nodePath from "node:path";
import nodeUrl from "node:url";
import { authRoutesLayer } from "./routes/authRoutes.ts";
import { lettersRoutesLayer } from "./routes/lettersRoutes.ts";
import { linksRoutesLayer } from "./routes/linksRoutes.ts";
import { numbersRoutesLayer } from "./routes/numbersRoutes.ts";
import { officersRoutesLayer } from "./routes/officersRoutes.ts";
import { subjectOfficerRoutesLayer } from "./routes/subjectOfficerRoutes.ts";

const corsLayer = HttpRouter.cors({
  allowedOrigins: ["*"],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

const serveStatic = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest;
  const fs = yield* FileSystem.FileSystem;
  const p = yield* Path.Path;

  const currentDir = nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
  const staticRoot = nodePath.resolve(currentDir, "../../../web/dist");
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

const serveStaticLayer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    yield* router.add("GET", "*", serveStatic);
  })
);

const errorMiddlewareLayer = HttpRouter.use((router) =>
  router.addGlobalMiddleware((effect) =>
    effect.pipe(
      Effect.catchCause((cause) =>
        Effect.gen(function* () {
          const failure = Cause.findErrorOption(cause);
          if (Option.isSome(failure)) {
            const err = failure.value as { _tag?: string; message?: string };
            const tag = err._tag;
            if (tag === "ValidationError") return yield* HttpServerResponse.json({ error: err.message ?? "Validation error" }, { status: 400 });
            if (tag === "UnauthorizedError") return yield* HttpServerResponse.json({ error: err.message ?? "Unauthorized" }, { status: 401 });
            if (tag === "ForbiddenError") return yield* HttpServerResponse.json({ error: err.message ?? "Forbidden" }, { status: 403 });
            if (tag === "NotFoundError") return yield* HttpServerResponse.json({ error: err.message ?? "Not found" }, { status: 404 });
            if (tag === "ConflictError") return yield* HttpServerResponse.json({ error: err.message ?? "Conflict" }, { status: 409 });
          }
          yield* Effect.logError(cause);
          return yield* HttpServerResponse.json({ error: "Internal server error" }, { status: 500 });
        }).pipe(Effect.orDie)
      )
    ) as any
  )
);

const allRoutesLayer = Layer.mergeAll(
  authRoutesLayer,
  lettersRoutesLayer,
  linksRoutesLayer,
  numbersRoutesLayer,
  officersRoutesLayer,
  subjectOfficerRoutesLayer,
  errorMiddlewareLayer,
);

export const appLayer = allRoutesLayer.pipe(
  Layer.merge(serveStaticLayer),
  Layer.merge(corsLayer),
  Layer.provide(HttpRouter.layer),
);

export const apiLayer = allRoutesLayer.pipe(
  Layer.merge(corsLayer),
  Layer.provide(HttpRouter.layer),
);
