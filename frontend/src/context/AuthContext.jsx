import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAccessToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  /** Try to restore a session using the HttpOnly refresh cookie. */
  const bootstrap = useCallback(async () => {
    try {
      const data = await api.post("/accounts/auth/refresh/", null, { retry: false });
      setAccessToken(data.access);
      setUser(data.user);
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.post(
      "/accounts/auth/login/",
      { email, password },
      { retry: false }
    );
    setAccessToken(data.access);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/accounts/auth/logout/", null, { retry: false });
    } catch {
      /* the local session is cleared regardless */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await api.get("/accounts/auth/me/");
    setUser(data);
    return data;
  }, []);

  useEffect(() => {
    bootstrap();
    const onExpired = () => {
      setAccessToken(null);
      setUser(null);
    };
    window.addEventListener("school-erp:session-expired", onExpired);
    return () => window.removeEventListener("school-erp:session-expired", onExpired);
  }, [bootstrap]);

  const value = useMemo(
    () => ({
      user,
      booting,
      login,
      logout,
      refreshUser,
      setUser,
      isAuthenticated: Boolean(user),
      roles: user?.roles || [],
      isAdmin: Boolean(user?.roles?.includes("Admin")),
      isTeacher: Boolean(user?.roles?.includes("Teacher")),
      isAccountant: Boolean(user?.roles?.includes("Accountant")),
      isStudent: Boolean(user?.roles?.includes("Student")),
      isParent: Boolean(user?.roles?.includes("Parent")),
      hasRole: (...names) => names.some((name) => user?.roles?.includes(name)),
      bootstrap,
    }),
    [user, booting, login, logout, refreshUser, bootstrap]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
