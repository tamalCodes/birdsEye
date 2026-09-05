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
      className="mx-auto mt-11 max-w-3xl rounded-2xl border border-hair bg-canvas/70 p-4 sm:p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div
        role="tablist"
        aria-label="Choose install path"
        className="grid rounded-xl bg-panel/70 p-1 sm:inline-grid sm:grid-cols-2"
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-display text-2xl text-ink">{active.name}</h3>
            <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-muted">
              {active.body}
            </p>
          </div>
          <p className="text-sm text-faint">$ terminal / &gt; agent</p>
        </div>

        <ol className="mt-6 divide-y divide-hair">
          {active.steps.map((step) => (
            <li key={step.n} className="grid gap-3 py-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <div>
                <p className="font-mono text-xs tracking-[0.14em] text-clay">{step.n}</p>
                <p className="mt-1 text-ink">{step.label}</p>
                <p className="text-sm text-faint">{step.note}</p>
              </div>
              <CopyCommand command={step.cmd} prompt={step.prompt} />
            </li>
          ))}
        </ol>

        <div className="mt-2 border-t border-hair pt-5">
          <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div>
              <p className="font-mono text-xs tracking-[0.14em] text-clay">04</p>
              <p className="mt-1 text-ink">Open the map</p>
              <p className="text-sm text-faint">any browser, no server</p>
            </div>
            <CopyCommand command={mapOpen} prompt="" />
          </div>
        </div>
      </div>
    </div>
  );
}
