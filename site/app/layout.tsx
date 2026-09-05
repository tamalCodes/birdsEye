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
    default: "birdsEye - see how a repo fits together before you touch it",
    template: "%s - birdsEye",
  },
  description:
    "An agent plugin that turns any repository into an interactive flowchart: the major modules, the folders and files inside them, and the dependency arrows between them. Runs from Claude Code or Codex, locally on tree-sitter with no model call - zero tokens. One self-contained HTML file out.",
  keywords: [
    "code structure",
    "codebase map",
    "code visualization",
    "dependency graph",
    "tree-sitter",
    "AST",
    "Claude Code plugin",
    "Codex plugin",
    "agent plugin",
    "module map",
    "architecture diagram",
    "repository map",
  ],
  authors: [{ name: "tamalcodes" }],
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "birdsEye",
    title: "birdsEye - see how a repo fits together before you touch it",
    description:
      "One command turns any repo into an interactive flowchart of its modules, files, and dependencies. Local tree-sitter parse, no model, zero tokens. One HTML file, no server.",
  },
  twitter: {
    card: "summary_large_image",
    title: "birdsEye - see how a repo fits together before you touch it",
    description:
      "One command turns any repo into an interactive flowchart of its modules, files, and dependencies. Local, deterministic, zero tokens.",
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
            IntersectionObserver fires, and the hero map's Motion elements start
            hidden and undrawn. With no JS neither ever resolves and most of the
            page stays invisible, so unhide both outright in that case. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important;stroke-dasharray:none!important;stroke-dashoffset:0!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-full">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
