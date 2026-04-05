import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  debug: true,
  callbacks: {
    async redirect({ url, baseUrl }) {
      console.info("[NextAuth][redirect]", { url, baseUrl });
      return baseUrl;
    },
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isProtected =
        pathname.startsWith("/dashboard") || pathname.startsWith("/matches");

      console.info("[NextAuth][authorized]", {
        pathname,
        isProtected,
        hasAuth: !!auth,
      });

      if (!isProtected) {
        return true;
      }

      return !!auth;
    },
    async signIn({ user, account }) {
      console.info("[NextAuth][signIn]", {
        provider: account?.provider,
        email: user?.email,
      });
      return true;
    },
  },
  events: {
    async signIn(message: unknown) {
      console.info("[NextAuth][event:signIn]", message);
    },
    async signOut(message: unknown) {
      console.info("[NextAuth][event:signOut]", message);
    },
  },
  trustHost: true,
};

if (!process.env.NEXTAUTH_URL) {
  console.warn("[NextAuth][config] NEXTAUTH_URL is not set");
}

export const { handlers, auth } = NextAuth(authOptions);
