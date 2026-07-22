import { createAuth } from "@dcsp-letter-management/auth";
import { createDb } from "@dcsp-letter-management/db";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await createAuth().api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    db: createDb(),
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
