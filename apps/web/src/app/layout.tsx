import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import type * as React from "react";
import { ServiceWorkerRegister } from "@/features/pwa/service-worker-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "BDE Mingo", template: "%s · BDE Mingo" },
  appleWebApp: { capable: true, title: "BDE Mingo", statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/192" },
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
    <html lang="fr" className={`${inter.variable} ${poppins.variable}`}>
      <body className="font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
