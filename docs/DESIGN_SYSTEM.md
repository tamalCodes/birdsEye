# birdsEye Design System

This file is the durable design law for birdsEye.
It covers both shipped surfaces: the generated map viewer and the marketing site.
Read it before changing any visual code, and update it in the same change whenever a rule here stops being true.

Companion specs:

- `plugins/birdseye/DESIGN_VIEWER.md` for the viewer's layout geometry and canvas rules.
- `docs/AGENT_MEMORY.md` for non-visual project memory.

## 1. What birdsEye Should Feel Like

birdsEye is a structure map for a codebase, read mostly by people who did not write that codebase.
The product voice is calm, warm, and hand-drawn, not corporate-dashboard.

Three principles, in priority order:

1. **Legibility beats decoration.** If an effect makes a label harder to read at a glance, the effect loses.
2. **Warm, not cold.** Every surface and every accent is warm-shifted. A neutral blue-grey scheme was explicitly tried and rejected.
3. **Hand-set, not machine-ruled.** Small deliberate irregularity (tiny position jitter, a hand-lettered diagram face, dashed containment frames) makes the map read as a sketch someone drew, not as a generated chart.

Anti-goals:

- No cool grey or blue-grey UI chrome.
- No pure black (`#000`) and no pure white (`#fff`) as a surface.
- No decorative gradients or glass blur on chrome.
- No fabricated content to fill a sparse view. If a region looks empty, tighten the layout instead of inventing nodes.

## 2. Color

Both surfaces share one identity: warm charcoal in the dark, warm cream in the light, with a clay accent.
The light canvas is `#faf9f5` in both surfaces on purpose, so the site and the viewer never read as two different products.

### 2.1 Viewer palette

Defined in `plugins/birdseye/scripts/template/index.html`.
Dark lives on bare `:root` (the viewer defaults to dark); light is redefined under `[data-theme="light"]`.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--bg` | `#171512` | `#faf9f5` | Canvas ground |
| `--bg-panel` | `#201d19` | `#f2f0e8` | Header, sidebar, floating chips |
| `--bg-raised` | `#2a2621` | `#e9e6db` | Tags, containment frame fill |
| `--sheet` | `#1c1a16` | `#fffdf8` | Detail panel and tooltip |
| `--line` | `#38332c` | `#e0dcd0` | Default hairline |
| `--line-soft` | `#2c2822` | `#ebe8de` | Internal separators |
| `--line-strong` | `#6b6355` | `#beb8a8` | Hover borders, frame outlines |
| `--dot` | `#221f1a` | `#e7e4d9` | Canvas dot grid |
| `--text` | `#dedacf` | `#211e19` | Primary ink |
| `--text-dim` | `#918a7c` | `#706a5e` | Secondary ink, all labels and captions |
| `--accent` | `#d97757` | `#bf5b36` | Clay: selection, links, primary button |
| `--edge-out` | `#d97757` | `#bf5b36` | "Depends on" flow |
| `--edge-in` | `#a9b764` | `#5e7524` | "Used by" flow |
| `--warn` | `#e0a458` | `#9c6212` | Unused code: outlines, badges, the callout rule |
| `--warn-soft` | `rgba(224,164,88,.13)` | `rgba(156,98,18,.12)` | Fill behind any of the above |

Node hues carry meaning and must not be reassigned for looks:

| Token | Dark | Light | Node type |
| --- | --- | --- | --- |
| `--c-root` | `#e8d9c4` | `#4a3f30` | Repository root |
| `--c-zone` | `#b7a488` | `#8a7860` | Zone grouping |
| `--c-feature` | `#d97757` | `#bf5b36` | Feature module |
| `--c-shared` | `#c68f66` | `#a86b45` | Shared module (`meta.kind === 'shared'`) |
| `--c-folder` | `#c9a56b` | `#9a6a12` | Folder |
| `--c-file` | `#a9b764` | `#5e7524` | File |

`--warn` is the one accent that is not clay, and it earns that by never competing with clay: clay marks what you selected, amber marks what needs a look.
It is a **state** colour and must never be used as a node fill.
An unused node keeps its type hue and is drawn back to `0.34` opacity with a dashed `--warn` border - so the hue still answers "what is this" while the outline answers "does anything reach it".

Mapping lives in `colorVar()` in the template.
Node label ink is computed per node by `idealText()` against the node fill, never hard-coded.

### 2.2 Site palette

Defined in `site/app/globals.css`.
The site is light-first: light on bare `:root`, dark under both `@media (prefers-color-scheme: dark)` (guarded with `:root:not([data-theme="light"])`) and `:root[data-theme="dark"]`.

Core: `--canvas`, `--panel`, `--raised`, `--hair`, `--hair-soft`, `--ink`, `--muted`, `--faint`.
Accents: `--bark`, `--clay`, `--clay-bright`, `--olive`, `--ochre`, `--plum`, `--rose`, `--teal`.
`--box-ink` is the ink for a label sitting on a filled hue box, and it flips opposite the page.

Four of those accents are not decorative. They are the node hues, and they match the viewer one for one, because the hero diagram is a recreation of a real map and has to teach the same colour language the product uses:

| Site token | Node kind | Viewer token |
| --- | --- | --- |
| `--bark` (`#4a3f30` / `#e8d9c4`) | code root | `--c-root` |
| `--clay` | module | `--c-feature` |
| `--ochre` | folder | `--c-folder` |
| `--olive` | file | `--c-file` |

`--plum`, `--rose` and `--teal` are decorative accents only.
Never attach one to a node kind.
Folders were drawn in plum until 6 September 2026, which made the site's own legend disagree with every map the product generates.

The site's clay is `#b04e29` (light) / `#d97757` (dark).
The viewer's is `#bf5b36` / `#d97757`.
That divergence is intentional: the site's clay sits on more cream area and needs the extra depth.
Do not "unify" them without checking contrast on both.

### 2.3 Color rules

- Never introduce a raw hex in a component. Add a token, then use it.
- Every color must be defined on the base selector first. A color whose only definition lives inside a media query or a `[data-theme]` block is a bug.
- Body text against its surface holds at least 4.5:1. Dim text (`--text-dim` / `--muted`) is for secondary content only and still clears 4.5:1 at 12px and up.
- Hue is never the only signal. Anything colored by node type also carries its label and its position.

## 3. Typography

| Surface | Display | UI / body | Diagram labels | Mono |
| --- | --- | --- | --- | --- |
| Viewer | none | Outfit (`--font`) | Patrick Hand (`--font-hand`) | system mono (`--mono`) |
| Site | Fraunces (`--font-display`) | Outfit (`--font-sans`) | inherits sans | system mono (`--font-mono`) |

Both viewer fonts are inlined as base64 woff2 at render time, because the viewer must work from `file://` with no network.

Viewer type scale, as shipped:

- Body / base: `14px / 1.55`.
- Panel title: `18px / 700`.
- Tree row label: `13px`; module rows go `600`.
- Section heads, panel meta, dep rows: `12px`.
- Section eyebrows, counts, legend, path: `10.5px` to `11px`, uppercase eyebrows get `.07em` letter-spacing.
- Canvas node label: `14px / 600`; the focus node gets `15.5px / 700`.

Rules:

- Nothing under 10.5px ships.
- Uppercase is reserved for eyebrow labels, and always carries letter-spacing.
- Paths and code identifiers always use the mono token.
- One weight jump is enough to build hierarchy. Do not stack size, weight, and color changes on the same step unless the step is a real level change.

## 4. Shape, Spacing, Elevation

Radii, as shipped:

- `6px` mini buttons and tree affordances.
- `8px` to `9px` toolbar buttons, chips, breadcrumb.
- `14px` detail panel.
- `999px` pills: hint toast, legend, tags.

Spacing uses a 4px base.
Common steps are 4, 6, 8, 10, 12, 16, 20, 22.

Borders are 1px hairlines at `--line`, moving to `--line-strong` on hover.
Containment frames on the canvas use a 1.2px dashed `--line-strong`.

Elevation is a single token, `--shadow`.
Anything floating over the canvas (panel, breadcrumb, legend, tooltip, hint) gets exactly that shadow and a `--line` hairline.
There is no second elevation level.

Control sizing in the viewer header:

- Button height `36px`, radius `9px`, padding `0 12px`.
- Icon-only button `36 x 36`.
- Icons are matched by ink mass, not by box size: label buttons `17px`, icon-only `19px`, and `#fit` `22px` at `stroke-width: 3.6` because its glyph is sparse.

## 5. Motion

Motion is short, functional, and used to explain a state change.

- Interface state (hover, tree twist, panel open): `120ms` to `200ms`, `ease`.
- Theme flip: `340ms`. Color transitions are switched on only for the moment around the flip via the `.theming` class, so ordinary hovers and re-renders stay instant.
- Theme icon swap: `420ms` on `cubic-bezier(.34, 1.3, .5, 1)`. The sun and moon share one slot and arc past each other, so the switch reads as a state change instead of an icon blinking out.
- Import flow pulse: `1.35s` linear, infinite, `stroke-dasharray: 2 12`.

Every animation must have a `prefers-reduced-motion: reduce` escape, and the viewer already gates the theme swap, the color transition, the canvas fade, and the flow pulse.
Nothing may animate layout size on a per-frame basis; the canvas repositions in one step.

## 6. Theming Contract

- The viewer defaults to dark; the site defaults to light. Both persist an explicit choice as `data-theme` on the root element.
- The site sets `data-theme` from an inline `<head>` script before first paint, so there is no flash.
- Dark and light must be defined in full. Redefine tokens only; never redefine a component rule per theme.
- The site keeps the dark palette in two selectors (media query and attribute) that must stay in sync. Change both or neither.

## 7. Accessibility Floor

- Contrast: 4.5:1 for text, 3:1 for meaningful borders and icons.
- Every icon-only control carries a `title` and an accessible name.
- Focus must remain visible. Do not remove outlines without replacing them.
- Hit targets on the canvas chrome stay at 32px or larger; the header controls are 36px.
- Color-coded content always carries a text label as well.

## 8. Density And Emptiness

A view that looks empty is a layout bug, not a content gap.
The fix is always to tighten the layout, never to pad it out with invented content or a bigger background box.

Concrete rules:

- Pack a set of boxes by their real widths with a constant gap between edges. Never place variable-width boxes on a column pitch sized for the widest one; that punches dead space around every short label.
- Balance grid rows. Eight items read as 4 + 4, never 3 + 3 + 2.
- Frames size themselves from the bounding box of their members, plus one padding constant. A frame never has a fixed size of its own.
- Give a dense listing a tighter row rhythm than a diagram lane. Lanes need room for edge labels; a folder listing does not.

The viewer's concrete numbers for these live in `plugins/birdseye/DESIGN_VIEWER.md`.

## 9. Change Checklist

Before finishing any visual change:

1. Both themes checked, including the toggle path and the system-preference path.
2. Tokens used, no raw hex added.
3. Responsive tiers checked for the surface you touched.
4. Reduced-motion path checked for any new animation.
5. Contrast checked on new color pairings.
6. This file updated if a rule changed.
