/*
  The data behind the hero map. It is a hand-authored recreation of a real
  birdsEye map rather than a screenshot, so it stays crisp at any width and
  picks up the site palette. Keeping the geometry here (instead of inline in
  the component) means the layout can be reasoned about as a grid: every node
  sits on a numbered row, and every edge drops into a horizontal "bus" gutter
  that no label is allowed to occupy. That rule is what keeps connectors from
  cutting through text.

  It mirrors the real product: a containment tree - code root, then modules,
  then the folders and files inside them - with the dependency graph rolled up
  onto whichever level you are looking at.
*/

export type NodeKind = "root" | "module" | "folder" | "file";

export type MapNode = {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  /* Box width, for the root and module rectangles only. */
  w?: number;
  parent: string | null;
  /* The gutter its own children drop through. Leaves omit it. */
  bus?: number;
  card: {
    /* Markdown-lite: **bold** and `mono` are the only two markers. */
    body: string;
    footLabel: string;
    foot: string;
  };
};

/* Rows: 116 / 234 / 372 / 496. Buses: 172 / 296 / 312 / 320 / 440.
   Nothing but a connector is ever drawn at a bus height. */
export const MAP_NODES: MapNode[] = [
  {
    id: "src",
    kind: "root",
    label: "src",
    x: 500,
    y: 116,
    w: 92,
    parent: null,
    bus: 172,
    card: {
      body: "The code root. **Three feature modules** hang off it, plus one shared layer everything imports.",
      footLabel: "Entry point",
      foot: "src/main.tsx",
    },
  },

  {
    id: "checkout",
    kind: "module",
    label: "checkout",
    x: 196,
    y: 234,
    w: 132,
    parent: "src",
    bus: 296,
    card: {
      body: "**6 files**. Imports from `auth` and `ui`, and nothing outside checkout reaches into it.",
      footLabel: "Depends on",
      foot: "auth · ui",
    },
  },
  {
    id: "auth",
    kind: "module",
    label: "auth",
    x: 500,
    y: 234,
    w: 96,
    parent: "src",
    bus: 312,
    card: {
      body: "**12 modules** import from here - the highest fan-in in the repo. `session.ts` is the file they all touch.",
      footLabel: "Used by",
      foot: "12 modules · 0 outward deps",
    },
  },
  {
    id: "ui",
    kind: "module",
    label: "ui",
    x: 812,
    y: 234,
    w: 84,
    parent: "src",
    bus: 320,
    card: {
      body: "General-purpose. Pure components, imported by every feature and importing **nothing back**.",
      footLabel: "Kind",
      foot: "shared · 9 files",
    },
  },

  {
    id: "steps",
    kind: "folder",
    label: "steps/",
    x: 196,
    y: 372,
    parent: "checkout",
    bus: 440,
    card: {
      body: "The checkout wizard, **4 screens**. Each one imports `auth` for the current user and `ui` for the shell.",
      footLabel: "Contains",
      foot: "4 files",
    },
  },
  {
    id: "session",
    kind: "file",
    label: "session.ts",
    x: 430,
    y: 372,
    parent: "auth",
    card: {
      body: "Read by **9 of the 12** dependents. Changing an export here ripples to all of them at once.",
      footLabel: "Fan-in",
      foot: "High · 9 files import it",
    },
  },
  {
    id: "guards",
    kind: "file",
    label: "guards.ts",
    x: 566,
    y: 372,
    parent: "auth",
    card: {
      body: "Route-level checks. Imported by the router only, so it is **safe to refactor** in isolation.",
      footLabel: "Fan-in",
      foot: "Low · 1 dependent",
    },
  },
  {
    id: "token",
    kind: "file",
    label: "token.ts",
    x: 664,
    y: 372,
    parent: "auth",
    card: {
      body: "Signs and verifies JWTs. `session.ts` is its only caller - a tight, one-way pair.",
      footLabel: "Fan-in",
      foot: "1 dependent · session.ts",
    },
  },
  {
    id: "button",
    kind: "file",
    label: "Button.tsx",
    x: 756,
    y: 372,
    parent: "ui",
    card: {
      body: "Imported by **21 files** across every feature. A leaf in the graph - it imports nothing itself.",
      footLabel: "Fan-in",
      foot: "21 files · 0 outward deps",
    },
  },
  {
    id: "modal",
    kind: "file",
    label: "Modal.tsx",
    x: 884,
    y: 372,
    parent: "ui",
    card: {
      body: "Pulls in `Button.tsx` and nothing else. The only intra-`ui` edge in the whole module.",
      footLabel: "Depends on",
      foot: "ui/Button.tsx",
    },
  },

  {
    id: "address",
    kind: "file",
    label: "Address.tsx",
    x: 128,
    y: 496,
    parent: "steps",
    card: {
      body: "Step 2. Imports `session.ts` for the saved address and `Modal.tsx` for the picker.",
      footLabel: "Depends on",
      foot: "auth/session.ts · ui/Modal.tsx",
    },
  },
  {
    id: "review",
    kind: "file",
    label: "Review.tsx",
    x: 290,
    y: 496,
    parent: "steps",
    card: {
      body: "The final step. Reads from every other step's file - the busiest node inside `checkout`.",
      footLabel: "Depends on",
      foot: "3 files in steps/",
    },
  },
];

export const KIND_LABEL: Record<NodeKind, string> = {
  root: "code root",
  module: "module",
  folder: "folder",
  file: "file",
};

export const KIND_COLOR: Record<NodeKind, string> = {
  root: "var(--ochre)",
  module: "var(--clay)",
  folder: "var(--plum)",
  file: "var(--olive)",
};

export const NODE_BY_ID: Record<string, MapNode> = Object.fromEntries(
  MAP_NODES.map((n) => [n.id, n]),
);

/* Where an edge may enter and leave a node. The bottom anchor deliberately
   clears the label underneath the shape - that is the fix for connectors that
   used to run straight through their own node's name. */
export function anchors(n: MapNode): { top: number; bottom: number } {
  switch (n.kind) {
    case "root":
    case "module":
      return { top: n.y - 15, bottom: n.y + 15 };
    case "folder":
      return { top: n.y - 15, bottom: n.y + 38 };
    case "file":
      return { top: n.y - 11, bottom: n.y + 32 };
  }
}

export type MapEdge = { id: string; from: string; to: string; d: string };

/* A parent-to-child elbow: straight down into the bus, across, then down into
   the child's top. Corners are arced rather than mitred, which is what stops
   the spine reading as a stack of loose sticks. */
function elbow(parent: MapNode, child: MapNode): string {
  const p = anchors(parent);
  const c = anchors(child);
  const bus = parent.bus ?? (p.bottom + c.top) / 2;

  if (Math.abs(parent.x - child.x) < 0.5) {
    return `M${parent.x} ${p.bottom} L${parent.x} ${c.top}`;
  }

  const r = 12;
  const dir = child.x > parent.x ? 1 : -1;
  return [
    `M${parent.x} ${p.bottom}`,
    `L${parent.x} ${bus - r}`,
    `Q${parent.x} ${bus} ${parent.x + dir * r} ${bus}`,
    `L${child.x - dir * r} ${bus}`,
    `Q${child.x} ${bus} ${child.x} ${bus + r}`,
    `L${child.x} ${c.top}`,
  ].join(" ");
}

export const MAP_EDGES: MapEdge[] = MAP_NODES.filter((n) => n.parent).map((n) => {
  const parent = NODE_BY_ID[n.parent as string];
  return { id: `${parent.id}-${n.id}`, from: parent.id, to: n.id, d: elbow(parent, n) };
});

export const CHILDREN: Record<string, string[]> = MAP_NODES.reduce(
  (acc, n) => {
    if (n.parent) (acc[n.parent] ??= []).push(n.id);
    return acc;
  },
  {} as Record<string, string[]>,
);

/* The set a selection lights up: the node, the chain of parents that leads to
   it, and its direct children. That is the question the real tool answers -
   where does this sit, and what does it connect to. */
export function litSet(id: string): Set<string> {
  const lit = new Set<string>([id, ...(CHILDREN[id] ?? [])]);
  let cursor = NODE_BY_ID[id]?.parent;
  while (cursor) {
    lit.add(cursor);
    cursor = NODE_BY_ID[cursor].parent;
  }
  return lit;
}

/* The order the map introduces itself in when nobody has touched it yet. */
export const TOUR = ["auth", "ui", "steps", "session"];
