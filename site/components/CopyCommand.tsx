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
   * Pass "" for something that is neither - a bare file path, say - and no
   * glyph is rendered at all.
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
    <div className="group flex min-w-0 items-center gap-3 rounded-xl border border-hair bg-panel/70 px-4 py-3 font-mono text-[0.92rem]">
      {prompt ? (
        <span aria-hidden className="select-none text-clay">
          {prompt}
        </span>
      ) : null}
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-ink">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={label ?? `Copy: ${command}`}
        title={copied ? "Copied" : "Copy"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-raised hover:text-ink"
      >
        {copied ? (
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}
