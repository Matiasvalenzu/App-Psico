import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Permite que dispositivos de la red local consuman los recursos de desarrollo.
  allowedDevOrigins: ["192.168.1.151"],
};

export default nextConfig;
