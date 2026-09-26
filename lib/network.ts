import "server-only";
import os from "node:os";

/**
 * Addresses your phones can use to reach this computer on the home network:
 * its LAN IP address(es) and its local network name.
 */
export function lanAddresses(port: string) {
  const all = Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
  // Home networks almost always use these ranges, so list them first.
  const home = (ip: string) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  const ips = [...all.filter(home), ...all.filter((ip) => !home(ip))];
  const host = os.hostname().replace(/\.local$/, "");
  return {
    urls: ips.map((ip) => `http://${ip}:${port}`),
    localName: host ? `http://${host}.local:${port}` : null,
  };
}
