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
    "A Claude Code plugin that audits any repository for agent-readiness: which docs cover each module, which guardrails have gone stale, and which specs an agent should read before touching the code. The whole picture lands as one self-contained HTML file.",
  keywords: [
    "agent readiness",
    "documentation drift",
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
      "One command tells you where an agent will get lost: stale guardrails, uncovered modules, the specs to read first. One HTML file. Runs on your own Claude account. No server, no build step, no network.",
  },
  twitter: {
    card: "summary_large_image",
    title: "birdsEye - see a whole codebase at one glance",
    description:
      "One command tells you where an agent will get lost: stale guardrails, uncovered modules, the specs to read first.",
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
        {/* Reveal starts its children at opacity 0 and only shows them once an
            IntersectionObserver fires. With no JS that never happens and most
            of the page stays invisible, so unhide it outright in that case. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-full">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
