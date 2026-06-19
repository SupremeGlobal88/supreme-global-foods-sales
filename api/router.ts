import { authRouter } from "./auth-router";
import { salesRepRouter } from "./salesRep-router";
import { stockRouter } from "./stock-router";
import { customerRouter } from "./customer-router";
import { orderRouter } from "./order-router";
import { invoiceRouter } from "./invoice-router";
import { appointmentRouter } from "./appointment-router";
import { checkInRouter } from "./checkin-router";
import { specialPriceRouter } from "./specialPrice-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  salesRep: salesRepRouter,
  stock: stockRouter,
  customer: customerRouter,
  order: orderRouter,
  invoice: invoiceRouter,
  appointment: appointmentRouter,
  checkIn: checkInRouter,
  specialPrice: specialPriceRouter,
});

export type AppRouter = typeof appRouter;
