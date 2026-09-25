import type { Metadata } from "next";
import "./globals.css";

// Deliberately using the system font stack (no next/font/google) so that
// building and running this app never needs to reach the internet.

export const metadata: Metadata = {
  title: "MoneyMoneyMoney",
  description: "A local household money planner",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
