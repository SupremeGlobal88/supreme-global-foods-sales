import { z } from "zod";
import { publicQuery } from "./middleware";
import { createRouter } from "./middleware";

export const followUpRouter = createRouter({
  list: publicQuery.query(async () => []),
  update: publicQuery
    .input(z.object({ id: z.number(), status: z.string(), reason: z.string().optional(), expectedOrderDate: z.string().optional() }))
    .mutation(async ({ input }) => input),
  getStats: publicQuery.query(async () => ({ pending: 0, completed: 0, overdue: 0 })),
});
