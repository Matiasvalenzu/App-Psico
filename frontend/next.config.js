/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.151"],
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
