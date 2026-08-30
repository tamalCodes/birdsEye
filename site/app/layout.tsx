import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://birdseye.tamal.me";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "birdsEye - see a whole codebase at one glance",
    template: "%s - birdsEye",
  },
  description:
    "A Claude Code plugin that maps any repository to a single self-contained HTML file: its modules and how they depend on each other, its routes and screens, and the spec files an agent should read before touching any of it.",
  keywords: [
    "codebase map",
    "code visualization",
    "dependency graph",
    "Claude Code plugin",
    "agentic coding",
    "architecture diagram",
    "repository map",
  ],
  authors: [{ name: "tamalcodes" }],
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "birdsEye",
    title: "birdsEye - see a whole codebase at one glance",
    description:
      "One command, one HTML file: the modules, routes and specs of a codebase, mapped. Runs on your own Claude account. No server, no build step, no network.",
  },
  twitter: {
    card: "summary_large_image",
    title: "birdsEye - see a whole codebase at one glance",
    description:
      "One command, one HTML file: the modules, routes and specs of a codebase, mapped.",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

// Runs before first paint so the correct theme is on <html> with no flash:
// an explicit choice from localStorage wins, otherwise the OS preference.
const themeScript = `(function(){try{var t=localStorage.getItem("birdseye-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${outfit.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
