#!/usr/bin/env node
// The folder-taxonomy pass.
//
//   node structure.mjs scan     [repoRoot]   analyse the filesystem, write
//                                            birdseye/.cache/structure.scan.json
//   node structure.mjs check    [repoRoot]   validate birdseye/.cache/structure.json
//   node structure.mjs estimate [repoRoot]   rough token cost of a full map build
//
// `scan` does the mechanical part - where the code root is, which folders look
// like features, which look like infrastructure. The `extract-structure` skill
// reads that, applies judgement, asks the user about anything genuinely
// ambiguous, and writes the real birdseye/.cache/structure.json. `check` then
// confirms that file is well formed before the rest of the pipeline trusts it.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { analyzeStructure } from './lib/taxonomy.mjs';
import { walkFiles } from './lib/walk.mjs';
import { readCacheJson, writeCacheJson } from './lib/cache.mjs';
import { IGNORE_FILE } from './lib/const.mjs';

function scan(root) {
  const { config } = loadConfig(root);
  const routes = readCacheJson(root, 'routes.json');
  const analysis = analyzeStructure(root, { ignore: config.ignore, routes });
  writeCacheJson(root, 'structure.scan.json', analysis);
  return analysis;
}

function summarise(a) {
  const out = [];
  out.push(`code root(s): ${a.codeRoots.map((c) => c || '<repo root>').join(', ')}`);
  for (const r of a.roots) {
    out.push('');
    out.push(`${r.codeRoot || '<repo root>'}/`);
    out.push(`  entry points: ${r.entryPoints.join(', ') || '(none detected)'}`);
    for (const c of r.candidates) {
      out.push(
        `  ${c.guess.padEnd(9)} ${c.name.padEnd(20)} ${String(c.codeFileCount).padStart(4)} files` +
          `  conf ${c.confidence.toFixed(2)}  ${c.reasons[0] || ''}`,
      );
    }
  }
  return out.join('\n');
}

function check(root) {
  const s = readCacheJson(root, 'structure.json');
  const errs = [];
  if (!s) return ['birdseye/.cache/structure.json is missing - the extract-structure skill did not run'];
  if (typeof s.codeRoot !== 'string') errs.push('codeRoot must be a string (use "" for the repo root)');
  for (const key of ['featureModules', 'sharedModules']) {
    if (!Array.isArray(s[key])) {
      errs.push(`${key} must be an array`);
      continue;
    }
    s[key].forEach((m, i) => {
      if (!m || typeof m.slug !== 'string' || typeof m.path !== 'string') {
        errs.push(`${key}[${i}] needs a "slug" and a "path"`);
      } else if (!fs.existsSync(path.join(root, m.path))) {
        errs.push(`${key}[${i}] path is not on disk: ${m.path}`);
      }
    });
  }
  for (const p of s.entryPoints ?? []) {
    if (!fs.existsSync(path.join(root, p))) errs.push(`entryPoint is not on disk: ${p}`);
  }
  const slugs = [...(s.featureModules ?? []), ...(s.sharedModules ?? [])].map((m) => m && m.slug);
  const dupes = slugs.filter((x, i) => x && slugs.indexOf(x) !== i);
  if (dupes.length) errs.push(`duplicate slug(s): ${[...new Set(dupes)].join(', ')}`);
  return errs;
}

// A deliberately loose model: reading N bytes of docs costs ~N/3.5 tokens, and
// the extract passes spend somewhere between 1x and 2.5x that on top for
// re-reading source, reasoning and output. Good to a factor of ~2, which is all
// anyone needs to decide whether to hit go.
function estimate(root) {
  const { config } = loadConfig(root);
  const files = walkFiles(root, { ignore: config.ignore, ignoreFiles: ['.gitignore', IGNORE_FILE] });
  const docs = files.filter((f) => f.endsWith('.md'));
  let docBytes = 0;
  for (const d of docs) {
    try {
      docBytes += fs.statSync(path.join(root, d)).size;
    } catch {
      /* unreadable - skip */
    }
  }
  const codeFiles = files.filter((f) => config.extensions.includes(path.extname(f)));
  const readTokens = Math.round(docBytes / 3.5);
  const low = Math.round(readTokens * 1.1 + 100_000);
  const high = Math.round(readTokens * 2.5 + 220_000);
  return { docs: docs.length, docBytes, codeFiles: codeFiles.length, tokensLow: low, tokensHigh: high };
}

const fmt = (n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`);

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const [cmd, maybeRoot] = process.argv.slice(2);
  const root = path.resolve(maybeRoot ?? process.cwd());
  if (cmd === 'scan') {
    console.log(summarise(scan(root)));
    console.log('\nwrote birdseye/.cache/structure.scan.json');
  } else if (cmd === 'check') {
    const errs = check(root);
    if (errs.length) {
      console.error(`structure.json has ${errs.length} problem(s):`);
      for (const e of errs) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log('structure.json looks good');
  } else if (cmd === 'estimate') {
    const e = estimate(root);
    console.log(JSON.stringify(e, null, 2));
    console.log(
      `\n~${fmt(e.tokensLow)} - ${fmt(e.tokensHigh)} tokens for a full build ` +
        `(${e.docs} docs, ${fmt(e.docBytes)} of doc text). Near zero on a cached re-run.`,
    );
  } else {
    console.error('usage: structure.mjs scan|check|estimate [repoRoot]');
    process.exit(2);
  }
}

export { scan, check, estimate, summarise };
