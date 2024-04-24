import { publicProcedure, router } from "../trpc";
import saveFavorite from "@/server/service/spider";

export const appRouter = router({
  spider: publicProcedure.query(async () => {
    await saveFavorite();
    return {
      message: "success",
    };
  }),
});

export type AppRouter = typeof appRouter;
