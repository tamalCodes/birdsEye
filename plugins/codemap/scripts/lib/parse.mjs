// Comment stripping and import-specifier extraction.
//
// Deliberately regex-based rather than AST-based: a full parse of ~1300 files
// costs seconds we do not have, and a missed import is far cheaper than a slow
// tool. Comments are stripped first, because a commented-out import produces an
// edge that is not merely missing but wrong.

/**
 * Remove line and block comments while preserving string, template and regex
 * literals. The regex-literal heuristic is the standard one: a `/` starts a
 * regex when the previous significant character cannot end an expression.
 */
export function stripComments(src) {
  let out = '';
  let i = 0;
  let prev = '';
  const n = src.length;

  const canPrecedeRegex = (c) =>
    c === '' || '(,=:[!&|?{};+-*%~^<>\n'.includes(c);

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      out += c;
      i++;
      while (i < n) {
        out += src[i];
        if (src[i] === '\\') {
          out += src[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (src[i] === c) {
          i++;
          break;
        }
        if (src[i] === '\n') {
          i++;
          break;
        }
        i++;
      }
      prev = c;
      continue;
    }
    if (c === '`') {
      // Template literals may nest `${ ... }` containing further literals, but
      // copying verbatim to the matching backtick is enough for our purposes:
      // we only need `import(...)` specifiers, never template content.
      out += c;
      i++;
      while (i < n) {
        out += src[i];
        if (src[i] === '\\') {
          out += src[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (src[i] === '`') {
          i++;
          break;
        }
        i++;
      }
      prev = '`';
      continue;
    }
    if (c === '/' && canPrecedeRegex(prev)) {
      // Regex literal - copy through to the unescaped closing slash.
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const d = src[j];
        if (d === '\\') {
          j += 2;
          continue;
        }
        if (d === '\n') break;
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) {
          closed = true;
          j++;
          break;
        }
        j++;
      }
      if (closed) {
        out += src.slice(i, j);
        i = j;
        prev = '/';
        continue;
      }
    }

    out += c;
    if (!/\s/.test(c)) prev = c;
    else if (c === '\n') prev = '\n';
    i++;
  }
  return out;
}

const PATTERNS = [
  // import x from 'y' / import 'y' / import type {..} from 'y'
  /\bimport\s+(?:type\s+)?(?:[^'";]*?\bfrom\s*)?['"]([^'"]+)['"]/g,
  // export ... from 'y'
  /\bexport\s+(?:type\s+)?[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g,
  // require('y') and dynamic import('y')
  /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // jest.mock('y') and friends keep the dependency real at runtime
  /\bjest\.(?:mock|unmock|requireActual)\s*\(\s*['"]([^'"]+)['"]/g,
];

/** Extract every module specifier in a source file. Deduplicated, ordered. */
export function extractSpecifiers(src) {
  const code = stripComments(src);
  const found = new Set();
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) found.add(m[1]);
  }
  return [...found];
}
