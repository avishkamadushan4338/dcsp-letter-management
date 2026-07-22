import { createDb } from "@dcsp-letter-management/db";
import * as schema from "@dcsp-letter-management/db/schema/auth";
import type { UserRole } from "@dcsp-letter-management/domain/roles";
import { env } from "@dcsp-letter-management/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

// The two real-login roles from APP_FLOW.md §1 (Relevant Officers never get a
// user account — they only ever use emailed per-letter links).
const SEED_PASSWORD = "admin-pass";
const SEED_USERS: { email: string; name: string; role: UserRole }[] = [
  { email: "dcs@letter.com", name: "DCS", role: "dcs" },
  { email: "subjectofficer@letter.com", name: "Subject Officer", role: "subjectOfficer" },
];

export type Auth = ReturnType<typeof createAuth>;

export function createAuth() {
  const db = createDb();
  const isLocalDev = env.BETTER_AUTH_URL.includes("localhost");

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",

      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
      // Kept low enough for the `admin` seed password (see `ensureSeedUsers`) —
      // real accounts are provisioned by DCS, not through public self-sign-up.
      minPasswordLength: SEED_PASSWORD.length,
    },
    user: {
      additionalFields: {
        // Set by `ensureSeedUsers` / future DCS-driven user provisioning only —
        // never through public sign-up (see APP_FLOW.md §1).
        role: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60,
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: isLocalDev ? "lax" : "none",
        secure: !isLocalDev,
        httpOnly: true,
      },
      crossSubDomainCookies: {
        enabled: !isLocalDev,
        domain: "avishkamadushan4338.workers.dev",
      },
    },
  });
}

/**
 * Resets the two testing accounts (see `SEED_USERS`) to a known state: each
 * one is deleted first if it already exists (cascading to its `session` and
 * `account` rows), then recreated fresh via the given `auth` instance's own
 * API.
 */
export async function ensureSeedUsers(auth: ReturnType<typeof createAuth>) {
  console.log(`[seed] seeding ${SEED_USERS.length} test user(s): ${SEED_USERS.map((u) => u.email).join(", ")}`);

  const db = createDb();

  for (const seedUser of SEED_USERS) {
    const deleted = await db.delete(schema.user).where(eq(schema.user.email, seedUser.email)).returning({ id: schema.user.id });
    console.log(`[seed] ${seedUser.email}: removed ${deleted.length} existing account(s)`);

    const { user } = await auth.api.signUpEmail({
      body: {
        name: seedUser.name,
        email: seedUser.email,
        password: SEED_PASSWORD,
      },
    });
    console.log(`[seed] ${seedUser.email}: created user ${user.id}`);

    await db.update(schema.user).set({ role: seedUser.role }).where(eq(schema.user.id, user.id));
    console.log(`[seed] ${seedUser.email}: set role="${seedUser.role}"`);
  }

  console.log("[seed] done");
}
