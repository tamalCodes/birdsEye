---
name: extract-flowcharts
description: Turn each module's docs into a plain-language step-by-step flow a non-technical reader can follow, into birdseye/.cache/flowcharts.json. Use when building or refreshing a birdsEye map, after extract-docs has already run.
---

# Extract flowcharts

This is what the Docs view is *for*. A reader who opens a feature's docs page
should not have to piece a flow together from prose - they should see it. This
skill reads what `extract-docs` already found and turns it into a small
step-by-step diagram: the same job you would do by hand if a user asked you to
read a module's docs and explain how it actually works.

Write `birdseye/.cache/flowcharts.json` and nothing else. Never modify the
user's source tree, and never write documentation into it.

## Non-negotiables

- **Ground every step in what the docs say.** If a doc does not describe it,
  it does not go in the flow. This is the same rule `extract-docs` follows for
  edges: a missing flowchart is fine, a wrong one is not.
- **A module with nothing to say gets no flowchart.** Reference tables,
  guardrail-only files, and one-line READMEs do not describe a flow. Skip
  them - do not invent steps to fill the gap.
- **Plain language.** Write every `label` and `detail` for someone who has
  never opened this codebase and does not know what a "slice" or a "screen
  navigator" is. Say what the user does and what happens, not what the code
  does.
- **Small.** 3 to 12 steps. A flow longer than that is usually two flows -
  pick the primary one, or split by the natural break the docs already draw
  (main flow now, edge cases later - skip the edge cases here).

## Step 0 - what to run this on

Read `birdseye/.cache/docs.json`. Group its `docs` entries by `module`,
dropping any with `module: null` - a repo-wide doc does not describe one
feature's flow. Each module with at least one doc is a candidate; you decide
per-candidate whether it earns a flowchart in step 2.

```bash
node -e "
const d = require('./birdseye/.cache/docs.json');
const byMod = {};
for (const doc of d.docs) { if (doc.module) (byMod[doc.module] ||= []).push(doc.path); }
console.log(JSON.stringify(byMod, null, 2));
"
```

## Step 1 - read the docs for each module

Read every doc listed for that module in full. A `SPEC` or `MAP` doc is where
a flow usually lives; a `REFERENCE` or `AGENTS` doc rarely describes one on
its own but can supply a detail a `SPEC` doc leaves implicit (an `AGENTS` file
saying "KYC must complete before a SIP starts" is exactly the kind of thing
that turns into a decision step).

Only open a source file the docs reference when a doc's own wording leaves a
step's shape ambiguous - a screen name that could be one step or three, say.
This is a documentation-driven pass, not a code-reading one; do not go
spelunking through the module's implementation to build the flow yourself.

## Step 2 - decide if there is a flow

Ask one question: *does this module's documentation describe something a user
does, in order, from a start to an outcome?* An onboarding sequence, a
purchase flow, a settings toggle with a confirm step - yes. A components
inventory, a list of hooks, a "do not do X" rules file - no.

When the answer is no, add the module to `skipped` with a short reason and
move on. Do not force a flow onto reference material.

## Step 3 - write the steps

- `id`: kebab-case, unique within this flow, descriptive (`pick-amount`, not
  `step2`).
- `kind`: one of `start`, `step`, `decision`, `end`.
  - Exactly one `start` - the first thing the user does.
  - `decision` only when the docs explicitly describe a branch or condition
    ("if KYC is not complete...", "when the balance is below..."). Do not
    invent a decision to make the diagram more interesting.
  - `end` is optional - use it when the docs describe a clear outcome state.
    Skip it for flows that just continue (a settings toggle has no "end").
- `label`: at most 40 characters. What the user does or sees, not the
  component name (`Picks amount and frequency`, not `AmountSelector.tsx`).
- `detail`: at most 200 characters, one or two plain sentences. Can be an
  empty string if the label already says everything worth saying - do not pad
  it with filler.

## Step 4 - write the edges

One edge per transition the docs describe. `from` and `to` are step ids in
the same flow.

- A `decision` step normally has two or more outgoing edges. Label each with
  what makes the reader take that branch (`"KYC done"`, `"KYC not done"`), at
  most 20 characters. Every other edge's `label` is `null`.
- Every step should be reachable from the `start` step. A step nothing points
  to, or that points nowhere, is a sign it does not belong in this flow -
  cut it rather than leaving it dangling.

## Step 5 - write the file

```jsonc
{
  "flowcharts": [
    {
      "module": "mySip",
      "title": "How MySIP works",
      "summary": "A user picks an amount and frequency, completes KYC if needed, and confirms to start a recurring investment.",
      "steps": [
        { "id": "start", "kind": "start", "label": "Opens MySIP", "detail": "From the dashboard or a fund page." },
        { "id": "pick-amount", "kind": "step", "label": "Picks amount and frequency", "detail": "Monthly, weekly, or daily, from a fixed set of amounts." },
        { "id": "kyc-check", "kind": "decision", "label": "Is KYC already done?", "detail": "" },
        { "id": "do-kyc", "kind": "step", "label": "Completes KYC", "detail": "A short verification flow before any SIP can start." },
        { "id": "confirm", "kind": "step", "label": "Confirms and pays", "detail": "Sets up the first payment and the recurring mandate." },
        { "id": "active", "kind": "end", "label": "SIP is active", "detail": "Runs automatically until the user pauses or cancels it." }
      ],
      "edges": [
        { "from": "start", "to": "pick-amount", "label": null },
        { "from": "pick-amount", "to": "kyc-check", "label": null },
        { "from": "kyc-check", "to": "do-kyc", "label": "KYC not done" },
        { "from": "kyc-check", "to": "confirm", "label": "KYC done" },
        { "from": "do-kyc", "to": "confirm", "label": null },
        { "from": "confirm", "to": "active", "label": null }
      ],
      "sources": ["src/features/mySip/AGENTS.md", "src/features/mySip/specs/FLOW_START.md"]
    }
  ],
  "skipped": [
    { "module": "utils", "reason": "docs are a helper-function reference, no described flow" }
  ]
}
```

Rules for the file itself:

- `sources` lists only the doc paths you actually used to build that flow -
  repo-relative POSIX paths, sorted.
- Sort `flowcharts` by `module`, sort `skipped` by `module`.
- No timestamps.

```bash
mkdir -p birdseye/.cache
```

## Step 6 - report

One line: how many flowcharts you built, how many modules you looked at and
skipped, and why the skipped ones were skipped (group similar reasons, do not
list all of them individually if there are many).
