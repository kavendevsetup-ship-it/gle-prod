"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  isPremium: boolean;
  first_name?: string;
  last_name?: string;
  picture?: string;
  premium_expires_at?: string;
}

interface Tokens {
  access: string;
  refresh: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData?: User, tokens?: Tokens) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser) as User);
      }
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (userData?: User, tokens?: Tokens) => {
    if (!userData || !tokens) {
      throw new Error("Invalid login attempt - missing user data or tokens");
    }

    const normalizedUser: User = {
      id: userData.id.toString(),
      name:
        userData.first_name && userData.last_name
          ? `${userData.first_name} ${userData.last_name}`
          : userData.name || userData.email.split("@")[0],
      email: userData.email,
      profileImage: userData.picture || userData.profileImage,
      isPremium: userData.isPremium || false,
      first_name: userData.first_name,
      last_name: userData.last_name,
      picture: userData.picture,
      premium_expires_at: userData.premium_expires_at,
    };

    setUser(normalizedUser);
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    localStorage.setItem("access_token", tokens.access);
    localStorage.setItem("refresh_token", tokens.refresh);
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  };

  const refreshToken = async () => {
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
