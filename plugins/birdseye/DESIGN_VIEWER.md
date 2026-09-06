# Map Viewer Design Spec

This file is the surface spec for the generated map viewer, `plugins/birdseye/scripts/template/index.html`.
It records what the viewer's layout is and why, so a future change does not quietly undo a decision that was already paid for.

Read `docs/DESIGN_SYSTEM.md` first for color, type, motion, and the shared rules.

## 1. Hard Constraints

The viewer is one self-contained HTML file.

- It must open from `file://` with no server and no network.
- Fonts and the Cytoscape bundle are inlined at render time. No runtime dependency may be added.
- The same input must produce the same output. Nothing in layout may use `Math.random()`; deterministic noise keyed off a node id is the only source of irregularity.
- Nodes, edges, and counts come from the AST pass. The viewer never invents a node or an edge to make a picture look fuller.

## 2. Anatomy

```
header (56px, 52px under 420px)
+-- nav toggle | brand | spacer | tools (fit, theme, ...)
main
+-- #sidebar   300px containment tree (260px under 1040px)
+-- #stage
    +-- #cy          Cytoscape canvas, dot grid at 26px
    +-- #flowLines   SVG overlay: import flow curves, arrows, pulses
    +-- .crumb       top-left breadcrumb
    +-- .legend      bottom-left, collapsed to a pill until hover
    +-- #panel       top-right detail sheet, 420px
    +-- .hint        bottom-centre transient toast
```

Cytoscape owns nodes and hit testing.
The SVG overlay only paints directed flow above a transparent canvas, so every curve and arrow stays in the same coordinate system through a pan or zoom.
Do not add a third drawing layer; two layers already have to be kept in step.

## 3. Canvas Geometry

All constants live together near the top of the canvas section of the template.

| Constant | Value | Meaning |
| --- | --- | --- |
| `COLX` | `500` | Horizontal distance from focus to a dependency lane |
| `ROWY` | `96` | Row pitch inside a dependency lane |
| `NODE_H` | `36` | Node height used for bounding-box math (drawn height is 34, focus 44) |
| `FRAME_PAD` | `34` | Padding between a frame's edge and its members' bounding box |
| `CHILD_CAP` | `40` | Maximum children drawn in the INSIDE frame |
| `CHILD_GAP` | `26` | Gap between adjacent children, edge to edge |
| `CHILD_ROWY` | `62` | Row pitch inside the INSIDE frame |
| `CHILD_PER_ROW` | `6` | Upper bound on children per row |
| `LABEL_CAP` | `260` | Widest a node box may get before its label ellipses |
| `LABEL_PAD` | `30` | Text width plus this equals box width |

Node boxes are measured against the text they actually carry, then clamped between a per-role minimum and `LABEL_CAP`.
A uniform box width was tried and rejected: it made the map unreadable on the large screens it usually opens on.

## 4. Neighbourhood Layout

One selection is drawn with its immediate neighbourhood, never the whole graph.

**Import flow reads left to right.**
Modules the selection imports sit in a `DEPENDS ON` lane at `-COLX`.
Modules that import the selection sit in a `USED BY` lane at `+COLX`.
Arrows always travel left to right, so a dense neighbourhood reads as a flow rather than a spider around a centre.
The graph direction stays factual; only its staging changes.

**Frames are backdrops, not compound parents.**
A frame is a plain rectangle sized from its members' bounding box.
That keeps a member drag a normal free drag with nothing auto-resizing around it, and lets the frame be dismissed once the user starts rearranging by hand.

**The INSIDE frame is a packed, balanced grid.**
Children sit below the focus, clear of the tallest dependency lane, so no in/out edge cuts through a child node.

The packing contract, which is the fix for the sparse-block problem:

1. Rows are balanced, not greedily filled. `perRow` starts at `min(CHILD_PER_ROW, ceil(sqrt(n * 1.6)))` and is then rounded down to the balanced value, so eight children read as 4 + 4 and never 3 + 3 + 2.
2. Inside a row, children are packed by their real measured widths with a constant `CHILD_GAP` between edges, and the row is centred as a whole. A column pitch sized for the widest label is forbidden here: one long name such as `AskEdi_Static_Charts/` would punch a hole of dead space either side of every short one.
3. Row pitch is `CHILD_ROWY`, tighter than `ROWY`, because a folder listing carries no edge labels.
4. Only a small vertical jitter is applied, at `CHILD_ROWY * 0.055`. It is enough to look hand-set and small enough that the row still reads as a row. Horizontal jitter is deliberately absent, since variable box widths already break the machine-ruled look.

If the INSIDE block ever looks sparse again, tighten `CHILD_GAP`, `CHILD_ROWY`, or `FRAME_PAD`.
Do not enlarge the frame, and do not pad it with placeholder children.

## 5. Labels

- A file label drops a known code extension so the label says what the thing is, not what it is written in. A name like `v1.2` keeps its tail.
- A child folder label keeps a trailing slash. That marks it as "a folder living in here" rather than the same-named sibling module.
- Diagram labels use the hand-lettered face; surrounding chrome stays in Outfit for dense prose.

## 6. Detail Panel

- 420px wide, top-right, `14px` radius, `--sheet` background, one `--shadow`.
- Section order is fixed and starts with what a reader wants first: what is inside, then what it touches. Blast radius comes after, not before.
- The open-file link sits against the title, not at the far edge of the header, because opening the file is the commonest action from this panel.
- A dependency row shows a name only. Repeating the folder path on every row turned the list into a wall of grey; the full path stays one hover away.
- A file's own imports stay folded in an accordion, since the canvas already draws them beside the node.
- Body scrolls at `max-height: min(54vh, 560px)` so the panel never buries the diagram it describes.

## 7. Responsive Tiers

Three progressive steps, in this order:

| Breakpoint | Change |
| --- | --- |
| `<= 1040px` | Sidebar narrows to 260px; breadcrumb width tightens |
| `<= 760px` | Header tightens; sidebar floats over the canvas as a drawer with a scrim; detail panel drops to a bottom sheet at `max-height: 68vh`; legend hides; hint moves under the header |
| `<= 420px` | Header shrinks to 52px; brand text hides, mark stays |

The rule behind the tiers: never squeeze the diagram to keep chrome in place.
Chrome floats or hides; the canvas keeps its area.

## 8. Do Not

- Do not reintroduce a physics or force layout. `fcose` was tried and rejected: it was laggy and produced blob-shaped clusters instead of a readable diagram.
- Do not draw the whole graph at once. The viewer is a per-node focus canvas plus a tree, on purpose.
- Do not add a second shadow level or a blur effect to chrome.
- Do not reassign node hues for aesthetic reasons; they encode type.
- Do not add a runtime fetch, CDN link, or external font URL.
- Do not use `Math.random()` anywhere in layout.

## 9. Verification

After changing the template:

1. Syntax-check the inline scripts, for example by extracting each `<script>` block and running `node --check` over it.
2. Regenerate a real map through the script sequence and open the generated `birdseye/index.html`, rather than building a standalone preview page.
3. Check both themes and all three responsive tiers.
