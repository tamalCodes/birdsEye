"use client";

import { useState } from "react";

type Props = {
  command: string;
  /** What lands on the clipboard, if different from what is shown. */
  copyText?: string;
  label?: string;
  /**
   * The glyph before the command. Default "$" reads as "your shell" - use
   * that only for a command you actually run in the terminal. A command
   * typed inside Claude Code's own prompt (a slash command) must use ">"
   * instead, or people paste it into zsh/bash and it fails to resolve.
   */
  prompt?: string;
};

export default function CopyCommand({ command, copyText, label, prompt = "$" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText ?? command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked - the command is on screen to select by hand */
    }
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-hair bg-panel/70 px-4 py-3 font-mono text-[0.92rem]">
      <span aria-hidden className="select-none text-clay">
        {prompt}
      </span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-ink">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={label ?? `Copy: ${command}`}
        className="shrink-0 rounded-md border border-hair px-2.5 py-1 text-xs uppercase tracking-wider text-muted transition-colors hover:border-clay hover:text-ink"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
