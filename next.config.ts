import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      // Imagens de cartas servidas por APIs externas (nunca hospedadas localmente)
      { protocol: "https", hostname: "images.pokemontcg.io" },
      { protocol: "https", hostname: "limitlesstcg.nyc3.cdn.digitaloceanspaces.com" },
    ],
  },
};

export default nextConfig;
