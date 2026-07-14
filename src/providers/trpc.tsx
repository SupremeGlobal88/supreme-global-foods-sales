import { createTRPCReact } from "@trpc/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { createLocalLink } from "@/lib/localLink";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Auto-refetch every 5 seconds — ensures admin users see updates
      // from other devices without needing to navigate or click
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
      staleTime: 0,
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
