/*
  A hand-built recreation of a real birdsEye map - not a screenshot, so it
  stays crisp at any width and picks up the site's palette. Same vocabulary
  the tool uses: clay circles are modules, olive circles are files, plum
  boxes are screens, the rose diamond is a doc, and the elbow connectors are
  the navigation / dependency spine.
*/

import type { CSSProperties } from "react";

type NodeProps = {
  x: number;
  y: number;
  label: string;
  delay: number;
};

function Elbow({ d, delay, color = "var(--hair)" }: { d: string; delay: number; color?: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={
        {
          strokeDasharray: 600,
          strokeDashoffset: 600,
          "--dash": "600",
          animation: `be-draw 1s ease ${delay}s forwards`,
        } as CSSProperties
      }
    />
  );
}

function ModuleNode({ x, y, label, delay, selected = false }: NodeProps & { selected?: boolean }) {
  return (
    <g style={{ animation: `be-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}s both` }}>
      {selected && (
        <circle cx={x} cy={y} r={26} fill="none" stroke="var(--ink)" strokeWidth={2} opacity={0.9} />
      )}
      <circle cx={x} cy={y} r={19} fill="var(--clay)" />
      <text
        x={x}
        y={y + 38}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={13}
        fill="var(--ink)"
      >
        {label}
      </text>
    </g>
  );
}

function FileNode({ x, y, label, delay }: NodeProps) {
  return (
    <g style={{ animation: `be-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}s both` }}>
      <circle cx={x} cy={y} r={11} fill="var(--olive)" />
      <text
        x={x}
        y={y + 26}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={11.5}
        fill="var(--muted)"
      >
        {label}
      </text>
    </g>
  );
}

function ScreenNode({
  x,
  y,
  label,
  delay,
  w = 128,
  fill = "var(--plum)",
}: NodeProps & { w?: number; fill?: string }) {
  return (
    <g style={{ animation: `be-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}s both` }}>
      <rect x={x - w / 2} y={y - 15} width={w} height={30} rx={8} fill={fill} />
      <text
        x={x}
        y={y + 4.5}
        textAnchor="middle"
        fontFamily="var(--font-sans)"
        fontWeight={600}
        fontSize={12.5}
        fill="var(--box-ink)"
      >
        {label}
      </text>
    </g>
  );
}

function DocNode({ x, y, label, delay }: NodeProps) {
  return (
    <g style={{ animation: `be-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}s both` }}>
      <rect
        x={x - 13}
        y={y - 13}
        width={26}
        height={26}
        rx={5}
        transform={`rotate(45 ${x} ${y})`}
        fill="var(--rose)"
      />
      <text
        x={x}
        y={y + 32}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={11.5}
        fill="var(--muted)"
      >
        {label}
      </text>
    </g>
  );
}

export default function MapVisual() {
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
        className="overflow-hidden rounded-2xl border border-hair bg-panel"
        style={{ boxShadow: "var(--shadow-map)" }}
      >
        <svg
          viewBox="0 0 1000 660"
          className="block w-full"
          role="img"
          aria-label="A birdsEye map of an example app: an App route branching to an Onboarding step-flow, a highlighted auth module with its files and a spec, and a portfolio module."
        >
          <defs>
            <pattern id="be-dots" width={24} height={24} patternUnits="userSpaceOnUse">
              <circle cx={1.5} cy={1.5} r={1.4} fill="var(--dot)" />
            </pattern>
          </defs>

          {/* canvas */}
          <rect x={0} y={54} width={1000} height={606} fill="var(--canvas)" />
          <rect x={0} y={54} width={1000} height={606} fill="url(#be-dots)" />

          {/* toolbar */}
          <rect x={0} y={0} width={1000} height={54} fill="var(--panel)" />
          <line x1={0} y1={54} x2={1000} y2={54} stroke="var(--hair)" strokeWidth={1} />
          <path
            transform="translate(20 15) scale(0.1)"
            d="M120 52C129 54 133 66 134 82C150 92 186 116 210 146C213 150 211 154 206 153C176 150 150 140 133 128C132 145 128 164 120 178C112 164 108 145 107 128C90 140 64 150 34 153C29 154 27 150 30 146C54 116 90 92 106 82C107 66 111 54 120 52Z"
            fill="var(--clay)"
          />
          <text x={42} y={32} fontFamily="var(--font-sans)" fontWeight={600} fontSize={14} fill="var(--ink)">
            perccent-app
          </text>
          <text x={146} y={32} fontFamily="var(--font-mono)" fontSize={12} fill="var(--faint)">
            18 modules &middot; 9 screens &middot; 24 specs
          </text>
          <rect x={906} y={16} width={30} height={22} rx={6} fill="none" stroke="var(--hair)" />
          <rect x={944} y={16} width={30} height={22} rx={6} fill="none" stroke="var(--hair)" />
          <circle cx={959} cy={27} r={5} fill="none" stroke="var(--muted)" strokeWidth={1.4} />

          {/* edges */}
          <Elbow d="M500 96 L500 128 L232 128 L232 160" delay={0.15} color="var(--line-strong, #6b6355)" />
          <Elbow d="M500 96 L500 128 L500 160" delay={0.2} color="var(--line-strong, #6b6355)" />
          <Elbow d="M500 96 L500 128 L790 128 L790 300" delay={0.25} color="var(--line-strong, #6b6355)" />

          {/* onboarding step flow */}
          <Elbow d="M232 190 L232 214 L232 238" delay={0.5} color="var(--hair)" />
          <Elbow d="M160 300 L160 330 L160 356" delay={0.62} color="var(--hair)" />
          <Elbow d="M160 300 L160 330 L305 330 L305 356" delay={0.68} color="var(--hair)" />

          {/* auth internals */}
          <Elbow d="M500 190 L500 232 L430 232 L430 262" delay={0.72} color="var(--hair)" />
          <Elbow d="M500 190 L500 232 L560 232 L560 262" delay={0.78} color="var(--hair)" />
          <Elbow d="M500 190 L500 232 L500 300 L640 300 L640 328" delay={0.84} color="var(--rose)" />

          {/* portfolio internals */}
          <Elbow d="M790 330 L790 360 L724 360 L724 388" delay={0.9} color="var(--hair)" />
          <Elbow d="M790 330 L790 360 L856 360 L856 388" delay={0.95} color="var(--hair)" />

          {/* nodes */}
          <ScreenNode x={500} y={78} label="App" w={90} fill="var(--ochre)" delay={0.05} />

          <ScreenNode x={232} y={175} label="Onboarding" delay={0.3} />
          <ScreenNode x={232} y={253} label="Demographic" w={130} delay={0.55} />
          <ScreenNode x={160} y={372} label="Bank details" w={126} delay={0.66} />
          <ScreenNode x={305} y={372} label="Nominee" w={110} delay={0.72} />

          <ModuleNode x={500} y={175} label="auth" delay={0.34} selected />
          <FileNode x={430} y={274} label="session.ts" delay={0.8} />
          <FileNode x={560} y={274} label="guards.ts" delay={0.86} />
          <DocNode x={640} y={344} label="AUTH.md" delay={0.9} />

          <ModuleNode x={790} y={315} label="portfolio" delay={0.5} />
          <FileNode x={724} y={400} label="holdings.ts" delay={1} />
          <FileNode x={856} y={400} label="pnl.ts" delay={1.05} />
        </svg>
      </div>

      {/* floating answer card - the 5-second payoff */}
      <div
        className="glass absolute -bottom-6 right-4 w-[19rem] rounded-xl p-4 text-left max-[560px]:static max-[560px]:mt-4 max-[560px]:w-full"
        style={{ animation: "be-fade-up 0.6s ease 1.15s both", boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-sm text-clay">auth</span>
          <span className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">module</span>
        </div>
        <p className="mt-2 text-[0.92rem] leading-snug text-ink">
          <span className="font-semibold">12 modules</span> use code from here. The riskiest file
          to touch is <span className="font-mono text-[0.85rem]">session.ts</span>.
        </p>
        <div className="mt-3 border-t border-hair pt-3">
          <p className="font-mono text-[0.7rem] uppercase tracking-wider text-faint">Read first</p>
          <p className="mt-1 font-mono text-[0.82rem] text-muted">
            AUTH.md &middot; MONEY-MOVEMENT.md
          </p>
        </div>
      </div>
    </div>
  );
}
