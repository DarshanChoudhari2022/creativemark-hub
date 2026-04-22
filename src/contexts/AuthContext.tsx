import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";

export type Role = "Admin" | "Employee";

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
}

const DEMO_USER: User = {
  id: "demo-admin-001",
  name: "Demo Admin",
  role: "Admin",
  email: "admin@creativemark.com",
};

const DEMO_STORAGE_KEY = "cm_demo_user";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  demoLogin: (email: string, password: string) => boolean;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Check for persisted demo session
      const stored = sessionStorage.getItem(DEMO_STORAGE_KEY);
      if (stored) {
        try {
          setUser(JSON.parse(stored));
          setIsDemo(true);
        } catch {
          sessionStorage.removeItem(DEMO_STORAGE_KEY);
        }
      }
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        mapUser(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        mapUser(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const mapUser = (sbUser: SupabaseUser) => {
    setUser({
      id: sbUser.id,
      name: sbUser.user_metadata?.full_name || sbUser.email?.split("@")[0] || "User",
      role: (sbUser.user_metadata?.role as Role) || "Admin",
      email: sbUser.email || "",
    });
    setLoading(false);
  };

  const demoLogin = (email: string, password: string): boolean => {
    const validCredentials =
      (email === "admin@creativemark.com" && password === "demo123") ||
      (email === "employee@creativemark.com" && password === "demo123");

    if (!validCredentials) return false;

    const demoUser: User = {
      ...DEMO_USER,
      email,
      role: email.startsWith("employee") ? "Employee" : "Admin",
      name: email.startsWith("employee") ? "Demo Employee" : "Demo Admin",
    };

    setUser(demoUser);
    setIsDemo(true);
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoUser));
    return true;
  };

  const logout = async () => {
    if (isDemo) {
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
      setUser(null);
      setIsDemo(false);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, demoLogin, isDemo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

