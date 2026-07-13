import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ancrer la racine du projet ici : d'autres lockfiles existent plus haut
  // dans l'arborescence (~/package-lock.json) et Next inférait le mauvais dossier.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
