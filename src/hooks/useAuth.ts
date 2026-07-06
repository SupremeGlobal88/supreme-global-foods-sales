import { useCallback, useMemo } from "react";

const DEMO_USER_KEY = "demo_user";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export function useAuth() {
  // Read session user from localStorage
  const demoUserStr = typeof window !== "undefined" ? localStorage.getItem(DEMO_USER_KEY) : null;
  const demoUser: AuthUser | null = demoUserStr ? JSON.parse(demoUserStr) : null;

  const user = demoUser;

  const logout = useCallback(() => {
    localStorage.removeItem(DEMO_USER_KEY);
    window.location.reload();
  }, []);

  return useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
      logout,
      refresh: () => Promise.resolve(),
    }),
    [user, logout],
  );
}
