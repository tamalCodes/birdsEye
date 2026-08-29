---
name: extract-docs
description: Find the spec and doc files an agent should read before touching a module, attach them to the code they describe, and extract guardrails, into codemap/.cache/docs.json. Use when building or refreshing a codemap, or when asked which docs cover a given part of a repo.
---

# Extract docs

This is the half of `codemap` that answers the question the whole tool exists
for: *"I need to fix a bug in the auth module - which spec files should I read
first?"* The import graph says what auth is wired to. You say what has been
written down about it.

Write `codemap/.cache/docs.json` and nothing else. Never modify the user's
source tree, and never write documentation into it.

## Non-negotiables

- **Only attach a doc to code you verified exists on disk.** A `documents` edge
  to a path that is not there is worse than no edge.
- **Location is a hint, not the answer.** A doc sitting at the repo root can
  still be about one module. Its title and first paragraph will usually say so.
  This judgement is the reason a script is not doing this job.
- **Guardrails are quoted, not summarised.** Copy the bullet. Do not paraphrase
  it into something the author did not write.
- **One README and nothing else is a valid result.** Emit it and stop.

## Step 1 - find the docs

Use the `docGlobs` list from `codemap.config.json` if it is there; otherwise
these defaults:

```
**/MAP.md   **/AGENTS.md   **/CLAUDE.md   **/specs/*.md   **/reference/*.md
docs/**/*.md   **/README.md
```

Respect `.gitignore` and skip `node_modules`, `dist`, `build`, `.next`, `ios`,
`android`, `vendor` and the `codemap/` output directory itself.

```bash
find . -name '*.md' -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path './codemap/*' | head -200
```

Read each match. Large docs: the title, the first paragraph, every heading, and
every backticked path are what you need - you do not have to hold the prose.

## Step 2 - classify

`kind` is one of:

| kind | what it means |
|---|---|
| `MAP` | an orientation doc - what lives where, how a slice fits together |
| `AGENTS` | instructions aimed at an AI agent working in this repo |
| `SPEC` | a described behaviour or flow, usually under `specs/` |
| `REFERENCE` | lookup material - tables, inventories, API shapes |
| `OTHER` | anything else, including most READMEs |

Judge by content, not filename, when the two disagree.

## Step 3 - assign an owning module

The modules are already computed. Read them from `codemap/.cache/imports.json`:

```bash
node -e "console.log(require('./codemap/.cache/imports.json').modules.map(m=>m.slug+' -> '+m.path).join('\n'))"
```

- A doc inside a module directory belongs to that module. Nearest ancestor wins.
- A doc at the repo root belongs to `null` **unless** its title and opening
  paragraph clearly scope it to one module - then attach it to that module and
  say so through a `documents` edge as well.
- A doc under a shared `docs/` tree gets whichever module it is about, or `null`
  if it is about the repo as a whole. When a `docs/` tree is large, do not agonise
  over each file: build the `documents` edges first (step 4), then take the module
  that owns the most edge targets. A doc that names ten files in `mySip` is about
  `mySip`, whatever its title says. Fall back to `null`, never to a guess.

## Step 4 - `documents` edges

Every backtick-quoted path in the doc that **resolves to a real file or
directory** becomes a `documents` edge to that path.

**Try four bases for every candidate**, in this order, first hit wins:

1. relative to the directory the doc is in - `reference/DEAD_CODE.md` inside
   `src/features/portfolio/MAP.md` means
   `src/features/portfolio/reference/DEAD_CODE.md`
2. **relative to the owning module's root** - a feature doc is written from the
   module down, so `components/BasketCard.tsx` and `specs/FLOW_CANCEL.md` inside
   `src/features/portfolio/specs/FLOW_GOALS_AND_BASKETS.md` mean
   `src/features/portfolio/components/BasketCard.tsx` and
   `src/features/portfolio/specs/FLOW_CANCEL.md`. This is the base most often
   skipped, and skipping it turns a doc that is perfectly current into a doc
   covered in false warnings.
3. relative to the repo root - `src/app/routes/tabs/BaseBottomTab.tsx`
4. as a **unique path suffix** anywhere in the repo - `PortfolioCard.tsx` or
   `components/index.ts` written as shorthand. Take it only if exactly one file
   in the repo ends with it; if two or more do, it is ambiguous, so resolve to
   nothing. Retry the suffix with each source extension appended, so
   `app/store/slices/portfolioSlice` finds `...portfolioSlice.ts`.

Docs mix all four freely, often in one sentence. Checking only the first is the
single largest source of missing edges.

```bash
ls -d "$DOCDIR/$candidate" 2>/dev/null \
  || ls -d "$MODULE_ROOT/$candidate" 2>/dev/null \
  || ls -d "$candidate" 2>/dev/null
```

- Resolves to a directory that is a module root - emit the module path;
  `merge.mjs` maps it to the module node.
- Resolves to **another doc you are emitting** - that is a `links` edge, not a
  `documents` edge. Docs reference their sibling specs in tables and prose far
  more often than they use markdown link syntax, and those references are the
  point of the whole Docs view.
- Resolves to any other file - emit the repo-relative file path as `documents`.
- Not a path at all - ignore it, and **do not** count it as stale. Reject a
  candidate before you ever test it if it:
  - starts with `@`, `#`, `$`, or `-` (import aliases like `@portfolio/enums`,
    flags like `--force`, anchors)
  - contains a space (`npm run build`, `git status`), a `*`, or a `://`
  - is a bare identifier with no `/` and no file extension (`useState`,
    `RootState`)

### What goes in `stalePaths`

`stalePaths` is a list of **candidates, not a verdict**. Put a path there when
the author plainly wrote a path and you could not place it. All of these must
hold:

- it resolved under none of the four bases, **and**
- it has at least two segments - this rules out bare identifiers, **and**
- it either carries a source extension (`src/store/slices/oldSlice.ts`) or ends
  in `/` (`src/features/liquidGlass/`).

Everything else is prose. `react-native/no-inline-styles` is a lint rule, not a
file.

Do not agonise over the list and do not try to work out whether a file used to
exist - you cannot see the history, and guessing at it is how a map stops being
believed. `merge.mjs` re-checks every entry against the working tree and against
`git log`, and sorts them into three groups the viewer shows separately:

| what merge.mjs finds | what happens |
|---|---|
| the path resolves after all | dropped, and turned into a real edge |
| git has a commit that removed it | shown as removed, with the commit and date |
| never in the repo, or outside it | listed, but not called rot |

So a candidate you were unsure about costs nothing, and one you left out is an
edge and a warning nobody gets.

## Step 5 - `links` edges

Two sources feed the same set:

1. any backticked path from step 4 that resolved to another doc
2. relative markdown links (`[text](./specs/FLOW_X.md)`), resolved against the
   directory of the doc containing them

Keep the edge only if the target is another doc you are emitting. Drop external
URLs, anchors and mailto links. Drop self-links.

## Step 6 - guardrails

Collect bullet items that sit under a heading matching, case-insensitively:

```
non-negotiable | scope fence | invariant | constraint | never | do not | must not | rules
```

- At most **10 per doc**, at most **200 characters** each - truncate with `...`.
- Copy the bullet text verbatim, minus the leading marker and any markdown
  emphasis. Keep inline code as plain text.
- If a doc has no such heading, emit an empty array. Do not go hunting for
  sentences that sound like rules.

## Step 7 - write the file

```jsonc
{
  "docs": [
    {
      "path": "src/features/portfolio/MAP.md",
      "kind": "MAP",
      "module": "portfolio",
      "summary": "Portfolio slice: hero, allocation, goal and basket drill-ins.",
      "documents": [
        "src/features/portfolio",
        "src/features/portfolio/pages/PortfolioScreen.tsx"
      ],
      "links": [
        "src/features/portfolio/specs/FLOW_HOLDINGS.md",
        "src/features/portfolio/reference/DEAD_CODE.md"
      ],
      "guardrails": [
        "Never render the blue Portfolio Value hero - it is intentionally dead."
      ],
      "stalePaths": ["components/OldCard.tsx"]
    }
  ]
}
```

Rules for the file itself:

- `summary` is at most 120 characters, or `null`. One clause about what the doc
  covers - not a review of whether it is any good.
- Sort `docs` by `path`, and sort every array inside a doc. Byte-identical
  output on unchanged input.
- Repo-relative POSIX paths everywhere. `links` and `documents` targets must be
  paths, never doc titles.
- No timestamps.

```bash
mkdir -p codemap/.cache
```

## Step 8 - report

One line: how many docs, how many `documents` edges, how many modules ended up
with at least one doc attached, and how many unplaced paths you are handing on.
Do not describe those as stale - `merge.mjs` decides that, and it will report
how many survived the check.
