import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/_providers/themeProvider";
import { Toaster } from "sonner";
import AppShell from "@/components/navbar";
import AuthGate from "@/components/auth-gate";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BSREA Staff Panel",
  description: "BSREA staff panel",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthGate>
            <AppShell>{children}</AppShell>
          </AuthGate>
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
