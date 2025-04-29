import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type User = {
  id: number;
  username: string;
  isAdmin: boolean;
  name?: string;
  usn?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  loginAsAdmin: (password: string) => Promise<boolean>;
  loginAsPeer: (name: string, usn: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      const data = await res.json();
      setUser(data);
      return true;
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsAdmin = async (password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await apiRequest("POST", "/api/auth/admin-login", { password });
      const data = await res.json();
      setUser(data);
      return true;
    } catch (error) {
      toast({
        title: "Admin login failed",
        description: error instanceof Error ? error.message : "Invalid admin password",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsPeer = async (name: string, usn: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await apiRequest("POST", "/api/auth/peer-login", { name, usn });
      const data = await res.json();
      setUser({ ...data, name, usn });
      return true;
    } catch (error) {
      toast({
        title: "Peer login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    loginAsAdmin,
    loginAsPeer,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
