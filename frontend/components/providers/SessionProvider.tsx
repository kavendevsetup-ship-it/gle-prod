"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { useSession } from "next-auth/react";

import { bridgeBackendAuth } from "@/services/api";

function BackendTokenBridge() {
  const { data: session, status } = useSession();

  useEffect(() => {
    const syncToken = async () => {
      if (status === "unauthenticated") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("backend_auth_email");
        return;
      }

      if (status !== "authenticated") {
        return;
      }

      const email = session?.user?.email;
      if (!email) {
        return;
      }

      const currentToken = localStorage.getItem("access_token");
      const syncedEmail = localStorage.getItem("backend_auth_email");

      if (currentToken && syncedEmail === email) {
        return;
      }

      try {
        const bridge = await bridgeBackendAuth({
          email,
          name: session?.user?.name || undefined,
        });
        localStorage.setItem("access_token", bridge.token);
        localStorage.setItem("backend_auth_email", email);
      } catch {
        localStorage.removeItem("access_token");
      }
    };

    void syncToken();
  }, [session?.user?.email, session?.user?.name, status]);

  return null;
}

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <BackendTokenBridge />
      {children}
    </SessionProvider>
  );
}
