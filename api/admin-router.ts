import { createRouter, adminQuery } from "./middleware";

export const adminRouter = createRouter({
  clearAll: adminQuery.mutation(async () => {
    // This is handled by the localLink — the return value comes from dataService.clearAll()
    return { success: true };
  }),
});
