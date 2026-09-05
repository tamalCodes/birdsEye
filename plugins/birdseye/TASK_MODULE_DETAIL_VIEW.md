# Task: Module detail view for the birdsEye viewer

## Goal

Add one centralized place in the viewer where clicking a module tells the whole story in plain language, readable by a non-technical person.
Today that story is scattered across the Overview side panel, the Focus view, the Routes view, and the Docs view.

When a module is selected, the user should see, without hopping between tabs:

- Every file in the module, grouped by folder (the segregation that already exists on disk).
- The screens the module owns, including step-flow screens, with their flow order.
- The specs and docs that document the module, with their guardrails and how many of them still point at files that have been removed.
- What would break if you touched it: which modules depend on this one (fan-in), which it depends on (fan-out), and the heaviest individual files by fan-in.
- Plain-language framing. "12 other modules use code from here. The riskiest file to touch is X, used by N files." Not just raw numbers.

## Where the code lives

- Viewer template: `plugins/birdseye/scripts/template/index.html`. One self-contained file: CSS, then markup, then a single script. No build step, no framework, no network access at open time. Cytoscape is inlined at render time via `__VENDOR__`.
- The graph is inlined as `__GRAPH__` and available as the `GRAPH` global.
- Rendering: `plugins/birdseye/scripts/render.mjs` replaces the placeholders. It needs no changes unless a new placeholder is added.
- To test against real data, rebuild the map in `/Users/tamalcodes/Gh/perccent-app`:
  `node plugins/birdseye/scripts/merge.mjs /Users/tamalcodes/Gh/perccent-app && node plugins/birdseye/scripts/render.mjs /Users/tamalcodes/Gh/perccent-app`
  then open `/Users/tamalcodes/Gh/perccent-app/birdseye/index.html`.
  Do not open browser tabs to verify unless the user asks; the user checks visually themselves.

## Data already available in graph.json

All of this exists; no extraction changes are needed.

- Node types: `module`, `file`, `screen`, `route`, `doc`.
- `module` nodes: `meta.fileCount`, `meta.codeFileCount`, `meta.fanIn`, `meta.fanOut`, `path`.
- `file` nodes: `path`, `module`, `meta.fanIn`, `meta.fanOut`.
- `screen` nodes: `path` (the screenFile), `module`, `meta.navigatorType` (`flow` marks orchestrator step screens), `meta.parent`.
- `doc` nodes: `module`, `meta.docKind`, `meta.guardrails[]`, `meta.stale`, `meta.refs`.
  `meta.refs` holds the verified verdict on every path the doc names but does not resolve, split three ways: `deleted[]` (`{path, wrote, sha, date}` - git removed it, so the doc is genuinely out of date), `unknown[]` (never in this repo) and `external[]` (outside it). `meta.stale` is true only when `deleted` is non-empty.
- Edges: `imports` (file to file and module to module, weighted), `navigates` (with `hierarchy: true` for tree edges), `renders` (screen to file), `documents` (doc to file or module), `links` (doc to doc).
- The template script already builds useful indexes near the top: `nodeById`, `incoming`, `outgoing`, `moduleFiles` (slug to file nodes).

## Existing viewer structure to hook into

- The side panel is `#panel`; `openPanel(id)` builds its HTML per node type; `select(id, jump)` drives selection.
- The module case of `openPanel` is the natural upgrade point. Options: grow the panel into a full-height detail drawer, or add a dedicated view. Prefer upgrading the panel first; a fifth top tab is a bigger step and may not be needed.
- Panel helpers already exist: `nodeLink(n)` (clickable node buttons via `data-goto`), `listSection(title, items)`, `related(id, type, dir)`.
- Style tokens are CSS variables at the top of the file. Keep the existing look.

## Interaction contract

- Choosing a module, folder, or file changes only the focused map. It must not open Details unless the reader explicitly asks for it.
- Choosing a dependency from the focused map or Details must keep the current module and canvas in place.
  Details should explain the relationship: which module imports from which, the exact file links that create it, and a plain-language summary.
- Example: with `Visualize` focused, choosing `Hooks` explains the files `Visualize` imports from `Hooks`; it does not focus `Hooks`.
- Details may offer an explicit `View <module> details` button for readers who want to leave the current story and focus that dependency.
- A relationship click is not a shortcut to the dependency's page.
- Relationship content uses readable names such as `visualization composer` and `integrate public API`, never file extensions or raw folder paths. Use a folder heading only when three or more displayed links share it.
- Details floats at content height. It becomes scrollable only after reaching a sensible viewport-bound maximum height.

## Constraints and taste

- Keep it lightweight and dependency-free. This project's whole identity is "a couple of prompts and small scripts, no software around it".
- Deterministic output. Same graph in, same DOM out. No timestamps, no randomness.
- Plain language for a non-technical reader is a hard requirement, not a nice-to-have. Numbers get a sentence of meaning next to them.
- Folder grouping should come from file paths relative to the module root, collapsed sensibly (top one or two levels, with counts), not a raw 159-item flat list.
- The focused map remains stable while someone explores a dependency relationship. Only explicit view-details actions may move focus to another module.
- Match the existing code style in the template: plain ES5-ish functions, comments only for non-obvious "why".

## Recent context (already shipped)

- Selecting from far out now zooms into the neighborhood and keeps its labels visible (fix in `applyDim`, `updateLabels`, `select`).
- The extract-routes skill now emits step-orchestrated flow screens (`navigatorType: "flow"`, parent = orchestrating screen) when steps are statically written down. perccent-app's onboarding flow (Demographic, Financial, Permanent Address, Bank Details, Nominee) is in its graph.json under `screen:Onboarding`.
