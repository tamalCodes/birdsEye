/*
  The data behind the hero map. It is a hand-authored recreation of a real
  birdsEye map rather than a screenshot, so it stays crisp at any width and
  picks up the site palette. Keeping the geometry here (instead of inline in
  the component) means the layout can be reasoned about as a grid: every node
  sits on a numbered row, and every edge drops into a horizontal "bus" gutter
  that no label is allowed to occupy. That rule is what keeps connectors from
  cutting through text.
*/

export type NodeKind = "route" | "screen" | "module" | "file" | "doc";

export type MapNode = {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  /* Box width, for the route and screen rectangles only. */
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
    id: "app",
    kind: "route",
    label: "App",
    x: 500,
    y: 116,
    w: 92,
    parent: null,
    bus: 172,
    card: {
      body: "The root route. Everything below is reachable from here in **3 hops or fewer**.",
      footLabel: "Entry point",
      foot: "app/_layout.tsx",
    },
  },

  {
    id: "onboarding",
    kind: "screen",
    label: "Onboarding",
    x: 196,
    y: 234,
    w: 140,
    parent: "app",
    bus: 296,
    card: {
      body: "A **4 step flow**. Step order lives in one file, so a reorder is a one line change.",
      footLabel: "Read first",
      foot: "ONBOARDING.md",
    },
  },
  {
    id: "auth",
    kind: "module",
    label: "auth",
    x: 500,
    y: 234,
    parent: "app",
    bus: 312,
    card: {
      body: "**12 modules** use code from here. The riskiest file to touch is `session.ts`.",
      footLabel: "Read first",
      foot: "AUTH.md · MONEY-MOVEMENT.md",
    },
  },
  {
    id: "portfolio",
    kind: "module",
    label: "portfolio",
    x: 812,
    y: 234,
    parent: "app",
    bus: 320,
    card: {
      body: "Owns every number the user sees. **No spec covers it**, so an agent will guess here.",
      footLabel: "Gap",
      foot: "0 of 2 files documented",
    },
  },

  {
    id: "demographic",
    kind: "screen",
    label: "Demographic",
    x: 196,
    y: 372,
    w: 142,
    parent: "onboarding",
    bus: 440,
    card: {
      body: "Collects identity before money. Two later steps **cannot render** until it passes.",
      footLabel: "Read first",
      foot: "KYC.md",
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
      body: "Touched by **9 of the 12** dependents. Changing its shape breaks them all at once.",
      footLabel: "Blast radius",
      foot: "High · covered by AUTH.md",
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
      body: "Route level checks. Read by the router only, so it is **safe to refactor**.",
      footLabel: "Blast radius",
      foot: "Low · 1 dependent",
    },
  },
  {
    id: "authdoc",
    kind: "doc",
    label: "AUTH.md",
    x: 664,
    y: 372,
    parent: "auth",
    card: {
      body: "The spec an agent should open first. Last verified against the code **6 days ago**.",
      footLabel: "Status",
      foot: "Fresh · covers 2 of 2 files",
    },
  },
  {
    id: "holdings",
    kind: "file",
    label: "holdings.ts",
    x: 756,
    y: 372,
    parent: "portfolio",
    card: {
      body: "Positions and cost basis. **Undocumented**, and every P&L number reads from it.",
      footLabel: "Suggested",
      foot: "Write PORTFOLIO.md",
    },
  },
  {
    id: "pnl",
    kind: "file",
    label: "pnl.ts",
    x: 884,
    y: 372,
    parent: "portfolio",
    card: {
      body: "Derives gains from `holdings.ts`. Rounding rules live here and **nowhere else**.",
      footLabel: "Suggested",
      foot: "Write PORTFOLIO.md",
    },
  },

  {
    id: "bank",
    kind: "screen",
    label: "Bank details",
    x: 128,
    y: 496,
    w: 138,
    parent: "demographic",
    card: {
      body: "Money in and out. Guarded by `guards.ts`, so **auth changes reach it**.",
      footLabel: "Read first",
      foot: "MONEY-MOVEMENT.md",
    },
  },
  {
    id: "nominee",
    kind: "screen",
    label: "Nominee",
    x: 290,
    y: 496,
    w: 116,
    parent: "demographic",
    card: {
      body: "The last step, and the **only optional one**. Skipping it still completes onboarding.",
      footLabel: "Read first",
      foot: "ONBOARDING.md",
    },
  },
];

export const KIND_LABEL: Record<NodeKind, string> = {
  route: "route",
  screen: "screen",
  module: "module",
  file: "file",
  doc: "spec",
};

export const KIND_COLOR: Record<NodeKind, string> = {
  route: "var(--ochre)",
  screen: "var(--plum)",
  module: "var(--clay)",
  file: "var(--olive)",
  doc: "var(--rose)",
};

export const NODE_BY_ID: Record<string, MapNode> = Object.fromEntries(
  MAP_NODES.map((n) => [n.id, n]),
);

/* Where an edge may enter and leave a node. The bottom anchor deliberately
   clears the label underneath the shape - that is the fix for connectors that
   used to run straight through their own node's name. */
export function anchors(n: MapNode): { top: number; bottom: number } {
  switch (n.kind) {
    case "route":
    case "screen":
      return { top: n.y - 15, bottom: n.y + 15 };
    case "module":
      return { top: n.y - 19, bottom: n.y + 44 };
    case "file":
      return { top: n.y - 11, bottom: n.y + 32 };
    case "doc":
      return { top: n.y - 19, bottom: n.y + 38 };
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
   how do I get here, and what does this reach. */
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
export const TOUR = ["auth", "portfolio", "demographic", "session"];
