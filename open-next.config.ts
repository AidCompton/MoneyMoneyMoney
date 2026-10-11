import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page is personal and rendered per request, so no page cache is needed.
export default defineCloudflareConfig();
