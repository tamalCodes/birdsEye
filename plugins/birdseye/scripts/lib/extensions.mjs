// Which files birdsEye reads, in one place.
//
// Both halves of the pipeline need this list and they must not drift. The
// extractor decides what to parse; the folder taxonomy decides what counts as
// code when working out where the code root is and which folders are features.
// When the two disagree the map goes quietly wrong rather than failing - a
// Flutter app whose every file is `.dart` gets a correct dependency graph hung
// off a folder tree that believes the repo contains no code at all.

import path from 'node:path';

// Extensions birdsEye can parse to an AST. A file outside this set still counts
// toward its folder's file total (see build.mjs) - it just has no import edges.
export const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.svelte', '.astro',
  '.py', '.go', '.rs', '.rb', '.java', '.kt', '.kts', '.scala',
  '.cs', '.php', '.swift', '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp',
  '.lua', '.ex', '.exs', '.jl', '.zig', '.m',
  '.sh', '.bash', '.groovy', '.gradle',
  '.dart', '.sql', '.tf', '.tfvars', '.hcl', '.ps1', '.psm1', '.psd1',
  '.mm', '.cu', '.cuh', '.metal', '.rake', '.luau', '.ets',
  '.ml', '.mli', '.f', '.f90', '.f95', '.f03', '.f08',
  '.v', '.sv', '.svh', '.vh', '.pas', '.pp', '.dpr', '.dpk', '.lpr',
  '.lisp', '.cl', '.lsp', '.asd', '.pl', '.pm',
  '.csproj', '.fsproj', '.vbproj', '.props', '.targets',
];

// JSON is not a code extension: parsing every `.json` would make a lockfile a
// node in the map and cost more than the whole rest of the repo. Only the
// config files that genuinely point at another config file are read, for their
// `extends` chain.
export const EXTRA_PARSE_FILE_RE = /^[jt]sconfig(\..+)?\.json$/i;

export const isParseable = (rel) =>
  CODE_EXTENSIONS.includes(path.extname(rel).toLowerCase()) ||
  EXTRA_PARSE_FILE_RE.test(rel.slice(rel.lastIndexOf('/') + 1));
