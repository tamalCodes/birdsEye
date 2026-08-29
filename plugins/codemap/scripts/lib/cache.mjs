// mtime/size manifest. This is what makes the second run cheap, which is what
// makes the map get regenerated, which is what keeps it true. Treat it as a
// feature rather than an optimisation.

import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR } from './const.mjs';

export const cachePath = (root, file) => path.join(root, CACHE_DIR, file);

export function ensureCacheDir(root) {
  fs.mkdirSync(path.join(root, CACHE_DIR), { recursive: true });
}

export function readCacheJson(root, file) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(root, file), 'utf8'));
  } catch {
    return null;
  }
}

export function writeCacheJson(root, file, data) {
  ensureCacheDir(root);
  fs.writeFileSync(cachePath(root, file), `${JSON.stringify(data, null, 2)}\n`);
}

/** Stamp for one file: mtime in ms plus size. Cheap and good enough. */
export function stampOf(root, rel) {
  try {
    const st = fs.statSync(path.join(root, rel));
    return { mtime: Math.floor(st.mtimeMs), size: st.size };
  } catch {
    return null;
  }
}

export function buildStamps(root, relPaths) {
  const out = {};
  for (const rel of relPaths.slice().sort()) {
    const stamp = stampOf(root, rel);
    if (stamp) out[rel] = stamp;
  }
  return out;
}

export const stampsEqual = (a, b) => !!a && !!b && a.mtime === b.mtime && a.size === b.size;

/**
 * Compare a fresh stamp set against a stored one.
 * @returns {{changed:string[], removed:string[], unchanged:string[], dirty:boolean}}
 */
export function diffStamps(fresh, stored) {
  const changed = [];
  const unchanged = [];
  for (const [rel, stamp] of Object.entries(fresh)) {
    if (stampsEqual(stamp, stored?.[rel])) unchanged.push(rel);
    else changed.push(rel);
  }
  const removed = Object.keys(stored ?? {}).filter((rel) => !(rel in fresh));
  return { changed, removed, unchanged, dirty: changed.length > 0 || removed.length > 0 };
}

export function readManifest(root) {
  return readCacheJson(root, 'manifest.json') ?? { version: 1, stages: {} };
}

export function writeManifest(root, manifest) {
  writeCacheJson(root, 'manifest.json', manifest);
}
