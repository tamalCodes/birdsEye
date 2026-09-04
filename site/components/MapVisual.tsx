"use client";

/*
  The hero map. It is the one thing on the page that has to feel like the real
  product, so it is not a picture of a map - it is a small, working one. Hover
  or focus any node and the map answers the question the tool answers: how do I
  reach this, what does it reach, and what should I read before I touch it.

  Three rules keep it from looking broken at any width:
    1. Geometry lives in lib/mapGraph.ts on a fixed row grid, and every
       connector drops through a "bus" gutter that no label may occupy.
    2. A node's bottom anchor sits below its own label, so a connector leaving
       a node never crosses that node's name.
    3. Nothing animates position. Motion is opacity, scale and dash only, so
       the layout is identical on frame one and frame one thousand.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CHILDREN,
  KIND_COLOR,
  KIND_LABEL,
  MAP_EDGES,
  MAP_NODES,
  NODE_BY_ID,
  TOUR,
  anchors,
  litSet,
  type MapNode,
} from "@/lib/mapGraph";

const DIM = 0.2;
const SPRING = { type: "spring" as const, stiffness: 420, damping: 30, mass: 0.7 };

export default function MapVisual() {
  const reduced = useReducedMotion();

  /* `pinned` is the selection a click leaves behind; `hovered` is the transient
     one. The map always has a selection, because an empty one has nothing to
     say and the card underneath would go blank. */
  const [pinned, setPinned] = useState("auth");
  const [hovered, setHovered] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [visited, setVisited] = useState<Set<string>>(() => new Set(["auth"]));

  const active = hovered ?? pinned;
  const lit = useMemo(() => litSet(active), [active]);
  const node = NODE_BY_ID[active];

  const visit = useCallback((id: string) => {
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  /* Until somebody touches it, the map walks itself through a short tour so it
     reads as alive rather than as a still. The first real interaction ends the
     tour for good - nothing is more irritating than a widget that keeps moving
     under the cursor. */
  useEffect(() => {
    if (touched || reduced) return;
    let i = 0;
    const id = window.setInterval(() => {
      const next = TOUR[i % TOUR.length];
      i += 1;
      setPinned(next);
      visit(next);
    }, 2600);
    return () => window.clearInterval(id);
  }, [touched, reduced, visit]);

  const engage = useCallback(
    (id: string) => {
      setTouched(true);
      setHovered(id);
      visit(id);
    },
    [visit],
  );

  const select = useCallback(
    (id: string) => {
      setTouched(true);
      setPinned(id);
      visit(id);
    },
    [visit],
  );

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(46% 46% at 32% 30%, color-mix(in oklab, var(--clay) 26%, transparent), transparent), radial-gradient(40% 40% at 78% 72%, color-mix(in oklab, var(--plum) 20%, transparent), transparent)",
        }}
      />

      <div
        className="relative overflow-hidden rounded-2xl border border-hair bg-panel"
        style={{ boxShadow: "var(--shadow-map)" }}
      >
        <svg
          viewBox="0 0 1000 640"
          className="block w-full touch-manipulation"
          aria-label="An interactive birdsEye map of an example app. Select a node to see where it sits and what it depends on."
        >
          <defs>
            <pattern id="be-dots" width={24} height={24} patternUnits="userSpaceOnUse">
              <circle cx={1.5} cy={1.5} r={1.4} fill="var(--dot)" />
            </pattern>
          </defs>

          <rect x={0} y={56} width={1000} height={584} fill="var(--canvas)" />
          <rect x={0} y={56} width={1000} height={584} fill="url(#be-dots)" />

          <Toolbar visited={visited.size} total={MAP_NODES.length} reduced={!!reduced} />

          <g
            onPointerLeave={() => setHovered(null)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setHovered(null);
            }}
          >
            {MAP_EDGES.map((edge, i) => {
              const on = lit.has(edge.from) && lit.has(edge.to);
              return (
                <g key={edge.id}>
                  <motion.path
                    data-reveal=""
                    d={edge.d}
                    fill="none"
                    stroke="var(--line-strong)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: on ? 0.9 : DIM }}
                    transition={{
                      pathLength: { duration: 0.7, delay: 0.15 + i * 0.05, ease: "easeOut" },
                      opacity: { duration: 0.35 },
                    }}
                  />
                  {/* The signal running down a live edge. It is the cheapest way
                      to show direction: the map flows parent to child. */}
                  {on && !reduced && (
                    <motion.path
                      d={edge.d}
                      fill="none"
                      stroke={KIND_COLOR[NODE_BY_ID[edge.to].kind]}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray="7 93"
                      initial={{ strokeDashoffset: 100, opacity: 0 }}
                      animate={{ strokeDashoffset: 0, opacity: 0.85 }}
                      transition={{
                        strokeDashoffset: { duration: 1.6, repeat: Infinity, ease: "linear" },
                        opacity: { duration: 0.4 },
                      }}
                    />
                  )}
                </g>
              );
            })}

            {MAP_NODES.map((n, i) => (
              <Node
                key={n.id}
                node={n}
                index={i}
                lit={lit.has(n.id)}
                active={n.id === active}
                pinned={n.id === pinned}
                reduced={!!reduced}
                onEngage={engage}
                onSelect={select}
              />
            ))}
          </g>
        </svg>

        <AnimatePresence>
          {!touched && (
            <motion.div
              key="hint"
              exit={{ opacity: 0, y: 6 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
              className="glass pointer-events-none absolute bottom-4 left-4 hidden items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[0.7rem] tracking-wide text-muted sm:flex"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-clay opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-clay" />
              </span>
              hover a node
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* The five second payoff, and now the thing the map talks back through. */}
      <motion.div
        data-reveal=""
        className="glass absolute -bottom-6 right-4 w-[19rem] rounded-xl p-4 text-left max-[560px]:static max-[560px]:mt-4 max-[560px]:w-full"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.15, duration: 0.6 }}
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-live="polite"
      >
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-sm" style={{ color: KIND_COLOR[node.kind] }}>
            {node.label}
          </span>
          <span className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
            {KIND_LABEL[node.kind]}
          </span>
        </div>

        {/* A fixed minimum height so swapping copy never nudges the layout. */}
        <div className="relative mt-2 min-h-[3.1rem]">
          <AnimatePresence mode="wait">
            <motion.p
              key={`${active}-body`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="text-[0.92rem] leading-snug text-muted"
            >
              <Rich text={node.card.body} />
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-3 border-t border-hair pt-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${active}-foot`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">
                {node.card.footLabel}
              </p>
              <p className="mt-1 min-h-[1.2rem] font-mono text-[0.82rem] text-muted">
                {node.card.foot}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ nodes */

type NodeProps = {
  node: MapNode;
  index: number;
  lit: boolean;
  active: boolean;
  pinned: boolean;
  reduced: boolean;
  onEngage: (id: string) => void;
  onSelect: (id: string) => void;
};

function Node({ node, index, lit, active, pinned, reduced, onEngage, onSelect }: NodeProps) {
  const { top, bottom } = anchors(node);
  const color = KIND_COLOR[node.kind];
  const half = node.kind === "root" || node.kind === "module" ? (node.w ?? 128) / 2 : 46;
  const kids = CHILDREN[node.id]?.length ?? 0;

  return (
    <motion.g
      data-reveal=""
      role="button"
      tabIndex={0}
      aria-label={`${node.label}, ${KIND_LABEL[node.kind]}${
        kids ? `, ${kids} child${kids === 1 ? "" : "ren"}` : ""
      }`}
      aria-pressed={pinned}
      className="cursor-pointer outline-none"
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover="lift"
      whileFocus="lift"
      onPointerEnter={() => onEngage(node.id)}
      onFocus={() => onEngage(node.id)}
      onClick={() => onSelect(node.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      {/* Dimming rides a CSS transition rather than a motion `animate`, so it
          stays instant and never inherits the staggered entrance delay. */}
      <g data-reveal="" style={{ opacity: lit ? 1 : DIM, transition: "opacity 0.35s ease" }}>
        <Shape node={node} color={color} active={active} reduced={reduced} />
      </g>

      {/* One generous, invisible hit target covering the shape and its label, so
          the pointer never has to find an 11px circle. */}
      <rect
        x={node.x - half}
        y={top - 10}
        width={half * 2}
        height={bottom - top + 16}
        fill="transparent"
      />
    </motion.g>
  );
}

/* Scaling is anchored to the node's true centre in view-box units rather than
   to a fill-box, because a group's fill-box shifts as its children animate. */
function originOf(node: MapNode) {
  return {
    transformBox: "view-box",
    transformOrigin: `${node.x}px ${node.y}px`,
  } as const;
}

function Shape({
  node,
  color,
  active,
  reduced,
}: {
  node: MapNode;
  color: string;
  active: boolean;
  reduced: boolean;
}) {
  const boxy = node.kind === "root" || node.kind === "module";
  const w = node.w ?? 128;
  const origin = originOf(node);

  /* A wide box travelling 12% moves its edge 8px, which is a lunge. Circles are
     small enough to take the full lift. */
  const lift = { lift: { scale: boxy ? 1.06 : 1.12 } };

  return (
    /* The lift wraps the ring, the shape and the label together. Scaling the
       shape alone let a hovered box grow straight through its own selection
       ring, which read as a stray border clipped against the node. */
    <motion.g variants={lift} transition={SPRING} style={origin}>
      <AnimatePresence>
        {active && (
          <motion.g
            key="ring"
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.14 }}
            transition={SPRING}
            style={origin}
          >
            {boxy ? (
              <rect
                x={node.x - w / 2 - 8}
                y={node.y - 23}
                width={w + 16}
                height={46}
                rx={14}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                opacity={0.5}
              />
            ) : (
              <circle
                cx={node.x}
                cy={node.y}
                r={node.kind === "file" ? 19 : 24}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                opacity={0.55}
              />
            )}
          </motion.g>
        )}
      </AnimatePresence>

      {/* A slow breath on the selected node. Position never changes, only the
          radius of a halo that sits behind everything else. */}
      {active && !reduced && !boxy && (
        <motion.circle
          cx={node.x}
          cy={node.y}
          r={node.kind === "file" ? 19 : 27}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.9 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          style={origin}
        />
      )}

      {boxy ? (
        <rect x={node.x - w / 2} y={node.y - 15} width={w} height={30} rx={8} fill={color} />
      ) : node.kind === "folder" ? (
        <rect
          x={node.x - 15}
          y={node.y - 13}
          width={30}
          height={26}
          rx={7}
          fill={color}
        />
      ) : (
        <circle cx={node.x} cy={node.y} r={11} fill={color} />
      )}

      {boxy ? (
        <text
          x={node.x}
          y={node.y + 4.5}
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontWeight={600}
          fontSize={12.5}
          fill="var(--box-ink)"
          pointerEvents="none"
        >
          {node.label}
        </text>
      ) : (
        <text
          x={node.x}
          y={node.y + (node.kind === "folder" ? 32 : 24)}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize={11.5}
          fill={active ? "var(--ink)" : "var(--muted)"}
          pointerEvents="none"
          style={{ transition: "fill 0.25s ease" }}
        >
          {node.label}
        </text>
      )}
    </motion.g>
  );
}

/* ---------------------------------------------------------------- toolbar */

function Toolbar({
  visited,
  total,
  reduced,
}: {
  visited: number;
  total: number;
  reduced: boolean;
}) {
  const modules = useCountUp(12, reduced);
  const files = useCountUp(148, reduced);
  const langs = useCountUp(6, reduced);
  const done = visited >= total;
  const pct = visited / total;

  return (
    <g>
      <rect x={0} y={0} width={1000} height={56} fill="var(--panel)" />
      <line x1={0} y1={56} x2={1000} y2={56} stroke="var(--hair)" strokeWidth={1} />
      <path
        transform="translate(20 16) scale(0.1)"
        d="M120 52C129 54 133 66 134 82C150 92 186 116 210 146C213 150 211 154 206 153C176 150 150 140 133 128C132 145 128 164 120 178C112 164 108 145 107 128C90 140 64 150 34 153C29 154 27 150 30 146C54 116 90 92 106 82C107 66 111 54 120 52Z"
        fill="var(--clay)"
      />
      <text
        x={52}
        y={33}
        fontFamily="var(--font-sans)"
        fontWeight={600}
        fontSize={14}
        fill="var(--ink)"
      >
        finch
      </text>
      <motion.text
        data-reveal=""
        x={164}
        y={33}
        fontFamily="var(--font-mono)"
        fontSize={12}
        fill="var(--faint)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {modules} modules &middot; {files} files &middot; {langs} languages
      </motion.text>

      {/* An explored meter. It turns a diagram into something with a finish
          line, which is the whole reason anybody pokes at the second node. */}
      <text
        x={690}
        y={33}
        fontFamily="var(--font-mono)"
        fontSize={11}
        fill="var(--faint)"
        letterSpacing="0.08em"
      >
        {done ? "MAP COMPLETE" : "EXPLORED"}
      </text>
      <rect x={790} y={24} width={130} height={6} rx={3} fill="var(--hair)" />
      <motion.rect
        y={24}
        height={6}
        rx={3}
        fill={done ? "var(--clay)" : "var(--olive)"}
        initial={false}
        animate={{ x: 790, width: Math.max(6, 130 * pct) }}
        transition={SPRING}
      />
      <text
        x={980}
        y={33}
        textAnchor="end"
        fontFamily="var(--font-mono)"
        fontSize={11}
        fill="var(--muted)"
      >
        {visited}/{total}
      </text>
    </g>
  );
}

/* Counts tick up once on mount. The label they live in fades in over the same
   window, so the run from zero is never seen as a jump. */
function useCountUp(target: number, reduced: boolean) {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    /* No "only once" ref guard here. StrictMode mounts effects twice, and a
       ref guard let the first pass zero the value and cancel its own frame
       while the second pass bailed out, leaving the counts stuck on 0. This
       version simply restarts, so a double mount still lands on the target. */
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / 1000);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setValue(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  return value;
}

/* ------------------------------------------------------------------- text */

/* Markdown-lite for the card copy: **bold** and `mono`, nothing else. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**")) {
          return (
            <span key={i} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </span>
          );
        }
        if (part.startsWith("`")) {
          return (
            <span key={i} className="font-mono text-[0.85em] text-ink">
              {part.slice(1, -1)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
