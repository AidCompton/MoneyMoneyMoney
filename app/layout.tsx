import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Aurora } from "@/components/motion/Aurora";
import "./globals.css";

// Fonts are vendored into app/fonts (SIL OFL, see app/fonts/OFL.txt) rather
// than loaded from Google Fonts, so building and running this app never
// needs to reach the internet.
const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-Variable.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

const instrumentSerif = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff2", style: "normal", weight: "400" },
    { path: "./fonts/InstrumentSerif-Italic.woff2", style: "italic", weight: "400" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MoneyMoneyMoney",
  description: "Your household's savings goals, grocery budget, and weekly Money Meeting.",
};

export const viewport: Viewport = {
  themeColor: "#06110d",
  colorScheme: "dark",
};

// Marks the document as JS-enabled before first paint, so elements that
// GSAP animates in can start hidden without a flash of unstyled content.
// Without JS the class is never added and everything simply shows.
const jsFlag = "document.documentElement.classList.add('js')";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-ZA"
      className={`${bricolage.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: jsFlag }} />
      </head>
      <body className="relative min-h-full font-sans">
        <Aurora />
        <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
