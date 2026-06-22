import { publicQuery } from "./middleware";
import { createRouter } from "./middleware";

export const auditRouter = createRouter({
  list: publicQuery.query(async () => {
    return [];
  }),
  getCustomerDeletions: publicQuery.query(async () => {
    return [];
  }),
  getAddressChanges: publicQuery.query(async () => {
    return [];
  }),
});
