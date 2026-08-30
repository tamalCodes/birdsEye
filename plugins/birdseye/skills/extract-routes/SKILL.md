---
name: extract-routes
description: Extract a repo's route/screen tree and navigation edges into birdseye/.cache/routes.json. Use when building or refreshing a birdsEye map, or when asked what screens an app has and how they connect. Handles file-based routers and config-based routers in any framework.
---

# Extract routes

You are the only part of `birdsEye` that is allowed to use judgement. Everything
mechanical is already done by scripts. Your job is the one thing a script cannot
do without growing a per-framework adapter for every router that will ever
exist: look at this repo's router and describe it.

Write `birdseye/.cache/routes.json` and nothing else. Never modify the user's
source tree.

## Non-negotiables

- **A missing edge is fine. A wrong edge is not.** Everything downstream is
  trusted because it is exact. Emit only what you can see written down. If a
  navigation target is computed, conditional, or comes from a variable, skip it.
- **Read at most 25 files.** If the router is bigger than that, emit what you
  found and set `"partial": true`. Do not traverse the whole app.
- **Never guess a screen file.** `screenFile` must be a path you resolved, not
  one you inferred from a name.
- **Emit `[]` rather than something plausible.** A backend or a library has no
  routes. That is a correct answer, and the map degrades gracefully around it.

## Step 1 - decide which kind of router this is

Check for a file-based router first, because if there is one you barely have to
read anything at all.

```bash
ls -d app pages src/app src/pages src/routes routes 2>/dev/null
```

If one of those exists, look for the naming convention inside it:

| Convention seen | Router style |
|---|---|
| `page.tsx` / `page.js` / `layout.tsx` | nested, directory = path segment |
| `+page.svelte` / `+layout.svelte` | nested, directory = path segment |
| `index.tsx` alongside sibling files | flat, filename = path segment |
| `route.ts` / `+server.ts` / `handler.ts` | API route, still a route node |
| `[id]` / `[...slug]` / `:id` / `$id` in a name | dynamic segment |
| `(group)` / `_layout` / `+layout` | organisational only - contributes **no** path segment |

If that matches, **the route tree is the directory tree**. Derive it from
`find`/`ls` output. Read a file only to confirm the convention once. Skip to
step 3.

Two things that trip up a naive directory walk:

- A parenthesised directory is a route group. `app/(protected)/settings/page.tsx`
  is `/settings`, not `/(protected)/settings`.
- The router root may not be the top of the tree, and a directory can share its
  name. In `app/app/page.tsx` the outer `app/` is the router root and the inner
  one is a real `/app` segment.

## Step 2 - otherwise, find the config-based router entrypoints

Grep for router construction. This list is a starting point, not a closed set -
if the repo uses something not named here, the shape will still be "a call that
takes a list of route objects or a tree of screen components".

```bash
grep -rlE "createBrowserRouter|createRouter|createHashRouter|<Routes>|<Switch>|useRoutes\(" --include=*.ts --include=*.tsx --include=*.js --include=*.jsx src app 2>/dev/null
grep -rlE "createStackNavigator|createNativeStackNavigator|createBottomTabNavigator|createDrawerNavigator|createMaterialTopTabNavigator" --include=*.tsx --include=*.ts src 2>/dev/null
grep -rlE "RouterModule\.forRoot|RouterModule\.forChild|provideRouter\(" --include=*.ts src 2>/dev/null
grep -rlE "app\.(get|post|use)\(|router\.(get|post|put|delete)\(|@Controller|@(Get|Post|Put|Delete)\(|APIRouter\(|@app\.route" -r . 2>/dev/null | head -30
```

Read **only** the files those greps hit, plus files they directly reference by
import - one hop, not a full traversal. A navigator that renders child
navigators counts as one hop each; that is how a nested tree is normally spread
across a few files, and it is what your 25-file budget is for.

Common shapes to recognise:

- A **navigator component** whose children are `<Screen name="X" component={Y} />`
  entries. `name` is the route id, `Y` is the screen file, and the navigator's
  own factory tells you `navigatorType`.
- A **route object array**: `{ path, element/component, children }`. Nested
  `children` become child routes; concatenate parent `path` segments.
- A **controller/decorator** style backend: the class prefix plus the method
  path is the full route.

## Step 3 - resolve each screen to a real file

For every route that names a component or handler, resolve the import that
brings it in, exactly as the code would:

- Follow the `import` statement for that symbol.
- Respect `tsconfig.json` `paths` aliases and `baseUrl`.
- A barrel (`index.ts`) re-export is one more hop - follow it to the real file.
- A lazy import (`React.lazy(() => import('...'))`) names the file directly.

Record `screenFile` as a **repo-relative POSIX path**. If you cannot resolve it,
leave `screenFile` as `null`. Do not invent one.

## Step 4 - navigation edges, literals only

Navigation calls live in screen files, not in the router - but you do not have
to *read* those files to find them, and reading them would blow the budget.
Grep for literal targets instead. Grep output is not a file read.

```bash
grep -rnoE "navigate\(\s*['\"][A-Za-z][A-Za-z0-9_]*['\"]" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' src
grep -rnoE "(push|replace|redirect)\(\s*['\"]/[A-Za-z0-9/_-]*['\"]" --include='*.ts' --include='*.tsx' src
grep -rnoE "(to|href)=\"/[A-Za-z0-9/_-]*\"" --include='*.tsx' --include='*.jsx' src
```

Attribute each hit to a route: the **file containing the call** is the `from`
route, via the `screenFile` map you built in step 3. A hit in a file that is not
any route's `screenFile` has no `from` - drop it rather than guessing which
screen it belongs to.

Emit an edge **only** when the target is a string literal that matches a route
you have already emitted. A literal that matches nothing is usually a
commented-out or deleted screen - dropping it is the correct outcome, and it is
worth one line in your report. Skip:

- `navigate(nextScreen)` - variable
- `router.push(`/fund/${id}`)` - template with interpolation (the *route* may
  still exist as a node with a dynamic segment; the *edge* is still fine to emit
  if the literal prefix identifies exactly one route, otherwise skip)
- anything behind a ternary or a lookup table

If you find that almost no target is a literal, that is a real finding: emit the
route nodes anyway. The tree plus `renders` edges is still useful, and a Routes
view with no cross-links beats one with invented ones.

## Step 4.5 - step-orchestrated flows (only when written down)

Some flows never touch the router: one registered screen renders a sequence of
page components itself, driven by step state - an onboarding wizard, a
checkout, a KYC form. To the navigator that whole flow is one screen, and
stopping there hides exactly the screens a reader most wants to see.

Surface these under the same evidence rules as everything else. Do not go
hunting for orchestrators by name - the trigger is a grep over the screen
files you already emitted:

```bash
grep -lE "component:\s*<?[A-Z][A-Za-z0-9_]*|case\s+[A-Za-z0-9_.]+:\s*(return\s*)?<[A-Z]" <the screenFiles you emitted>
```

For each hit, read that screen file (plus at most one hop for a step-config
file it imports). Each read counts against the 25-file budget; if the budget
is spent, skip this step entirely - it is optional, and a partial tree is
still correct. Then:

- The steps must be **statically written down**: an array or object literal of
  step entries naming components (`{ component: BankDetails }`), a `switch`
  over a step enum returning JSX, or an ordered run of `<StepX />` elements.
  Components picked through a computed lookup, a ternary chain over server
  state, or a dynamic registry do not qualify - skip them.
- Emit each step component as its own entry: `"type": "screen"`, `parent` set
  to the orchestrating screen's id, `screenFile` resolved exactly as in
  step 3, `navigatorType: "flow"`. Use the component name as the `id`,
  prefixed with the parent id on collision.
- If, and only if, the steps are declared as one ordered array literal, also
  emit `edges` between consecutive steps - that order is written down, so it
  is not a guess. A `switch` or an object map has no written order: emit the
  nodes and no edges.

## Step 5 - write the file

```jsonc
{
  "partial": false,          // true if you hit the 25-file budget
  "style": "config",         // "file" | "config" | "none"
  "filesRead": 11,
  "sourceFiles": [                  // every file you actually read, repo-relative.
    "src/app/routes/RootNavigator.tsx",   // The cache watches these and their
    "src/app/routes/stacks/AuthStack.tsx" // sibling files to decide whether this
  ],                                      // stage needs to run again at all.
  "routes": [
    {
      "id": "DashboardStack",          // unique, stable, no spaces
      "name": "Dashboard",             // human label for the node
      "type": "route",                 // "route" (a navigator/path) | "screen" (a leaf)
      "path": "/dashboard",            // URL path, or null for config routers with no URLs
      "screenFile": "src/features/dashboard/pages/DashboardHomeScreen.tsx",
      "parent": "RootNavigator",       // parent route id, or null
      "navigatorType": "bottom-tab",   // stack | bottom-tab | drawer | top-tab | modal | flow | file | api | null
      "module": "dashboard",           // owning module slug if obvious, else null
      "summary": "Home tab, portfolio hero and quick actions."  // <=120 chars, or null
    }
  ],
  "edges": [
    { "from": "DashboardHome", "to": "FundDetails" }   // literal navigations only
  ]
}
```

Rules for the file itself:

- `sourceFiles` is not optional. Without it this stage can never be cached, and
  it will re-run on every single map refresh.
- Sort `routes` by `id`, `edges` by `from` then `to`, and `sourceFiles` alphabetically. The output must be
  byte-identical across runs on unchanged input.
- Every `parent` and every edge endpoint must be an `id` that exists in `routes`.
- Repo-relative POSIX paths only. No absolute paths, no backslashes.
- No timestamps, no counts that could drift.

Create the directory if needed, then write it:

```bash
mkdir -p birdseye/.cache
```

## Step 6 - report

Reply with one line: the router style you found, the number of routes, the
number of navigation edges, and how many files you read. If you emitted nothing,
say why in one clause - "no router found, this looks like a service with no UI"
is a complete and useful answer.
