// JavaScript / TypeScript import-specifier extraction.
//
// Deliberately regex-based rather than AST-based: a full parse of ~1300 files
// costs seconds we do not have, and a missed import is far cheaper than a slow
// tool. Comments are stripped first (see comments.mjs), because a commented-out
// import produces an edge that is not merely missing but wrong.

import { stripCLikeComments } from './comments.mjs';

/** Kept for backwards compatibility - the stripper now lives in comments.mjs. */
export const stripComments = stripCLikeComments;

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
  const code = stripCLikeComments(src);
  const found = new Set();
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) found.add(m[1]);
  }
  return [...found];
}
