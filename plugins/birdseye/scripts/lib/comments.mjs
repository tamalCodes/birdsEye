// Comment stripping, shared across language extractors.
//
// A commented-out import produces an edge that is not merely missing but wrong,
// so every language extractor strips comments before scanning for specifiers.
// The C-like stripper also preserves string / template / regex literals so a
// `//` inside a string is not mistaken for a comment.

/**
 * Remove `//` line and `/* *\/` block comments while preserving string,
 * template and regex literals. Correct for JavaScript, TypeScript, Go, Rust,
 * C#, Java, C and C++ - every language birdsEye parses that uses this comment
 * style. The regex-literal heuristic is the standard one: a `/` starts a regex
 * when the previous significant character cannot end an expression. It is inert
 * for languages without regex literals (the branch just never fires usefully).
 */
export function stripCLikeComments(src) {
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

/**
 * Remove `#` line comments and the contents of triple-quoted strings, for
 * Python. Single- and double-quoted strings are preserved (an import is never
 * inside one, but a `#` might be). Newlines inside a triple-quoted block are
 * kept so line-based scanning downstream still sees the right line count.
 */
export function stripHashComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const three = src.slice(i, i + 3);
    if (three === '"""' || three === "'''") {
      const quote = three;
      i += 3;
      while (i < n && src.slice(i, i + 3) !== quote) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 3;
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
        if (src[i] === c || src[i] === '\n') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
