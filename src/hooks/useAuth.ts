import { trpc } from "@/providers/trpc";
import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { LOGIN_PATH } from "@/const";

const DEMO_USER_KEY = "demo_user";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_PATH } =
    options ?? {};

  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const {
    data: oauthUser,
    isLoading: oauthLoading,
    error,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Check for demo user in localStorage (fallback for testing)
  const demoUserStr = typeof window !== "undefined" ? localStorage.getItem(DEMO_USER_KEY) : null;
  const demoUser = demoUserStr ? JSON.parse(demoUserStr) : null;

  // Use OAuth user if available, otherwise use demo user
  const user = oauthUser ?? demoUser;
  const isLoading = oauthLoading;

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      // Also clear demo user
      localStorage.removeItem(DEMO_USER_KEY);
      await utils.invalidate();
      navigate(redirectPath);
    },
  });

  const logout = useCallback(() => {
    // Always clear demo user on logout
    localStorage.removeItem(DEMO_USER_KEY);
    logoutMutation.mutate();
  }, [logoutMutation]);

  useEffect(() => {
    if (redirectOnUnauthenticated && !isLoading && !user) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath);
      }
    }
  }, [redirectOnUnauthenticated, isLoading, user, navigate, redirectPath]);

  return useMemo(
    () => ({
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading: isLoading || logoutMutation.isPending,
      error,
      logout,
      refresh: refetch,
    }),
    [user, isLoading, logoutMutation.isPending, error, logout, refetch],
  );
}
