import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // OAuth authentication failed - try demo mode
  }

  // Fallback: check for demo user in header
  if (!ctx.user) {
    const demoUserHeader = opts.req.headers.get("x-demo-user");
    if (demoUserHeader) {
      try {
        const demoUser = JSON.parse(demoUserHeader) as User;
        if (demoUser.id && demoUser.role) {
          ctx.user = demoUser;
        }
      } catch {
        // Invalid demo user header
      }
    }
  }

  return ctx;
}
