#!/usr/bin/env node
// graph.json -> one self-contained index.html.
//
//   node render.mjs [repoRoot]
//
// No build step, no bundler, no network at render time and none at open time:
// the libraries are vendored beside this file and inlined into the output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAME, OUT_DIR } from './lib/const.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Order matters: fcose reads the coseBase global, which reads layoutBase.
const VENDOR = ['cytoscape.min.js', 'layout-base.min.js', 'cose-base.min.js', 'fcose.min.js'];

/** Neutralise anything that could close the surrounding <script> element. */
const safeForScript = (s) => s.replace(/<\/(script)/gi, '<\\/$1');

export function renderHtml(graph) {
  const template = fs.readFileSync(path.join(here, 'template', 'index.html'), 'utf8');
  const vendor = VENDOR.map((f) => fs.readFileSync(path.join(here, 'vendor', f), 'utf8')).join('\n;\n');
  const title = `${graph.repo?.name ?? 'repo'} ${NAME}`;
  const storageKey = `${NAME}:${graph.repo?.name ?? 'repo'}`;
  // Function replacements throughout: a repo name containing `$` would
  // otherwise be read as a substitution pattern.
  return template
    .replace(/__TITLE__/g, () => title.replace(/[<&]/g, ''))
    .replace('__STORAGE_KEY__', () => storageKey)
    .replace('__VENDOR__', () => safeForScript(vendor))
    .replace('__GRAPH__', () => safeForScript(JSON.stringify(graph)));
}

export function render(root) {
  const graphPath = path.join(root, OUT_DIR, 'graph.json');
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const outPath = path.join(root, OUT_DIR, 'index.html');
  const html = renderHtml(graph);
  fs.writeFileSync(outPath, html);
  return { outPath, bytes: Buffer.byteLength(html) };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const { outPath, bytes } = render(root);
  console.log(`${outPath}  (${(bytes / 1024).toFixed(0)} KB)`);
}
