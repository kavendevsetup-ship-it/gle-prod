import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  display: "swap",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grand League Expert",
  description: "Grand League Expert delivers data-driven cricket insights, matchup analysis, and premium tools to optimize your fantasy strategy.",
  icons: {
    icon: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
