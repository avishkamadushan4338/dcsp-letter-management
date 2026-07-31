import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { dashboardRouter } from "./dashboard";
import { letterLinksRouter } from "./letter-links";
import { lettersRouter } from "./letters";
import { officersRouter } from "./officers";
import { subjectOfficersRouter } from "./subject-officers";

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
  subjectOfficers: subjectOfficersRouter,
  letters: lettersRouter,
  letterLinks: letterLinksRouter,
  dashboard: dashboardRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
