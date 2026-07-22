import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { letterLinksRouter } from "./letter-links";
import { lettersRouter } from "./letters";
import { officersRouter } from "./officers";
import { settingsRouter } from "./settings";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  officers: officersRouter,
  settings: settingsRouter,
  letters: lettersRouter,
  letterLinks: letterLinksRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
