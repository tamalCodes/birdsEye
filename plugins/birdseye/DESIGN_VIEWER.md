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
    +-- #overview    landing card, root view only
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
| `UNUSED_CAP` | `12` | Maximum chips drawn in the NEEDS A LOOK frame |
| `LANE_CLEAR` | `86` | Air between a dependency lane's frame bottom and the INSIDE frame |
| `BLOCK_GAP` | `104` | Air between the INSIDE frame and the NEEDS A LOOK frame |
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

Clearance is measured to the **bottom of the lane's frame**, not to its lowest node, and pays for the INSIDE frame's own top padding as well.
Measuring to the node was a real bug: a focus with nine dependencies and a wide child grid drew the two frames overlapping, because each one extends `FRAME_PAD` past the nodes it wraps and neither padding was accounted for.
`LANE_CLEAR` is the air on top of that.

The packing contract, which is the fix for the sparse-block problem:

1. Rows are balanced, not greedily filled. `perRow` starts at `min(CHILD_PER_ROW, ceil(sqrt(n * 1.6)))` and is then rounded down to the balanced value, so eight children read as 4 + 4 and never 3 + 3 + 2.
2. Inside a row, children are packed by their real measured widths with a constant `CHILD_GAP` between edges, and the row is centred as a whole. A column pitch sized for the widest label is forbidden here: one long name such as `AskEdi_Static_Charts/` would punch a hole of dead space either side of every short one.
3. Row pitch is `CHILD_ROWY`, tighter than `ROWY`, because a folder listing carries no edge labels.
4. Only a small vertical jitter is applied, at `CHILD_ROWY * 0.055`. It is enough to look hand-set and small enough that the row still reads as a row. Horizontal jitter is deliberately absent, since variable box widths already break the machine-ruled look.

If the INSIDE block ever looks sparse again, tighten `CHILD_GAP`, `CHILD_ROWY`, or `FRAME_PAD`.
Do not enlarge the frame, and do not pad it with placeholder children.

**The NEEDS A LOOK frame sits under INSIDE, when there is unused code.**
It answers the second question a reader has after "what is in here": what of it is dead weight.
It is also, deliberately, what stops the root view from being one box on an empty canvas - but it is real content, never filler.
If a repo has no unreachable code the frame is absent, and the empty view is the honest answer.

Its contract:

1. It aggregates one level at a time. One chip per child subtree that holds unused files, labelled with the child's name and its count.
2. A child that is itself an unused file is skipped, because the INSIDE grid above already draws it dimmed and warn-outlined. Saying it twice on one screen is worse than saying it once.
3. A chip is a stand-in, not a node. Its id is `unused:<targetId>`, it carries `jump`, and tapping it focuses the target - which then shows its own NEEDS A LOOK frame, one level down, until the files themselves are the chips.
4. No connector line runs down to it. The INSIDE edge means containment; this frame is an annotation, and an identical line would have to cross the INSIDE block to reach it and would claim something untrue on arrival.
5. It uses the same packing rules as INSIDE (balanced rows, real measured widths, `CHILD_GAP`, `CHILD_ROWY`).
6. It sits `BLOCK_GAP` below INSIDE - deliberately more air than INSIDE's own row pitch. The two blocks answer different questions, and when they nearly touch this one reads as a footnote to the grid rather than as a finding of its own. Earlier it was separated by a fraction of `CHILD_ROWY` and looked stuck to the block above it.

## 5. Unused Code

Unused is a **state, not a type**, and the viewer's whole colour contract depends on keeping those separate.
So an unused node keeps its type hue and changes only its treatment: fill drops to `0.34` opacity and the border turns dashed `--warn`.
Recolouring the fill to an alarm colour is forbidden - it would break the one rule the legend rests on.

**The dimming is carried by the fill and the outline, never by the ink.**
The label stays at full-strength `--text`.
Dim ink on a dimmed box failed the contrast floor in both themes and was measured at 3.2:1 in the light, where these hues are dark pigments on cream and the box washed out to near-white, and 2.6:1 in the dark.
Full-strength ink on the same dimmed fill measures at worst 6.4:1 across every node hue in both themes, and the state still reads from the wash, the dashes and the motion.
Re-check with a contrast calculation, not by eye, if either value is ever touched.

**An unused node is inert on the grid.**
`events: 'no'`, scoped with `[role != "focus"]`.
Clicking one was a dead end that looked like a door: it is unreachable by definition, so there is nothing to explore from it.
The deliberate routes in stay open - the NEEDS A LOOK chip for the folder that holds it, and the panel list that names every unused file with its path - and a file opened that way is a normal focus node.

**Flagged nodes run marching ants.**
The dashed `--warn` outline travels, at `90ms` per step over a 64-unit cycle, driven by `border-dash-offset` on the flagged nodes only.
A static dashed outline gets skimmed past on a map that already uses dashes for every frame.
The animation never touches the label, which is the line the design system draws, and it stops under `prefers-reduced-motion` and while the tab is hidden.

Where the state surfaces, in the order a reader meets it:

| Surface | Treatment |
| --- | --- |
| Header subtitle | `--warn` pill with the repo-wide count |
| Sidebar row | `--warn` count badge on any container; strikethrough label on an unused file |
| Canvas | dimmed, dashed warn outline on the node; NEEDS A LOOK frame under INSIDE |
| Detail panel | `.p-warn` callout on an unused file; "Nothing reaches these" section on a container |
| Legend | dashed warn key, shown only when the repo has unused code |
| Landing card | count, the three worst areas by count, and the doubt |

**Every verdict ships with its doubt.**
The panel callout is two lines: what was found, then why it might be wrong (a dynamic import, a route table, a worker loaded by URL).
An import graph cannot see those, so the finding is a lead, never a licence to delete, and the copy has to say so or the reader will over-trust it.

## 5a. The Landing Card

`#overview` is a 316px card at the top-left of the stage, shown **only** on the root view and hidden on every other focus.

The root view is one box, its children, and the unused frame.
That answers "what is in here" and nothing else, so a reader arriving cold cannot tell how big the repo is, what it is written in, or that olive means file - the colour language was only in the legend, which is collapsed to a corner pill until hovered.

It carries three bands, in this order:

1. **What this is** - repo name, parsed languages, and the entry point it starts at.
2. **Shape** - top-level areas, files, import count.
3. **What needs attention** - the unused count, the three areas holding most of it, and the doubt that ships with every unused verdict.
4. **What the colours mean** - a permanent key for module, folder, file, and the dashed unused outline.

Every figure is read off the graph.
This card is the one place the density rule is easy to break, so: it is real content, never padding.
If a repo has no unused code that band is absent, exactly like the NEEDS A LOOK frame.

It hides below `1180px`, where the canvas becomes the scarce thing and chrome gives way rather than squeezing the diagram.

## 6. Labels

- A file label drops a known code extension so the label says what the thing is, not what it is written in. A name like `v1.2` keeps its tail.
- A child folder label keeps a trailing slash. That marks it as "a folder living in here" rather than the same-named sibling module.
- Diagram labels use the hand-lettered face; surrounding chrome stays in Outfit for dense prose.

## 7. Detail Panel

- 420px wide, top-right, `14px` radius, `--sheet` background, one `--shadow`.
- Section order is fixed and starts with what a reader wants first: what is inside, then what it touches. Blast radius comes after, not before.
- The open-file link sits against the title, not at the far edge of the header, because opening the file is the commonest action from this panel.
- A dependency row shows a name only. Repeating the folder path on every row turned the list into a wall of grey; the full path stays one hover away.
- A file's own imports stay folded in an accordion, since the canvas already draws them beside the node.
- Body scrolls at `max-height: min(54vh, 560px)` so the panel never buries the diagram it describes.

## 8. Responsive Tiers

Three progressive steps, in this order:

| Breakpoint | Change |
| --- | --- |
| `<= 1040px` | Sidebar narrows to 260px; breadcrumb width tightens |
| `<= 760px` | Header tightens; sidebar floats over the canvas as a drawer with a scrim; detail panel drops to a bottom sheet at `max-height: 68vh`; legend hides; hint moves under the header |
| `<= 420px` | Header shrinks to 52px; brand text hides, mark stays |

The rule behind the tiers: never squeeze the diagram to keep chrome in place.
Chrome floats or hides; the canvas keeps its area.

## 9. Do Not

- Do not reintroduce a physics or force layout. `fcose` was tried and rejected: it was laggy and produced blob-shaped clusters instead of a readable diagram.
- Do not draw the whole graph at once. The viewer is a per-node focus canvas plus a tree, on purpose.
- Do not add a second shadow level or a blur effect to chrome.
- Do not reassign node hues for aesthetic reasons; they encode type. That includes unused code: it is a state, and states are drawn with opacity and outline, never with a hue of their own.
- Do not present an unused-code finding as a verdict. It is always "nothing here reaches it", and the doubt ships beside it.
- Do not add a runtime fetch, CDN link, or external font URL.
- Do not use `Math.random()` anywhere in layout.

## 9. Verification

After changing the template:

1. Syntax-check the inline scripts, for example by extracting each `<script>` block and running `node --check` over it.
2. Regenerate a real map through the script sequence and open the generated `birdseye/index.html`, rather than building a standalone preview page.
3. Check both themes and all three responsive tiers.
