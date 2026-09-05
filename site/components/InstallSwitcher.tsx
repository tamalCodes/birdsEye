"use client";

import { useMemo, useState } from "react";
import CopyCommand from "@/components/CopyCommand";

type InstallStep = {
  n: string;
  label: string;
  note: string;
  cmd: string;
  prompt: string;
};

type InstallMethod = {
  name: string;
  body: string;
  steps: InstallStep[];
};

type Props = {
  methods: InstallMethod[];
  mapOpen: string;
};

export default function InstallSwitcher({ methods, mapOpen }: Props) {
  const [activeName, setActiveName] = useState(methods[0]?.name ?? "");
  const active = useMemo(
    () => methods.find((method) => method.name === activeName) ?? methods[0],
    [activeName, methods],
  );

  if (!active) {
    return null;
  }

  return (
    <div
      className="mx-auto mt-11 max-w-2xl"
    >
      <div
        role="tablist"
        aria-label="Choose install path"
        className="grid rounded-xl border border-hair bg-panel/55 p-1 sm:inline-grid sm:grid-cols-2"
      >
        {methods.map((method) => {
          const selected = method.name === active.name;

          return (
            <button
              key={method.name}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="install-steps"
              onClick={() => setActiveName(method.name)}
              className={[
                "rounded-lg px-4 py-2.5 text-sm transition-colors",
                selected
                  ? "bg-canvas text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {method.name}
            </button>
          );
        })}
      </div>

      <div id="install-steps" role="tabpanel" className="mt-7">
        <div>
          <h3 className="font-display text-2xl text-ink">{active.name}</h3>
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-muted">
            {active.body}
          </p>
        </div>

        <ol
          className="mt-6 overflow-hidden rounded-xl border border-hair bg-canvas/70"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {active.steps.map((step) => (
            <li
              key={step.n}
              className="grid gap-3 border-b border-hair px-4 py-4 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:px-5"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs tracking-[0.14em] text-clay">
                    {step.n}
                  </span>
                  <span className="text-ink">{step.label}</span>
                </div>
                <p className="mt-1 text-sm text-faint">{step.note}</p>
              </div>
              <CopyCommand command={step.cmd} prompt={step.prompt} variant="bare" />
            </li>
          ))}
          <li className="grid gap-3 border-t border-hair-soft bg-panel/28 px-4 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:px-5">
            <div className="min-w-0">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs tracking-[0.14em] text-clay">
                  04
                </span>
                <span className="text-ink">Open the map</span>
              </div>
              <p className="mt-1 text-sm text-faint">any browser, no server</p>
            </div>
            <CopyCommand command={mapOpen} prompt="" variant="bare" />
          </li>
        </ol>

        <p className="mt-4 text-sm text-faint">$ means terminal. &gt; means agent prompt.</p>
      </div>
    </div>
  );
}
