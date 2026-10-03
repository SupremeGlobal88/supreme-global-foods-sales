import { createTRPCReact } from "@trpc/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppRouter } from "@/lib/appRouter";
import type { ReactNode } from "react";
import { createLocalLink } from "@/lib/localLink";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cloud-first: staleTime MUST be 0 so queries refetch immediately
      // when Firebase subscriptions invalidate them via CustomEvent.
      // A 60-second staleTime was preventing the UI from updating
      // when new cloud data arrived.
      staleTime: 0,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      gcTime: 1000 * 60 * 5, // 5 minutes cache
    },
  },
});
const trpcClient = trpc.createClient({
  links: [createLocalLink()],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
