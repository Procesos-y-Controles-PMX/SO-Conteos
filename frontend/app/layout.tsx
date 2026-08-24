import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, Saira_Condensed } from "next/font/google";
import { ThemeProvider } from "@promexma/ui";
import { Toaster } from "sonner";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const sairaCondensed = Saira_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-saira",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SO Conteos",
  description: "Conciliación de inventario físico vs SAP por sucursal — Promexma",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${plexSans.variable} ${plexMono.variable} ${sairaCondensed.variable} min-h-screen font-sans`}>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
