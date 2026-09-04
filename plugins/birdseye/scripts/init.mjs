#!/usr/bin/env node
// First-run setup. Nothing here happens without being asked for.
//
//   node init.mjs status    [repoRoot]   what exists, and what would be inferred
//   node init.mjs write     [repoRoot]   write birdseye.config.json
//   node init.mjs gitignore [repoRoot]   add the output dir to .gitignore

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, inferConfig } from './lib/config.mjs';
import { probePython } from './lib/graphify.mjs';
import { CONFIG_FILE, OUT_DIR } from './lib/const.mjs';

const IGNORE_LINE = `${OUT_DIR}/`;

export function status(root) {
  const configPath = path.join(root, CONFIG_FILE);
  const gitignorePath = path.join(root, '.gitignore');
  let gitignore = '';
  try {
    gitignore = fs.readFileSync(gitignorePath, 'utf8');
  } catch {
    gitignore = '';
  }
  const ignored = gitignore
    .split('\n')
    .some((l) => l.trim() === IGNORE_LINE || l.trim() === OUT_DIR || l.trim() === `/${IGNORE_LINE}`);
  return {
    configExists: fs.existsSync(configPath),
    configPath,
    gitignoreExists: fs.existsSync(gitignorePath),
    outputIgnored: ignored,
    isGitRepo: fs.existsSync(path.join(root, '.git')),
    python: probePython(root),
    inferred: inferConfig(root),
    effective: loadConfig(root).config,
  };
}

export function write(root) {
  const config = loadConfig(root).config;
  fs.writeFileSync(path.join(root, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

export function gitignore(root) {
  const p = path.join(root, '.gitignore');
  let text = '';
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch {
    text = '';
  }
  if (text.split('\n').some((l) => l.trim() === IGNORE_LINE || l.trim() === OUT_DIR)) return false;
  const prefix = text && !text.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(p, `${text}${prefix}\n# ${OUT_DIR} - generated, regenerate with the map command\n${IGNORE_LINE}\n`);
  return true;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const [cmd, maybeRoot] = process.argv.slice(2);
  const root = path.resolve(maybeRoot ?? process.cwd());
  if (cmd === 'status') console.log(JSON.stringify(status(root), null, 2));
  else if (cmd === 'write') console.log(`wrote ${CONFIG_FILE}\n${JSON.stringify(write(root), null, 2)}`);
  else if (cmd === 'gitignore') console.log(gitignore(root) ? `added ${IGNORE_LINE} to .gitignore` : 'already ignored');
  else {
    console.error('usage: init.mjs status|write|gitignore [repoRoot]');
    process.exit(2);
  }
}
