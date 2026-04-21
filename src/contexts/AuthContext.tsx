import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Role = "Admin" | "Employee";

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const USERS: User[] = [
  { id: "E-001", name: "Vikram Joshi", role: "Admin", email: "admin@creativemark.com" },
  { id: "E-004", name: "Neha Kapoor", role: "Employee", email: "neha@creativemark.com" },
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("crm_auth_user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const login = (u: User) => {
    setUser(u);
    localStorage.setItem("crm_auth_user", JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("crm_auth_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
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
