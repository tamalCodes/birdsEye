---
name: extract-structure
description: Work out a repo's folder taxonomy - where the code root is, which folders are product features and which are shared infrastructure, and which files boot the app - into birdseye/.cache/structure.json. Use first when building or refreshing a birdsEye map.
---

# Extract structure

> **Dormant as of the zero-token rewrite.** birdsEye's `/birdseye:map` no
> longer invokes this skill - the map is now a pure local AST parse (graphify)
> with no model calls. This file is kept for a future opt-in `--with-llm` mode.


Every other stage of birdsEye now goes through this one. The import graph, the
routes, the docs and the whole Overview flowchart are all organised around the
answer you give here: *what are this repo's modules, and which of them are
features versus general-purpose infrastructure?*

A script has already done the mechanical half - walked the tree, counted files,
matched folder names against a list of conventional infrastructure names, looked
for `pages/` directories. Your job is the half a script cannot do: look at the
handful of folders it was unsure about and decide, the way a person joining the
team would after ten minutes in the codebase.

Write `birdseye/.cache/structure.json` and nothing else. Never modify the user's
source tree.

## Non-negotiables

- **Never fail. Always write the file.** A weird layout is not an error. If you
  genuinely cannot tell, ask the user (step 4) - but you still finish with a
  written `structure.json`.
- **Only modules the scan found.** The scan lists every candidate folder. You
  may move a folder between `featureModules` and `sharedModules`, but you may
  not invent a module it did not list, and you may not split or merge folders.
- **A feature owns screens or a flow a user walks through.** A shared module is
  imported by the features and has no screens of its own: components, hooks,
  redux, styles, services, utils, types, config. When in doubt about a folder
  with real screens in it, it is a feature.
- **`codeRoot` and `entryPoints` come from the scan** unless it is obviously
  wrong. The scan detects `src/`, `app/`, monorepo `packages/*`, or the repo
  root. Only override with a concrete reason.

## Step 1 - read the scan

```bash
cat birdseye/.cache/structure.scan.json
```

The `map` command writes this right before invoking you. If it is somehow
missing, reconstruct the same picture yourself with `ls`/`find` over the repo -
the folders directly under the code root, their subdirectories, and their file
counts. Its shape:

- `codeRoots` - the detected code root(s), `""` meaning the repo root itself.
- `roots[].entryPoints` - files that boot the app, from `package.json`, an
  `index.html` script tag, or a conventional `main`/`index`/`App` name.
- `roots[].candidates[]` - one per folder directly under the code root, each with
  `codeFileCount`, `subdirs`, `hasPageDir`, `nameKind` (the infrastructure kind
  its name matches, or null), and a heuristic `guess` of `feature` | `shared` |
  `ambiguous` with a `confidence` and `reasons`.

## Step 2 - take the confident guesses as given

A candidate with `confidence >= 0.6` is almost always right:

- `hasPageDir: true` and a low `nameKind` -> **feature**. It owns screens.
- `nameKind` set (`components`, `hooks`, `state`, `styles`, ...) and no page
  directory -> **shared**.

Do not re-litigate these. Spend your attention on the rest.

## Step 3 - judge the ambiguous ones

For every candidate that is `ambiguous`, or `feature`/`shared` with
`confidence < 0.6`, or where your read of the name disagrees with the guess:

1. Read the folder's own `README.md` / `AGENTS.md` if it has one - one sentence
   usually settles it.
2. `ls` its top level and its `pages/`-equivalent if any. A folder full of
   `*.screen.tsx` or route components is a feature. A folder of `use*.ts` or
   `*.util.ts` is shared.
3. Check who imports it, if `birdseye/.cache/imports.json` already exists: a
   folder that many feature folders import from and that imports little itself
   is shared, whatever its name.

Common real cases:

- `pages/` or `screens/` as a **top-level** folder (not inside a feature): it
  holds real routed screens, so it is a **feature** in its own right, even
  though the name looks generic. The scan flags this with
  `"N routed screen file(s) live here"`.
- `app/` holding both an entry point and feature subfolders: it is the code
  root, not a module - the scan should already have said so.
- A `lib/` or `core/` that turns out to contain a whole feature: move it to
  `featureModules` and note why in `notes`.

Backend layouts (Go, .NET, Rust, Python) - a "feature" is a bounded slice of the
domain (orders, billing, auth) that owns its handlers and logic; a shared module
is cross-cutting plumbing:

- **Go**: the code root is usually the repo root. `cmd/` holds entry points (one
  `main.go` per binary). `internal/` and `pkg/` are containers - their
  *children* are the modules. A child like `internal/orders/` is a feature;
  `internal/db/`, `internal/config/`, `pkg/log/` are shared.
- **.NET**: often one project (folder with a `.csproj`) per module. `*.Api` /
  `*.Web` (holds `Program.cs`) is the entry; `*.Domain`, `*.Infrastructure`,
  `*.Application` are shared unless one clearly owns a feature slice. A
  `Features/` or `Modules/` folder splits by feature.
- **Rust**: the code root is the crate's `src/`. Top-level modules
  (`src/<name>.rs` or `src/<name>/`) are the units. `handlers/`, `routes/`,
  `domain/` split roughly into feature vs shared the same way.
- **Python**: the code root is the top package dir (often under `src/`).
  Sub-packages are the modules; `models/`, `db/`, `utils/`, `core/` are shared,
  domain packages (`orders/`, `catalog/`) are features.

## Step 4 - ask the user only when it still will not resolve

If, after step 3, one or more folders could reasonably go either way, ask - once,
in a single message, framed so a non-technical maintainer can answer:

> birdsEye read your `src/` folder. These look like **features** (they have
> their own screens): `askEdi`, `integrate`, `transform`, `visualize`.
> These look like **shared building blocks**: `components`, `hooks`, `redux`,
> `styles`, `utils`, `services`.
> One folder I am unsure about: **`pages`** - it has 15 screen files but a
> generic name. Feature, or shared? (default: feature)

Wait for the answer. If the user does not answer or says "you decide", go with
your best guess and record it in `notes`. Never block the build on this.

## Step 5 - write the file

```jsonc
{
  "version": 1,
  "codeRoot": "src",
  "entryPoints": ["src/App.jsx", "src/main.jsx"],
  "featureModules": [
    { "slug": "askEdi", "path": "src/askEdi" },
    { "slug": "integrate", "path": "src/integrate" },
    { "slug": "pages", "path": "src/pages" },
    { "slug": "transform", "path": "src/transform" },
    { "slug": "visualize", "path": "src/visualize" }
  ],
  "sharedModules": [
    { "slug": "components", "path": "src/components", "kind": "components" },
    { "slug": "hooks", "path": "src/hooks", "kind": "hooks" },
    { "slug": "redux", "path": "src/redux", "kind": "state" },
    { "slug": "services", "path": "src/services", "kind": "services" },
    { "slug": "styles", "path": "src/styles", "kind": "styles" },
    { "slug": "utils", "path": "src/utils", "kind": "utils" }
  ],
  "notes": "pages/ kept as a feature: it holds the auth and org screens."
}
```

Rules for the file:

- `slug` is the folder's base name. Keep it exactly as on disk (`askEdi`, not
  `ask-edi`) - it is what the user sees on every node.
- `path` is repo-relative POSIX, and must be a directory that exists.
- `kind` on a shared module is the taxonomy tag from the scan's `nameKind`
  (`components`, `hooks`, `state`, `styles`, `services`, `utils`, `config`,
  `data`, `types`, `assets`, `i18n`, `handlers`, `models`, `middleware`, ...).
  Use `shared` if none fits.
- Every candidate from the scan goes in exactly one of the two lists.
- Sort both lists by `slug`. No timestamps.
- `notes` is optional, one or two sentences, only when you overrode a guess or
  the user made a call.

Before you finish, re-read the file you just wrote and confirm: `codeRoot` is a
string, every `path` is a directory that exists, every scan candidate appears in
exactly one list, and both lists are sorted by `slug`. The `map` command runs
`structure.mjs check` right after you return and will stop the build on a
malformed file, so get it right here.

## Step 6 - report

One line: the code root, how many feature modules and how many shared modules,
and anything the user decided or you overrode.
