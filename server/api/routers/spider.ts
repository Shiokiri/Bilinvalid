import { publicProcedure, router } from "../trpc";
import z from "zod";
import db from "@/lib/db";

import startSpider from "@/server/service/spider";

export const spiderRouter = router({
  startByConfigId: publicProcedure
    .input(z.object({ configId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const config = await db.$transaction(async (tx) => {
          const config = await tx.config.findUnique({
            where: {
              id: input.configId,
            },
          });
          if (!config) {
            throw new Error("Config not found.");
          } else if (config.spiderStatus) {
            throw new Error("Spider is already running.");
          }
          const updatedConfig = await tx.config.update({
            data: {
              spiderStatus: true,
            },
            where: {
              id: input.configId,
            },
          });
          return updatedConfig;
        });
        await startSpider({
          cookie: config.cookie,
          userAgent: config.userAgent,
          upperMid: Number(config.upperMid),
          timeout: 5000, // TODO: frontend
          delay: 5000, // TODO: frontend
        });
        await db.$transaction([
          db.config.update({
            data: {
              spiderStatus: false,
            },
            where: {
              id: input.configId,
            },
          }),
        ]);
      } catch (error: any) {
        console.log(`spider error: ${error}`);
        if (
          !(
            error.message === "Config not found." ||
            error.message === "Spider is already running."
          )
        ) {
          await db.$transaction([
            db.config.update({
              data: {
                spiderStatus: false,
              },
              where: {
                id: input.configId,
              },
            }),
          ]);
        }
        return {
          message: "error",
        };
      }
      return {
        message: "success",
      };
    }),
});
