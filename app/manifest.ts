import type { MetadataRoute } from "next";

// Lets you add the app to a phone's home screen, where it opens full screen
// like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoneyMoneyMoney",
    short_name: "Money",
    description: "Your household's budgets, savings, groceries and weekly Money Meeting.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06110d",
    theme_color: "#06110d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
