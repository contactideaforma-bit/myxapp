import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Un package-lock.json traîne dans /Users/moi : sans ça, Next.js croit
  // que la racine du projet est le dossier utilisateur.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
