import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import { Context, Effect, Layer } from "effect";
import * as schema from "./schema.ts";

export type D1DbInstance = DrizzleD1Database<typeof schema>;

export class D1Db extends Context.Service<D1Db, D1DbInstance>()("D1Db") {
  static readonly layer = (d1: D1Database) =>
    Layer.effect(D1Db, Effect.sync(() => drizzle(d1, { schema })));
}
