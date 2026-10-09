import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, Poppins } from "next/font/google";
import type * as React from "react";
import { ServiceWorkerRegister } from "@/features/pwa/service-worker-register";
import { env } from "@/lib/server-env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-poppins",
  display: "swap",
});

/** Headings of the showcase site (route group "(site)"). */
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.SITE_URL),
  title: { default: "BDE Mingo", template: "%s · BDE Mingo" },
  appleWebApp: { capable: true, title: "BDE Mingo", statusBarStyle: "default" },
  description: "Événements, billets et points open du BDE Mingo (ESGI Paris).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcf8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1233" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${poppins.variable} ${barlow.variable}`}>
      <body className="font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
