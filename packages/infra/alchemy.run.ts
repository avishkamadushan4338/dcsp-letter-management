import alchemy from "alchemy";
import { Vite } from "alchemy/cloudflare";
import { Worker } from "alchemy/cloudflare";
import { D1Database } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

const app = await alchemy("dcsp-letter-management");

const db = await D1Database("database", {
  migrationsDir: "../../packages/db/src/migrations",
});

export const server = await Worker("server", {
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  url: true,
  bindings: {
    DB: db,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    SMTP_HOST: alchemy.env.SMTP_HOST!,
    SMTP_PORT: alchemy.env.SMTP_PORT!,
    SMTP_SECURE: alchemy.env.SMTP_SECURE!,
    SMTP_USER: alchemy.secret.env.SMTP_USER!,
    SMTP_PASS: alchemy.secret.env.SMTP_PASS!,
    SMTP_FROM: alchemy.env.SMTP_FROM!,
  },
  dev: {
    port: 3000,
  },
});

export const web = await Vite("web", {
  cwd: "../../apps/web",
  assets: "dist",
  bindings: {
    VITE_SERVER_URL: server.url!,
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
