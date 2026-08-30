// Turning a path written inside a doc into a verdict about the repo.
//
// The doc extractor reads prose and reports the paths it could not place. That
// is a judgement call made by a model, and on real repos it is wrong often
// enough to be worthless on its own: a spec that says `components/BasketCard.tsx`
// means the file inside its own module, and calling that missing is a claim the
// reader has no way to check. So every claim is re-checked here, mechanically,
// and whatever survives carries the evidence that convicted it.
//
// Three verdicts, and they are not the same thing:
//   deleted  - git has a commit that removed this path. Genuinely stale.
//   unknown  - no such path now, and none in the history either. Usually a doc
//              describing files that were never built, or another repo's tree.
//   external - the path leaves the repo (`~/...`, `/...`, `../`, a glob). There
//              is nothing here to check it against, so it is not evidence of rot.

import { execFileSync } from 'node:child_process';
import { walkFiles } from './walk.mjs';
import { IGNORE_FILE } from './const.mjs';

/** Marker for a suffix that more than one path ends with. */
const AMBIGUOUS = Symbol('ambiguous');

const norm = (p) => String(p ?? '').trim().replace(/^\.\//, '').replace(/\/+$/, '');

/** A path that cannot be checked against this repo at all. */
const ESCAPES_REPO = /^(?:~|\/|\.\.\/)|\.\.\.|[{}*?]/;

/**
 * Every file on disk, every directory implied by one, and a suffix index so a
 * doc that writes `PortfolioCard.tsx` as shorthand still finds its one file.
 */
function buildIndex(root, config) {
  const files = walkFiles(root, {
    ignore: config.ignore ?? [],
    ignoreFiles: ['.gitignore', IGNORE_FILE],
  });
  const dirs = new Set();
  for (const f of files) {
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  const suffix = new Map();
  const index = (p) => {
    const parts = p.split('/');
    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(i).join('/');
      suffix.set(key, suffix.has(key) ? AMBIGUOUS : p);
    }
  };
  for (const f of files) index(f);
  for (const d of dirs) index(d);
  return { files: new Set(files), dirs, suffix };
}

/**
 * Every path git ever removed, mapped to the most recent commit that removed
 * it. `--no-renames` on purpose: a file that moved leaves its old path behind
 * in the docs, and that old path is exactly what we are being asked about.
 * A repo with no git, or a history too big to read in ten seconds, simply has
 * no evidence to offer - every unresolved path is then `unknown`, never a
 * confident accusation.
 */
function gitDeletions(root) {
  const out = new Map();
  let raw;
  try {
    raw = execFileSync(
      'git',
      ['-C', root, 'log', '--all', '--no-renames', '--diff-filter=D',
        '--name-only', '--date=short', '--format=%x00%h %ad'],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    return out;
  }
  // git log runs newest first, so the first sighting of a path is its latest
  // deletion - which is the one a reader wants to be pointed at.
  for (const commit of raw.split('\0')) {
    const lines = commit.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const [sha, date] = lines[0].split(' ');
    for (const p of lines.slice(1)) if (!out.has(p)) out.set(p, { sha, date });
  }
  return out;
}

/**
 * A checker bound to one repo. Build it once per run - it walks the tree and
 * reads git history, and both are wasted if done per document.
 */
export function createRefChecker(root, config) {
  const index = buildIndex(root, config);
  const deleted = gitDeletions(root);
  const deletedDirs = new Set();
  for (const p of deleted.keys()) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) deletedDirs.add(parts.slice(0, i).join('/'));
  }

  /** The bases a path written in `docPath` could be relative to, best first. */
  const basesFor = (docPath, moduleRoot) => {
    const out = [];
    const dir = docPath && docPath.includes('/') ? docPath.slice(0, docPath.lastIndexOf('/')) : '';
    if (dir) out.push(dir);
    // The base the extractor keeps missing. Feature docs are written from the
    // module root - `components/X.tsx`, `specs/FLOW_Y.md` - not from their own
    // folder and not from the repo root.
    if (moduleRoot && !out.includes(moduleRoot)) out.push(moduleRoot);
    out.push('');
    return out;
  };

  /** Where a written path actually points, or null. */
  const resolve = (raw, docPath, moduleRoot) => {
    const cand = norm(raw);
    if (!cand || ESCAPES_REPO.test(cand)) return null;
    for (const base of basesFor(docPath, moduleRoot)) {
      const full = norm(base ? `${base}/${cand}` : cand);
      if (index.files.has(full)) return { path: full, isDir: false };
      if (index.dirs.has(full)) return { path: full, isDir: true };
    }
    const hit = index.suffix.get(cand);
    if (hit && hit !== AMBIGUOUS) return { path: hit, isDir: index.dirs.has(hit) };
    return null;
  };

  /**
   * Why an unresolved path is unresolved. Call only after `resolve` returned
   * null - a path that resolves is not a finding at all.
   */
  const verdict = (raw, docPath, moduleRoot) => {
    const cand = norm(raw);
    if (ESCAPES_REPO.test(cand)) return { status: 'external', path: cand };
    for (const base of basesFor(docPath, moduleRoot)) {
      const full = norm(base ? `${base}/${cand}` : cand);
      const gone = deleted.get(full);
      if (gone) return { status: 'deleted', path: full, sha: gone.sha, date: gone.date };
      if (deletedDirs.has(full)) return { status: 'deleted', path: full };
    }
    return { status: 'unknown', path: cand };
  };

  return { resolve, verdict, hasHistory: deleted.size > 0 };
}
