import { useCallback, useMemo } from "react";

const DEMO_USER_KEY = "demo_user";

export function useAuth() {
  // Read demo user directly from localStorage
  const demoUserStr = typeof window !== "undefined" ? localStorage.getItem(DEMO_USER_KEY) : null;
  const demoUser = demoUserStr ? JSON.parse(demoUserStr) : null;

  const user = demoUser;
  const logout = useCallback(() => {
    localStorage.removeItem(DEMO_USER_KEY);
    window.location.reload();
  }, []);

  return useMemo(
    () => ({
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
      logout,
      refresh: () => Promise.resolve(),
    }),
    [user, logout],
  );
}
