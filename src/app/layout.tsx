import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

/* Polices auto-hebergees par Next : plus de requete bloquante vers Google. */
const titre = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--police-titre",
  display: "swap",
});

const interface_ = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--police-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agenda",
  description: "Espace privé",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Agenda", statusBarStyle: "black-translucent" },
  icons: { icon: "/icone-192.png", apple: "/icone-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0d0a0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${titre.variable} ${interface_.variable}`}>
      <body className="halo">
        <div className="relative z-10 min-h-full">{children}</div>
      </body>
    </html>
  );
}
