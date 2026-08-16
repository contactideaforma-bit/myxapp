import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Titre volontairement neutre : discret dans l'historique du navigateur
  title: "Agenda",
  description: "Espace privé",
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
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="halo">
        <div className="relative z-10 min-h-full">{children}</div>
      </body>
    </html>
  );
}
