import os from "node:os";
import type { NextConfig } from "next";

// `npm run dev` only runs the page's scripts for addresses it has been told
// about. Without these, a phone opening http://192.168.x.x:3000 gets the page
// but nothing on it responds (the "Join a household" tab, for one). Allow this
// computer's own network addresses and name, plus the usual home-network
// ranges in case the address changes while the server is running.
const ownAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
  .map((i) => i.address);
const hostName = os.hostname().replace(/\.local$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    ...ownAddresses,
    ...(hostName ? [`${hostName}.local`] : []),
    "*.local",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
  ],
  // Receipt scanning runs text recognition in a worker thread and uses native
  // image code; both must load from node_modules rather than be bundled.
  serverExternalPackages: ["tesseract.js", "sharp"],
};

export default nextConfig;
