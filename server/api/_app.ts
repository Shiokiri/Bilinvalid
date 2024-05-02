import { router } from "./trpc";
import { spiderRouter } from "./routers/spider";

export const appRouter = router({
  spider: spiderRouter,
});

export type AppRouter = typeof appRouter;
