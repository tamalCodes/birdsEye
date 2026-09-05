# birdsEye - marketing site

The showcase site for [birdsEye](../plugins/birdseye), the agent plugin that
maps a repository for Claude Code and Codex and hands back a single
self-contained HTML file.

The landing page leads on that audit - stale guardrails, uncovered modules, the
specs to read first - and treats the structural map (modules, routes, screens) as
the evidence underneath it. Keep new copy in that order: the page argues readiness
first, mechanism second.

Next.js 16 (App Router) + Tailwind v4. One long landing page, no CMS, no database.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy (Vercel)

The verified production path is to run Vercel from this `site/` directory:

```bash
npm run build
vercel deploy --prod --yes
```

This prevents the surrounding plugin marketplace repository from being used as the web app root.
See the complete [deployment guide](../docs/DEPLOYMENT.md) for project facts, checks, previews, rollback, environment setup, and the separate plugin-marketplace release process.

## Structure

```
app/
├── layout.tsx            fonts (Fraunces + Outfit), metadata
├── page.tsx              the whole landing page, section by section
├── globals.css           design tokens + helpers (warm-charcoal palette)
├── opengraph-image.tsx   generated OG/Twitter card
├── robots.ts / sitemap.ts
components/
├── Nav.tsx  Section.tsx  Reveal.tsx  CopyCommand.tsx
└── MapVisual.tsx          hand-built SVG recreation of a real map
lib/links.ts               canonical GitHub / command strings
```

## Theming

Light and dark, both warm. Light is the default (bare `:root`, the same
`#faf9f5` paper the map viewer uses); dark is redefined under both
`@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]` - keep the
two token lists in sync. The toggle in the nav (`components/ThemeToggle.tsx`)
persists to `localStorage`, and an inline script in `app/layout.tsx` sets the
theme before first paint. First visit follows the OS setting.

## Editing copy

All section copy is inline in `app/page.tsx` as plain arrays near each section
component. The palette and type scale are CSS variables at the top of
`app/globals.css`.
