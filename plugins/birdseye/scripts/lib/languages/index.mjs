// The language registry. Each module owns one language's import extraction and
// resolution; `imports.mjs` dispatches per file by extension.
//
// A language is *active* for a repo when the repo actually contains files with
// its extensions and the module's `detect(root, files)` agrees. Detection is
// automatic - no config needed.

import path from 'node:path';
import javascript from './javascript.mjs';
import go from './go.mjs';
import python from './python.mjs';
import rust from './rust.mjs';
import csharp from './csharp.mjs';

export const LANGUAGES = [javascript, go, python, rust, csharp];

/** Every extension any language can parse - the widened `config.extensions`. */
export const ALL_EXTENSIONS = [...new Set(LANGUAGES.flatMap((l) => l.extensions))];

/** @returns {Array<{id:string, extensions:string[], module:object}>} */
export function resolveLanguages(root, files) {
  const present = new Set(files.map((f) => path.extname(f)));
  return LANGUAGES.filter(
    (m) => m.extensions.some((e) => present.has(e)) && m.detect(root, files),
  ).map((m) => ({ id: m.id, extensions: m.extensions, module: m }));
}

/** The language module owning `rel`'s extension, or null. */
export function languageForFile(rel, active) {
  const ext = path.extname(rel);
  return active.find((l) => l.extensions.includes(ext))?.module ?? null;
}

export function allExtensions(active) {
  return [...new Set(active.flatMap((l) => l.extensions))];
}
