import { createTRPCReact } from "@trpc/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { createLocalLink } from "@/lib/localLink";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // DISABLE auto-refetch interval. Firebase onValue subscriptions already
      // push real-time updates to localStorage. React Query only needs to
      // read from the in-memory dataService arrays. Constant refetching
      // was causing 7.5+ syncFromCloud calls per second, freezing the UI.
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      // Data stays fresh for 60 seconds before React Query considers it stale.
      // Firebase subscriptions invalidate the cache via CustomEvent dispatch.
      staleTime: 1000 * 60,
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
