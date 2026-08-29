import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import type { User, Permission, AuthState } from "@/types/auth";
import { toast } from "sonner";

interface AuthContextType extends AuthState {
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevUserRef = useRef<User | null>(null);

  useEffect(() => {
    prevUserRef.current = user;
  }, [user]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setUser(data.user || null);
      } else {
        const wasLoggedIn = prevUserRef.current !== null;
        setUser(null);
        if (wasLoggedIn && res.status === 401 && data?.code === "SESSION_INVALID") {
          toast.error(
            data.error ||
              "Your session has ended because this Super Admin account was signed in on another device. Please log in again.",
            { id: "session-superseded", duration: 6000 },
          );
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, pass: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || "អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។",
        };
      }

      setUser(data.user);
      return { success: true };
    } catch {
      return {
        success: false,
        error: "មិនអាចភ្ជាប់ទៅកាន់ Server បានទេ។ សូមព្យាយាមម្ដងទៀត។",
      };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      setUser(null);
      toast.success("បានចាកចេញដោយជោគជ័យ។");
    }
  };

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      if (user.status === "disabled") return false;
      if (user.role === "super_admin") return true;
      return user.permissions?.includes(permission) ?? false;
    },
    [user],
  );

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isEditor = user?.role === "editor";
  const isViewer = user?.role === "viewer";
  const isAuthenticated = !!user && user.status === "active";

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isSuperAdmin,
        isAdmin,
        isEditor,
        isViewer,
        hasPermission,
        login,
        logout,
        refetchUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
