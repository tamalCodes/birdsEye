import Nav from "@/components/Nav";
import Section from "@/components/Section";
import MapVisual from "@/components/MapVisual";
import CopyCommand from "@/components/CopyCommand";
import Reveal from "@/components/Reveal";
import {
  ClaudeMark,
  VsCodeMark,
  CursorMark,
  JetBrainsMark,
} from "@/components/ToolMarks";
import {
  GITHUB_URL,
  README_URL,
  ISSUES_URL,
  OPEN_CLAUDE_CODE,
  MARKETPLACE_ADD,
  PLUGIN_INSTALL,
  MARKETPLACE_REMOVE,
  MARKETPLACE_UPDATE,
  MAP_COMMAND,
  MAP_OPEN,
} from "@/lib/links";

export default function Home() {
  return (
    <div id="top" className="relative">
      <BackgroundWash />
      <Nav />
      <main>
        <Hero />
        <Install />
        <WhatItDoes />
        <TheMap />
        <HowItWorks />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

/* What actually runs birdsEye, and where the map it produces sends you. Claude
   Code is the host - the plugin is a set of Claude Code commands. The three
   editors are the targets of the `editor` config: clicking a file in the
   finished map opens it there. Both halves are labelled as such, so the row
   never reads as a claim that the plugin runs inside an editor. */
const HOST = { name: "Claude Code", Mark: ClaudeMark, size: "h-5 w-5" };

const EDITORS = [
  { name: "VS Code", Mark: VsCodeMark, size: "h-5 w-5" },
  { name: "Cursor", Mark: CursorMark, size: "h-[1.1rem] w-[1.1rem]" },
  { name: "JetBrains", Mark: JetBrainsMark, size: "h-[1.05rem] w-[1.05rem]" },
];

function Hero() {
  return (
    <section className="shell relative pt-20 pb-20 md:pt-28 md:pb-28">
      <div className="reveal mx-auto max-w-3xl text-center">
        <h1 className="font-display t-hero text-ink">
          See how a repo fits together{" "}
          <span className="font-display-italic text-clay">before you touch it</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted md:text-xl">
          One command turns any codebase into an interactive flowchart: the major modules
          up top, expand any box to the files inside, dependency arrows between them.
        </p>

        {/* No copyable command up here on purpose. `/birdseye:map` only runs for
            somebody who already has the plugin, which is nobody arriving on this
            page for the first time. The command leads the Install section, three
            lines down, where it is actually runnable. */}
        <div className="mt-10 flex flex-col items-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#install"
              className="inline-flex items-center rounded-lg bg-clay px-5 py-2.5 font-medium text-canvas transition-colors hover:bg-clay-bright"
            >
              Install the plugin
            </a>
            <a
              href="#what"
              className="inline-flex items-center rounded-lg border border-hair px-5 py-2.5 text-muted transition-colors hover:border-clay hover:text-ink"
            >
              See what it does
            </a>
          </div>
          <p className="mt-4 text-sm text-faint">
            Two commands to install, one to run. Runs on your machine - no model, no tokens.
          </p>
        </div>

        <ToolRow />
      </div>

      <div
        className="reveal mx-auto mt-16 max-w-5xl"
        style={{ animationDelay: "0.15s" }}
      >
        <MapVisual />
      </div>
    </section>
  );
}

function ToolRow() {
  return (
    <div className="mt-14 flex flex-wrap items-center justify-center gap-x-7 gap-y-4 text-sm text-faint">
      <span className="flex items-center gap-2.5 text-muted">
        <HOST.Mark className={`${HOST.size} text-clay`} />
        {HOST.name}
      </span>

      <span aria-hidden className="hidden h-4 w-px bg-hair sm:block" />

      <span className="text-faint">opens files in</span>

      {EDITORS.map((t) => (
        <span key={t.name} className="flex items-center gap-2.5 text-muted">
          <t.Mark className={t.size} />
          {t.name}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- what it does */

/* Dot colours stay bound to their concept, echoing the map legend further down
   (ochre root, clay module, plum folder, olive file). */
const CAPABILITIES = [
  {
    dot: "var(--clay)",
    title: "The major modules, up front",
    body: "The top level is a handful of boxes - the feature modules, plus one General-purpose group for the shared code everything imports. You see the spine of the repo before you read a line of it.",
  },
  {
    dot: "var(--plum)",
    title: "Expand any box",
    body: "Click a module and it opens in place to the folders and files inside it. Go as deep as you want, collapse it back when you are done. The layout settles around whatever you have open.",
  },
  {
    dot: "var(--olive)",
    title: "Dependency arrows that follow you",
    body: "Every import and call, rolled up to whichever level is open. Select a node and the panel tells you exactly what it depends on and what depends on it - the plain-language blast radius.",
  },
  {
    dot: "var(--ochre)",
    title: "Parsed, not guessed",
    body: "Around 25 languages through tree-sitter - JavaScript, Python, Go, Rust, Java, C#, Ruby and more. Deterministic: the same repo always produces the same map, so it diffs cleanly.",
  },
];

function WhatItDoes() {
  return (
    <Section
      id="what"
      kicker="What it does"
      title="The first twenty minutes in a new repo, done for you"
      intro={
        <>
          <span className="font-display-italic text-ink">
            &ldquo;Where does this live, what does it lean on, and what breaks if I change
            it?&rdquo;
          </span>{" "}
          Every time you - or an agent - opens an unfamiliar codebase, that is the question.
          birdsEye answers it from a picture instead of a grep, offline, in seconds.
        </>
      }
    >
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-hair bg-hair sm:grid-cols-2">
        {CAPABILITIES.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.06} className="bg-canvas p-7 md:p-9">
            <span
              className="block h-2.5 w-2.5 rounded-full"
              style={{ background: c.dot }}
              aria-hidden
            />
            <h3 className="font-display mt-4 text-2xl text-ink">{c.title}</h3>
            <p className="mt-3 leading-relaxed text-muted">{c.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ the map */

const LEGEND = [
  { shape: "box", color: "var(--ochre)", label: "code root" },
  { shape: "box", color: "var(--clay)", label: "module" },
  { shape: "box-sm", color: "var(--plum)", label: "folder" },
  { shape: "circle-sm", color: "var(--olive)", label: "file" },
];

const VIEWER_NOTES = [
  "Click any file and it opens where you actually work - VS Code, Cursor, JetBrains, Zed.",
  "Self-contained: it opens from file:// with no server and no network at all.",
  "It remembers what you had expanded, and ships a light and a dark theme.",
  "Search jumps to any module or file and opens the path down to it.",
];

function TheMap() {
  return (
    <section
      id="views"
      className="scroll-mt-24 border-y border-hair-soft bg-panel/60 py-20 md:py-24"
    >
      <div className="shell grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <Reveal>
          <p className="kicker">The map</p>
          <h2 className="font-display mt-5 t-section text-ink">
            One HTML file you can hand to anyone
          </h2>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-2.5 text-muted">
                <Glyph shape={l.shape} color={l.color} />
                {l.label}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ul className="space-y-4">
            {VIEWER_NOTES.map((n) => (
              <li key={n} className="flex gap-4">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />
                <span className="leading-relaxed text-muted">{n}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function Glyph({ shape, color }: { shape: string; color: string }) {
  if (shape === "box" || shape === "box-sm") {
    return (
      <span
        className={`inline-block shrink-0 rounded-[5px] ${shape === "box" ? "h-3.5 w-8" : "h-3.5 w-5"}`}
        style={{ background: color }}
        aria-hidden
      />
    );
  }
  const d = shape === "circle-sm" ? 10 : 15;
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ background: color, width: d, height: d }}
      aria-hidden
    />
  );
}

/* --------------------------------------------------------------- how it works */

const PIPELINE = [
  {
    name: "structure.mjs scan",
    body: "Finds the code root and makes a first-pass guess at which folders are features and which are shared infrastructure.",
  },
  {
    name: "ast.mjs",
    body: "Hands every source file to graphify's tree-sitter parser and collapses the symbol graph to a file-level dependency graph.",
  },
  {
    name: "build.mjs",
    body: "Rolls that flat graph into the containment tree - root, modules, folders, files - the viewer draws.",
  },
  {
    name: "render.mjs",
    body: "Inlines the vendored Cytoscape into one self-contained HTML file. No CDN, no server.",
  },
];

const LIMITS = [
  {
    h: "Python 3.10+ is required",
    p: "The parser is a Python package (graphify, Apache-2.0) that birdsEye installs into its own virtualenv on the first run. No Python, no map.",
  },
  {
    h: "A wrong edge is never guessed",
    p: "graphify resolves an import to a real file or leaves it out. A missing edge is cheap; a wrong one poisons trust in the whole map.",
  },
  {
    h: "Your source tree is left alone",
    p: "Nothing is written into it except birdseye.config.json, and only after it asks. The map and its cache live in a gitignored folder.",
  },
];

function HowItWorks() {
  return (
    <Section
      id="how"
      kicker="How it works"
      title="No model in the loop. Zero tokens."
      intro="Extraction is graphify's tree-sitter parse - it runs on your machine and reads nothing back to anyone. Everything else is a few hundred lines of Node. Same repo in, same map out, every time."
    >
      <ol className="mt-12 grid gap-px overflow-hidden rounded-t-2xl border border-hair bg-hair sm:grid-cols-2 lg:grid-cols-4">
        {PIPELINE.map((s, i) => (
          <Reveal as="li" key={s.name} delay={i * 0.05} className="bg-canvas p-6 md:p-7">
            <p className="flex items-center gap-2 font-mono text-[0.9rem] text-ink">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--olive)" }}
                aria-hidden
              />
              {s.name}
            </p>
            <p className="mt-2.5 text-[0.95rem] leading-relaxed text-muted">{s.body}</p>
          </Reveal>
        ))}
      </ol>

      <Reveal className="mt-px rounded-b-2xl border-x border-b border-hair bg-raised/50 p-6 text-[0.95rem] leading-relaxed text-muted md:p-7">
        Every stage runs locally with no model call. graphify keeps a per-file content
        hash, so a re-run only re-parses what changed - usually a second or two.
      </Reveal>

      <div className="mt-14 border-t border-hair pt-12">
        <p className="kicker">Where it stops</p>
        <h3 className="font-display mt-4 max-w-2xl text-2xl leading-snug text-ink md:text-3xl">
          A map you can trust is a map that admits what it cannot see
        </h3>
        <div className="mt-9 grid gap-8 md:grid-cols-3">
          {LIMITS.map((l, i) => (
            <Reveal key={l.h} delay={i * 0.06}>
              <h4 className="font-display text-lg text-ink">{l.h}</h4>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{l.p}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ install */

/* This sits directly under the hero on purpose: the page's first ask is
   "install the plugin", so the answer should be the next thing on screen.

   Step 00 is a real shell command ("$"). Steps 01-03 are typed inside Claude
   Code's own prompt, never the terminal, so they render with ">". Pasting a
   "/plugin ..." line into zsh/bash fails - it's a Claude Code slash command,
   not a program. The prompts side by side show the boundary. Step 04 is a file
   path, not a command - no prompt glyph, since "how you open a file" is not the
   same on every OS. */
const STEPS = [
  { n: "00", label: "Open Claude Code", note: "in your terminal, once", cmd: OPEN_CLAUDE_CODE, prompt: "$" },
  { n: "01", label: "Add the marketplace", note: "once per machine", cmd: MARKETPLACE_ADD, prompt: ">" },
  { n: "02", label: "Install the plugin", note: "once per machine", cmd: PLUGIN_INSTALL, prompt: ">" },
  { n: "03", label: "Build the map", note: "any repo, zero tokens", cmd: MAP_COMMAND, prompt: ">" },
  { n: "04", label: "Open the map", note: "self-contained - any browser, no server", cmd: MAP_OPEN, prompt: "" },
];

const INSTALL_NOTES = [
  {
    h: "Updating to a new version",
    p: "Auto-update is off for third-party marketplaces. Pull a new version with this, then run step 02 again.",
    cmd: MARKETPLACE_UPDATE,
  },
  {
    h: "If step 01 is refused",
    p: "Marketplace names are global, so adding is refused when birdseye-marketplace is already registered on your machine from another source, usually a local clone. Drop the old registration, then run step 01 again.",
    cmd: MARKETPLACE_REMOVE,
  },
];

function Install() {
  return (
    <section
      id="install"
      className="scroll-mt-24 border-y border-hair-soft bg-panel/60 py-20 md:py-24"
    >
      <div className="shell">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="kicker">Install</p>
          <h2 className="font-display mt-5 t-section text-ink">
            Install once, map any repo
          </h2>
          <p className="mt-5 leading-relaxed text-muted">
            Add the marketplace and install the plugin once. After that,{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
              /birdseye:map
            </code>{" "}
            in any repo parses it with tree-sitter on your machine - no model call, no
            tokens - and writes one self-contained{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
              birdseye/index.html
            </code>{" "}
            you open in a browser. Steps marked{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
              &gt;
            </code>{" "}
            are typed inside Claude Code;{" "}
            <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
              $
            </code>{" "}
            is your terminal. The first run also installs the tree-sitter parser into its
            own virtualenv - a one-time download of tens of seconds; every run after is a
            second or two.
          </p>
        </Reveal>

        <ol className="mx-auto mt-12 max-w-2xl space-y-3">
          {STEPS.map((s, i) => (
            <Reveal
              as="li"
              key={s.n}
              delay={i * 0.06}
              className="rounded-2xl border border-hair bg-canvas/70 p-5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tracking-[0.14em] text-clay">{s.n}</span>
                <span className="text-ink">{s.label}</span>
                <span className="text-sm text-faint">{s.note}</span>
              </div>
              <div className="mt-3.5">
                <CopyCommand command={s.cmd} prompt={s.prompt} />
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.16} className="mx-auto mt-6 max-w-2xl">
          <p className="rounded-2xl border border-hair bg-raised/40 px-5 py-4 text-[0.92rem] leading-relaxed text-muted sm:px-6">
            <span className="text-ink">Needs Python 3.10+ on the machine</span> (and
            ideally <code className="font-mono text-[0.9em] text-ink">uv</code>). birdsEye
            sets up its own virtualenv - point{" "}
            <code className="font-mono text-[0.9em] text-ink">$BIRDSEYE_PYTHON</code> at an
            interpreter to skip that.
          </p>
        </Reveal>

        {/* Closed by default. Neither note applies to a first, clean install. */}
        <Reveal delay={0.2} className="mx-auto mt-4 max-w-2xl">
          <details className="group rounded-2xl border border-hair bg-raised/40 open:bg-raised/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[0.95rem] text-muted transition-colors hover:text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
              Updating, and the one thing that can go wrong
              <span
                aria-hidden
                className="shrink-0 text-clay transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="space-y-7 border-t border-hair px-5 pb-6 pt-6 sm:px-6">
              {INSTALL_NOTES.map((note) => (
                <div key={note.h}>
                  <p className="text-ink">{note.h}</p>
                  <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted">{note.p}</p>
                  <div className="mt-3.5">
                    <CopyCommand command={note.cmd} prompt=">" />
                  </div>
                </div>
              ))}
            </div>
          </details>
        </Reveal>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- faq */

const FAQ = [
  {
    q: "What does it cost to run?",
    a: "Nothing. There is no model call anywhere in the pipeline - extraction is a local tree-sitter parse. The only network access is a one-time pip install of the parser on the first run.",
  },
  {
    q: "Does my code leave my machine?",
    a: "No. graphify parses everything locally and reports nothing anywhere. There is no birdsEye server - nothing is uploaded to us, because there is no us to upload to.",
  },
  {
    q: "Which languages does it cover?",
    a: "Whatever graphify's tree-sitter grammars cover: JavaScript/TypeScript, Python, Go, Rust, Java, C/C++, C#, Ruby, PHP, Kotlin, Swift, Scala and more. A file in an unsupported language still counts toward its folder's totals, it just has no dependency edges. A monorepo with several package roots is approximated as one today.",
  },
  {
    q: "How stable is it?",
    a: "Very early. Expect rough edges and breaking changes between versions. The earlier readiness, routes and docs views are dormant while the structure map settles.",
  },
];

function Faq() {
  return (
    <Section id="faq" kicker="FAQ" title="Before you run it">
      <div className="mt-10 divide-y divide-hair border-y border-hair">
        {FAQ.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              <span
                aria-hidden
                className="shrink-0 text-clay transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ footer */

const FOOTER_FACTS = [
  { n: "0", label: "tokens to run", p: "No model call in the pipeline. The parse is local tree-sitter, start to finish." },
  { n: "1", label: "file to share", p: "One HTML file, everything inlined. It opens from file:// on a plane." },
  { n: "OSS", label: "top to bottom", p: "Plugin MIT, the graphify parser Apache-2.0, vendored Cytoscape and fcose MIT." },
];

const FOOTER_NAV = [
  {
    heading: "The map",
    links: [
      { label: "What it does", href: "#what" },
      { label: "Reading the map", href: "#views" },
      { label: "How it works", href: "#how" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Get it",
    links: [
      { label: "Install", href: "#install" },
      { label: "Plugin README", href: README_URL, external: true },
      { label: "Source on GitHub", href: GITHUB_URL, external: true },
      { label: "Report an issue", href: ISSUES_URL, external: true },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-hair-soft bg-panel/40">
      <div className="shell py-16">
        <div className="grid gap-10 sm:grid-cols-3">
          {FOOTER_FACTS.map((f) => (
            <div key={f.label}>
              <p className="font-display text-3xl text-clay">{f.n}</p>
              <p className="mt-1 font-display text-lg text-ink">{f.label}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.p}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-10 border-t border-hair pt-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 font-semibold">
              <svg viewBox="16 19 208 208" className="h-5 w-5" aria-hidden>
                <path
                  transform="translate(0 8)"
                  d="M120 52C129 54 133 66 134 82C150 92 186 116 210 146C213 150 211 154 206 153C176 150 150 140 133 128C132 145 128 164 120 178C112 164 108 145 107 128C90 140 64 150 34 153C29 154 27 150 30 146C54 116 90 92 106 82C107 66 111 54 120 52Z"
                  fill="var(--clay)"
                />
              </svg>
              birdsEye
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              Turn any repo into an interactive flowchart of its structure - the modules,
              the files inside them, and how they depend on each other. A Claude Code
              plugin. Local, deterministic, zero tokens.
            </p>
            <div className="mt-6 max-w-xs">
              <CopyCommand command={MAP_COMMAND} prompt=">" />
            </div>
          </div>

          {FOOTER_NAV.map((col) => (
            <nav key={col.heading}>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-faint">
                {col.heading}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-muted">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                      className="link-underline hover:text-ink"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-hair pt-7 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>MIT licensed. Built by Tamal Das with Claude Code.</p>
          <p className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-clay" />
            Early preview - expect breaking changes between versions.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------- background */

function BackgroundWash() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="dot-grid absolute inset-0 opacity-[0.55]" />
      <div
        className="absolute inset-x-0 top-0 h-[70vh]"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--clay) 12%, transparent), transparent)",
        }}
      />
    </div>
  );
}
