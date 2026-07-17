import { createTRPCReact } from "@trpc/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { createLocalLink } from "@/lib/localLink";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Auto-refetch every 2 seconds — aggressive sync so users see
      // updates from other devices as fast as possible
      refetchInterval: 2000,
      refetchOnWindowFocus: true,
      refetchOnMount: "always",
      staleTime: 0,
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
