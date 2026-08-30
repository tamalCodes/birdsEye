import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { GITHUB_URL } from "@/lib/links";

const links = [
  { href: "#what", label: "What it does" },
  { href: "#views", label: "The map" },
  { href: "#how", label: "How it works" },
  { href: "#install", label: "Install" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-50">
      <div className="glass">
        <nav className="shell flex h-16 items-center gap-6">
          <Link href="#top" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <svg viewBox="16 19 208 208" className="h-6 w-6" aria-hidden>
              <path
                transform="translate(0 8)"
                d="M120 52C129 54 133 66 134 82C150 92 186 116 210 146C213 150 211 154 206 153C176 150 150 140 133 128C132 145 128 164 120 178C112 164 108 145 107 128C90 140 64 150 34 153C29 154 27 150 30 146C54 116 90 92 106 82C107 66 111 54 120 52Z"
                fill="var(--clay)"
              />
            </svg>
            birdsEye
          </Link>

          <ul className="ml-2 hidden items-center gap-7 text-[0.95rem] text-muted md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="link-underline transition-colors hover:text-ink">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-2.5">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-hair px-3.5 py-2 text-sm text-muted transition-colors hover:border-clay hover:text-ink"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
