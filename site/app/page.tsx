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
  MARKETPLACE_ADD,
  PLUGIN_INSTALL,
  MARKETPLACE_REMOVE,
  MARKETPLACE_UPDATE,
  MAP_COMMAND,
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
   Code is the host - the plugin is a set of Claude Code commands and skills.
   The three editors are the targets of the `editor` config: clicking a file in
   the finished map opens it there. Both halves are labelled as such, so the row
   never reads as a claim that the plugin runs inside an editor. */
/* Sizes are optical, not uniform: a solid square (JetBrains) and a solid cube
   (Cursor) read heavier than a spiky burst or a thin ribbon at the same box
   size, so the two solids come down a notch to sit level with the rest. */
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
          Find out where your agent{" "}
          <span className="font-display-italic text-clay">will get lost</span>
        </h1>
        {/* Two lines at max-w-xl on desktop. The artifact ("one HTML file") moved
            down to the line under the buttons: in the subhead it pushed this to
            four lines, and it is a detail, not the reason to care. */}
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted md:text-xl">
          One command audits your repo for stale guardrails, uncovered modules, and the
          specs an agent should read first.
        </p>

        {/* No copyable command up here on purpose. `/birdseye:map` only runs for
            somebody who already has the plugin, which is nobody arriving on this
            page for the first time - so as a hero call to action it asked the one
            thing a new visitor cannot do. The command still leads the Install
            section, three lines down, where it is actually runnable. */}
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
              See what it finds
            </a>
          </div>
          <p className="mt-4 text-sm text-faint">
            Two commands to install, one to run. One HTML file out, no server.
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

/* Order is the argument: the readiness audit is what birdsEye is for, and the
   structural views under it are the evidence that the audit can be trusted.
   Dot colours stay bound to their concept, not to their position - they echo
   the map legend further down (clay module, ochre route, rose doc), so
   reshuffling them to keep clay in the lead slot would break that link. */
const CAPABILITIES = [
  {
    dot: "var(--olive)",
    title: "Agent-readiness, per module",
    body: "Every module answered on one question: does an agent have what it needs before it touches this code? The docs that cover it, the guardrails it has to respect, the flow it should follow - and, where those are missing, a gap you can actually see.",
  },
  {
    dot: "var(--rose)",
    title: "Guardrails that went stale",
    body: "Docs are matched to the code they really describe, guardrails quoted verbatim, then glossed in plain English. Any spec still pointing at a file git has since deleted is flagged - that is the one an agent will read and confidently act on.",
  },
  {
    dot: "var(--clay)",
    title: "Modules & dependencies",
    body: "Every module is a node, every import an edge. Click one to see its fan-in and fan-out - the plain-language version of what would break if you touched it.",
  },
  {
    dot: "var(--ochre)",
    title: "Routes & screens",
    body: "The navigation tree, laid out like an org chart and boxed by feature. Step-flows like onboarding or checkout show their real order, not a pile of screens.",
  },
];

function WhatItDoes() {
  return (
    <Section
      id="what"
      kicker="What it does"
      title="What an agent knows before it touches your code"
      intro={
        <>
          <span className="font-display-italic text-ink">
            &ldquo;Before this agent edits auth - does it know what auth is wired to,
            which guardrails apply, and which spec to read first?&rdquo;
          </span>{" "}
          Open the map, click the node, get the answer in five seconds. Every decision in
          birdsEye was shaped by that one moment.
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
  { shape: "circle", color: "var(--clay)", label: "module" },
  { shape: "circle-sm", color: "var(--olive)", label: "file" },
  { shape: "box", color: "var(--ochre)", label: "route" },
  { shape: "box", color: "var(--plum)", label: "screen" },
  { shape: "diamond", color: "var(--rose)", label: "doc" },
];

const VIEWER_NOTES = [
  "Click any file and it opens where you actually work - VS Code, Cursor, JetBrains.",
  "Self-contained: it opens from file:// with no server and no network at all.",
  "Shape carries the type as much as colour does, so the map reads without colour vision.",
  "A repo with no router gets a line saying so, not an empty canvas.",
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
  if (shape === "box") {
    return (
      <span
        className="inline-block h-3.5 w-8 shrink-0 rounded-[5px]"
        style={{ background: color }}
        aria-hidden
      />
    );
  }
  if (shape === "diamond") {
    return (
      <span
        className="inline-block h-3 w-3 shrink-0 rotate-45 rounded-[3px]"
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
    name: "imports.mjs",
    model: false,
    body: "tsconfig aliases, barrels, comment-stripped parsing. Re-parses only what changed.",
  },
  {
    name: "extract-routes",
    model: true,
    body: "Reads the router and describes it - the one place judgement is genuinely required.",
  },
  {
    name: "extract-docs",
    model: true,
    body: "Attaches docs to the code they describe. Guardrails quoted verbatim, then glossed.",
  },
  {
    name: "extract-flowcharts",
    model: true,
    body: "Turns each module's docs into a step-by-step flow, grounded in what the docs say.",
  },
  {
    name: "merge.mjs + render.mjs",
    model: false,
    body: "One canonical graph.json, re-checked against git, then a single HTML file.",
  },
];

const LIMITS = [
  {
    h: "A wrong edge is never guessed",
    p: "When a navigation target is computed, the edge is skipped, not invented. A missing edge is cheap; a wrong one destroys trust in the whole map.",
  },
  {
    h: "Import edges are JS and TS only",
    p: "Another language still gets module nodes and a full doc map - just no dependency edges between files.",
  },
  {
    h: "Your source tree is left alone",
    p: "Nothing is written into it except birdseye.config.json, and only after it asks. The map lives in a gitignored folder.",
  },
];

function HowItWorks() {
  return (
    <Section
      id="how"
      kicker="How it works"
      title="Mechanical work is code. Judgement is the model."
      intro="Anything a script can do exactly is a script, so it is exact and free. The model runs only where a person would have to think - and only once, because the result is cached. Same input, same output, every time."
    >
      <ol className="mt-12 grid gap-px overflow-hidden rounded-t-2xl border border-hair bg-hair sm:grid-cols-2 lg:grid-cols-3">
        {PIPELINE.map((s, i) => (
          <Reveal as="li" key={s.name} delay={i * 0.05} className="bg-canvas p-6 md:p-7">
            <p className="flex items-center gap-2 font-mono text-[0.9rem] text-ink">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: s.model ? "var(--clay)" : "var(--olive)" }}
                aria-hidden
              />
              {s.name}
            </p>
            <p className="mt-2.5 text-[0.95rem] leading-relaxed text-muted">{s.body}</p>
          </Reveal>
        ))}
      </ol>

      {/* Outside the <ol> on purpose: it is a legend, and inside the list a
          screen reader announces it as a sixth pipeline stage. */}
      <Reveal className="mt-px rounded-b-2xl border-x border-b border-hair bg-raised/50 p-6 text-[0.95rem] leading-relaxed text-muted md:p-7">
        <span className="text-clay">&bull;</span> model &nbsp;
        <span className="text-olive">&bull;</span> plain Node. Later runs take seconds and
        cost nothing - the model stages are skipped when nothing they read changed.
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
   "install the plugin", so the answer should be the next thing on screen, not
   the last. Everything that is not one of the three commands - updating, the
   one failure mode worth documenting - is folded into a disclosure, so the
   default view is three lines and nothing else. */
const STEPS = [
  { n: "01", label: "Add the marketplace", note: "once per machine", cmd: MARKETPLACE_ADD },
  { n: "02", label: "Install the plugin", note: "once per machine", cmd: PLUGIN_INSTALL },
  { n: "03", label: "Run it", note: "in every repo you want a map of", cmd: MAP_COMMAND },
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
            Three commands, then any repo
          </h2>
          <p className="mt-5 leading-relaxed text-muted">
            Everything runs inside Claude Code - nothing to download by hand, no npm
            package. The first run takes a minute or two; every run after that is seconds.
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
                <CopyCommand command={s.cmd} />
              </div>
            </Reveal>
          ))}
        </ol>

        {/* Closed by default. Neither note applies to a first, clean install, and
            on screen they read as two more steps than there really are. */}
        <Reveal delay={0.2} className="mx-auto mt-6 max-w-2xl">
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
                    <CopyCommand command={note.cmd} />
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
    a: "It runs on your own Claude Code session. The mechanical stages use no model at all. The two extraction stages run once and are cached afterwards, so a refresh is effectively free.",
  },
  {
    q: "Does my code leave my machine?",
    a: "Only what Claude reads during the two extraction stages, exactly like any other Claude Code session. There is no birdsEye server - nothing is uploaded to us, because there is no us to upload to.",
  },
  {
    q: "What if the repo has no router or no docs?",
    a: "It degrades to what it can see. No router gets a canvas that says so. No docs gets a map of modules and dependencies. One README is a perfectly valid result. A monorepo is treated as a single root today; per-package roots are on the list.",
  },
  {
    q: "How stable is it?",
    a: "Very early. Expect rough edges, breaking changes between versions, and views that appear or disappear as the design settles.",
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
  { n: "0", label: "servers to run", p: "A marketplace is a public GitHub repo. Nothing to host, no npm package." },
  { n: "1", label: "file to share", p: "One HTML file, everything inlined. It opens from file:// on a plane." },
  { n: "MIT", label: "all the way down", p: "The plugin and every vendored library - Cytoscape, fcose - are MIT." },
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
              Find out where your agent will get lost. A Claude Code plugin that audits
              any repo for stale guardrails, uncovered modules, and the specs to read
              first.
            </p>
            <div className="mt-6 max-w-xs">
              <CopyCommand command={MAP_COMMAND} />
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
