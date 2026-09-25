import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets `npm run dev` be reached from 127.0.0.1 (used by the Playwright
  // smoke test) in addition to localhost. If you run `npm run dev` (rather
  // than the production `npm run start`) from another device on your home
  // network, add that device's origin here too.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
