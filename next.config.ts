import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["pdfjs-dist"],
  experimental: {
    serverActions: {
      // El PDF del recibo (hasta 10 MB) viaja dentro del formulario.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
