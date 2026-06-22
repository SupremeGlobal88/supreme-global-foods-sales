import { z } from "zod";
import { publicQuery } from "./middleware";
import { createRouter } from "./middleware";

export const sampleReportRouter = createRouter({
  getByCustomer: publicQuery
    .input(z.object({ customerId: z.number() }))
    .query(async () => ({ items: [], grandTotal: 0 })),
  getAll: publicQuery.query(async () => ({ customers: [], grandTotal: 0 })),
});
