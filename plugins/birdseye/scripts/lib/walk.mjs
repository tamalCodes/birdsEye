// File walking with layered ignore rules.
//
// Three layers, applied in this order (later layers can re-include via `!`):
//   1. config.ignore        - hard directory names, always applied at any depth
//   2. .gitignore           - per-directory, applies to that directory's subtree
//   3. .birdseyeignore       - same mechanics as .gitignore, evaluated last
//
// The gitignore subset implemented here covers: comments, blank lines, `!`
// negation, leading `/` anchoring, trailing `/` directory-only, `*`, `?`,
// `[...]` classes and `**`. That is everything the corpus repos actually use.

import fs from 'node:fs';
import path from 'node:path';

function globToRegExp(pattern, anchored) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      const atSegmentStart = i === 0 || pattern[i - 1] === '/';
      if (pattern[i + 1] === '*') {
        if (atSegmentStart && pattern[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '[') {
      let j = i + 1;
      let cls = '';
      if (pattern[j] === '!' || pattern[j] === '^') {
        cls = '^';
        j++;
      }
      for (; j < pattern.length && pattern[j] !== ']'; j++) {
        cls += pattern[j].replace(/[\\\]^]/g, '\\$&');
      }
      if (j < pattern.length) {
        re += `[${cls}]`;
        i = j;
      } else {
        re += '\\[';
      }
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${anchored ? '' : '(?:.*/)?'}${re}$`);
}

function compileRule(line) {
  let pattern = line;
  let negate = false;
  if (pattern.startsWith('!')) {
    negate = true;
    pattern = pattern.slice(1);
  }
  let dirOnly = false;
  if (pattern.endsWith('/')) {
    dirOnly = true;
    pattern = pattern.slice(0, -1);
  }
  if (!pattern) return null;
  // A pattern is anchored to the ignore file's directory if it contains a
  // slash anywhere other than as a trailing marker.
  const anchored = pattern.includes('/');
  if (pattern.startsWith('/')) pattern = pattern.slice(1);
  return { negate, dirOnly, re: globToRegExp(pattern, anchored) };
}

export function parseIgnoreFile(absPath, baseRel) {
  let text;
  try {
    text = fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
  const rules = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const rule = compileRule(line);
    if (rule) rules.push(rule);
  }
  return rules.length ? { base: baseRel, rules } : null;
}

function isIgnored(relPath, isDir, ruleSets) {
  let ignored = false;
  for (const set of ruleSets) {
    if (set.base && !relPath.startsWith(`${set.base}/`)) continue;
    const scoped = set.base ? relPath.slice(set.base.length + 1) : relPath;
    for (const rule of set.rules) {
      if (rule.dirOnly && !isDir) continue;
      if (rule.re.test(scoped)) ignored = !rule.negate;
    }
  }
  return ignored;
}

/**
 * Walk the repo, returning repo-relative POSIX paths of every non-ignored file.
 * Sorted, so callers get deterministic output for free.
 */
export function walkFiles(root, { ignore = [], ignoreFiles = ['.gitignore'] } = {}) {
  const hardIgnore = new Set(ignore);
  const out = [];

  const visit = (absDir, relDir, inheritedRuleSets) => {
    let ruleSets = inheritedRuleSets;
    for (const name of ignoreFiles) {
      const set = parseIgnoreFile(path.join(absDir, name), relDir);
      if (set) ruleSets = ruleSets === inheritedRuleSets ? [...ruleSets, set] : [...ruleSets, set];
    }

    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
      if (hardIgnore.has(entry.name)) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const abs = path.join(absDir, entry.name);
      const isDir = entry.isDirectory();
      if (entry.isSymbolicLink()) continue;
      if (isIgnored(rel, isDir, ruleSets)) continue;
      if (isDir) visit(abs, rel, ruleSets);
      else if (entry.isFile()) out.push(rel);
    }
  };

  visit(root, '', []);
  out.sort();
  return out;
}
