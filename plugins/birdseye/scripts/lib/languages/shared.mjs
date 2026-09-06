// Resolver shapes that more than one language needs.
//
// Two families cover everything birdsEye resolves outside JS/TS, Go and Rust:
//
//   namespace  - the import names a namespace, package or module, and the file
//                that owns it is whichever file declares that name. Java,
//                Kotlin, Scala, C#, PHP, Elixir and Swift all work this way.
//                Edges are real files but coarser than one symbol, so they are
//                tagged `approx`.
//   path       - the import names a file, relative to the importing file or to
//                one of a few source roots. Ruby, C/C++/Objective-C, Lua,
//                Julia and Zig work this way. Edges are exact.
//
// Both take their facts from the extractor's per-file records rather than
// re-reading and re-scanning source, so what the resolver believes a file
// declares is exactly what the parser saw.

import path from 'node:path';

const dir = (rel) => {
  const d = path.posix.dirname(rel);
  return d === '.' ? '' : d;
};
const join = (...parts) => path.posix.join(...parts.filter(Boolean)).replace(/^\.\//, '');

/**
 * Build `declared name -> Set(files)` from the extractor's `declares` lists.
 * @param {(rel: string) => string[]} declaresOf
 * @param {string[]} files  the files of this language only
 */
export function declarationIndex(declaresOf, files) {
  const index = new Map();
  for (const rel of files) {
    for (const name of declaresOf(rel)) {
      if (!index.has(name)) index.set(name, new Set());
      index.get(name).add(rel);
    }
  }
  return index;
}

/**
 * A resolver for languages whose imports name a namespace rather than a file.
 *
 * `import a.b.C` is tried as `a.b.C` first (Elixir aliases a module directly),
 * then by trimming the last segment until a declared namespace matches, which
 * is what turns a Java class import into its package.
 *
 * @param {{ index: Map<string, Set<string>>, separator: string }} opts
 */
export function namespaceResolver({ index, separator }) {
  return {
    resolve(spec, fromRel) {
      let name = spec;
      while (name && !index.has(name)) {
        const cut = name.lastIndexOf(separator);
        if (cut === -1) {
          name = null;
          break;
        }
        name = name.slice(0, cut);
      }
      if (!name) {
        // Declared nowhere in this repo: a standard-library or third-party
        // namespace. Quiet, not unresolved - reporting these would drown the
        // real breakages in noise.
        return { kind: 'external' };
      }
      const paths = [...index.get(name)].filter((p) => p !== fromRel).sort();
      return paths.length ? { kind: 'file', paths, approx: true } : { kind: 'external' };
    },
  };
}

/**
 * A resolver for languages whose imports name a file path.
 *
 * @param {{
 *   files: Set<string>,
 *   extensions: string[],   probed in order when the spec has none
 *   roots?: string[],       source roots a non-relative spec is tried against
 *   indexNames?: string[],  directory index files, e.g. `init.lua`
 * }} opts
 */
export function pathResolver({ files, extensions, roots = [''], indexNames = [] }) {
  // macOS and Windows resolve paths case-insensitively, so an import whose
  // casing does not match the file on disk works there and would only break on
  // Linux. Matching exactly and nothing else would silently drop that edge on
  // the two most common development machines, so a case-folded index backs the
  // exact one up - but only when it names exactly one file, because two files
  // differing solely by case make any choice a guess.
  const folded = new Map();
  for (const f of files) {
    const key = f.toLowerCase();
    folded.set(key, folded.has(key) ? null : f);
  }
  const has = (p) => files.has(p) || folded.get(p.toLowerCase()) != null;
  const actual = (p) => (files.has(p) ? p : folded.get(p.toLowerCase()));

  const probe = (base) => {
    if (has(base) && extensions.includes(path.posix.extname(base))) return actual(base);
    for (const ext of extensions) if (has(base + ext)) return actual(base + ext);
    for (const name of indexNames) {
      const idx = join(base, name);
      if (has(idx)) return actual(idx);
    }
    return null;
  };

  return {
    resolve(spec, fromRel, kind) {
      if (!spec || /^[a-z]+:\/\//i.test(spec)) return { kind: 'external' };
      const relative = spec.startsWith('.') || kind === 'relative';
      const cleaned = spec.replace(/^\.\//, '');

      if (relative) {
        // `../x` and `./x` walk from the importing file; a bare `x.h` next to
        // the importer counts as relative too, which is how C `#include "x.h"`
        // behaves in practice.
        const base = path.posix.normalize(join(dir(fromRel), cleaned)).replace(/^(\.\.\/)+/, '');
        const hit = probe(base);
        if (hit && hit !== fromRel) return { kind: 'file', paths: [hit] };
      }

      for (const root of roots) {
        const hit = probe(join(root, cleaned));
        if (hit && hit !== fromRel) return { kind: 'file', paths: [hit] };
      }
      // A relative spec that resolved to nothing is a genuine broken link; a
      // bare one is almost always a package.
      return { kind: relative ? 'unresolved' : 'external' };
    },
  };
}

/** The subset of `allFiles` that belongs to this language. */
export const filesWithExtensions = (allFiles, extensions) =>
  allFiles.filter((f) => extensions.includes(path.posix.extname(f).toLowerCase()));
