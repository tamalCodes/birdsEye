// The bridge to birdsEye's own source extractor.
//
// Extraction is a local, token-free tree-sitter parse that birdsEye owns end to
// end: lib/py/extract.py does the parsing, the language modules in lib/languages/
// do the resolving. This module owns the one piece that needs care - getting a
// Python interpreter that has tree-sitter and the grammars importable - and then
// shells out to the extractor for the actual work.
//
// The interpreter, in order of preference:
//   1. $BIRDSEYE_PYTHON                        - explicit override
//   2. birdseye/.cache/py/                     - venv birdsEye manages itself
//   3. a python3 on PATH that already has tree-sitter
//   4. otherwise: create the venv in (2) and pip-install the pinned grammars
//
// Nothing here calls a model. The only network access is the one-time
// `pip install` when the venv is first created.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CACHE_DIR } from './const.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXTRACTOR = path.join(here, 'py', 'extract.py');

// tree-sitter is the parsing engine; every other entry is one language grammar.
// Pinned exactly, and deliberately: a grammar bump can rename node types, which
// is exactly the kind of change that silently thins a map rather than failing
// loudly. Bump one consciously, re-run the corpus, and diff the edge counts.
export const CORE_PIN = 'tree-sitter==0.25.2';

// Grammars split by how birdsEye behaves when one is unavailable.
//
// CORE is the set a general-purpose code map is useless without. If one of
// these cannot be imported the interpreter is rejected and a managed venv is
// built, because a Python that silently cannot parse TypeScript would produce a
// map with no edges that still looks like a real map.
//
// OPTIONAL is everything else. These are installed too, but a platform with no
// wheel for one of them costs that language's edges and nothing more - the run
// reports it by name rather than failing or rebuilding the venv. The long tail
// is exactly where wheels are missing or young, so demanding all of them would
// make the common case hostage to the rare one.
export const CORE_GRAMMAR_PINS = [
  'tree-sitter-typescript==0.23.2',
  'tree-sitter-javascript==0.25.0',
  'tree-sitter-python==0.25.0',
  'tree-sitter-go==0.25.0',
  'tree-sitter-rust==0.24.2',
  'tree-sitter-java==0.23.5',
  'tree-sitter-c-sharp==0.23.5',
  'tree-sitter-ruby==0.23.1',
  'tree-sitter-php==0.24.1',
  'tree-sitter-c==0.24.2',
  'tree-sitter-cpp==0.23.4',
  'tree-sitter-json==0.24.8',
];
export const OPTIONAL_GRAMMAR_PINS = [
  'tree-sitter-kotlin==1.1.0',
  'tree-sitter-scala==0.26.2',
  'tree-sitter-swift==0.7.3',
  'tree-sitter-objc==3.0.2',
  'tree-sitter-lua==0.5.0',
  'tree-sitter-elixir==0.3.5',
  'tree-sitter-julia==0.23.1',
  'tree-sitter-zig==1.1.2',
  'tree-sitter-bash==0.25.1',
  'tree-sitter-groovy==0.1.2',
  'tree-sitter-sql==0.3.11',
  'tree-sitter-hcl==1.2.0',
  'tree-sitter-powershell==0.26.4',
  'tree-sitter-dart==0.1.0',
  'tree-sitter-ocaml==0.25.0',
  'tree-sitter-fortran==0.6.0',
  'tree-sitter-verilog==1.0.3',
  'tree-sitter-pascal==0.11.0',
  'tree-sitter-commonlisp==0.4.1',
  'tree-sitter-perl==1.2.1',
  'tree-sitter-xml==0.7.0',
];
export const GRAMMAR_PINS = [...CORE_GRAMMAR_PINS, ...OPTIONAL_GRAMMAR_PINS];
export const ALL_PINS = [CORE_PIN, ...GRAMMAR_PINS];

// The oldest tree-sitter whose Python binding takes a Language in the Parser
// constructor. Below that the extractor would need a different call shape, so
// an older interpreter is rejected rather than half-used.
const CORE_MIN = [0, 23, 0];

const IS_WIN = process.platform === 'win32';
const venvPython = (dir) =>
  IS_WIN ? path.join(dir, 'Scripts', 'python.exe') : path.join(dir, 'bin', 'python');

// Readiness is the core set. A missing optional grammar is reported by name in
// the run summary instead, which is the honest answer: that language has no
// edges, everything else is unaffected.
const PROBE_GRAMMARS = CORE_GRAMMAR_PINS.map((pin) => pin.split('==')[0].replace(/-/g, '_'));

const VERSION_CHECK = [
  'import sys',
  'import tree_sitter',
  'from tree_sitter import Language, Parser',
  'try:',
  '    from importlib.metadata import version',
  '    v = version("tree-sitter")',
  'except Exception:',
  '    v = getattr(tree_sitter, "__version__", "0")',
  'parts = []',
  'for p in str(v).split(".")[:3]:',
  '    n = "".join(c for c in p if c.isdigit())',
  '    parts.append(int(n) if n else 0)',
  'while len(parts) < 3: parts.append(0)',
  `if tuple(parts) < tuple(${JSON.stringify(CORE_MIN)}): sys.exit(7)`,
  `for m in ${JSON.stringify(PROBE_GRAMMARS)}:`,
  '    __import__(m)',
  'sys.exit(0)',
].join('\n');

function canExtract(python) {
  if (!python) return false;
  const r = spawnSync(python, ['-c', VERSION_CHECK], { stdio: 'ignore', timeout: 30_000 });
  return r.status === 0;
}

function which(cmd) {
  const r = spawnSync(IS_WIN ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split('\n')[0].trim() || null;
}

/**
 * Install `pins`, and if the batch fails try them one at a time so that one
 * unavailable wheel costs its own language rather than every language after it.
 * Returns the pins that could not be installed.
 */
function installBestEffort(run, pins) {
  if (!pins.length) return [];
  if (run(pins).status === 0) return [];
  return pins.filter((pin) => run([pin]).status !== 0);
}

function createVenv(dir) {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const uv = which('uv');
  if (uv) {
    const mk = spawnSync(uv, ['venv', dir], { encoding: 'utf8', timeout: 120_000 });
    if (mk.status !== 0) throw new Error(`uv venv failed:\n${mk.stderr || mk.stdout}`);
    const py = venvPython(dir);
    const run = (pins) =>
      spawnSync(uv, ['pip', 'install', '--python', py, ...pins], { encoding: 'utf8', timeout: 600_000 });
    const core = run([CORE_PIN, ...CORE_GRAMMAR_PINS]);
    if (core.status !== 0) throw new Error(`uv pip install failed:\n${core.stderr || core.stdout}`);
    const skipped = installBestEffort(run, OPTIONAL_GRAMMAR_PINS);
    if (skipped.length) {
      process.stderr.write(`birdsEye: no wheel here for ${skipped.join(', ')}; those languages get no edges\n`);
    }
    return py;
  }
  const base = which('python3') || which('python');
  if (!base) {
    throw new Error(
      'No Python found. birdsEye needs Python 3.10+ (and ideally `uv`) to run its\n' +
        'tree-sitter extractor. Install one, or point $BIRDSEYE_PYTHON at an\n' +
        `interpreter that has them: pip install ${CORE_PIN} ...`,
    );
  }
  const mk = spawnSync(base, ['-m', 'venv', dir], { encoding: 'utf8', timeout: 120_000 });
  if (mk.status !== 0) throw new Error(`python -m venv failed:\n${mk.stderr || mk.stdout}`);
  const py = venvPython(dir);
  const run = (pins) =>
    spawnSync(py, ['-m', 'pip', 'install', '-q', ...pins], { encoding: 'utf8', timeout: 600_000 });
  const core = run([CORE_PIN, ...CORE_GRAMMAR_PINS]);
  if (core.status !== 0) throw new Error(`pip install failed:\n${core.stderr || core.stdout}`);
  const skipped = installBestEffort(run, OPTIONAL_GRAMMAR_PINS);
  if (skipped.length) {
    process.stderr.write(`birdsEye: no wheel here for ${skipped.join(', ')}; those languages get no edges\n`);
  }
  return py;
}

/**
 * A Python executable that can run the extractor, creating a managed venv if
 * that is what it takes. Result is cached in-process.
 * @param {string} root  absolute repo root
 * @param {{ setup?: boolean }} opts  setup:false = never install, just probe
 */
let cachedPython = null;
export function resolvePython(root, { setup = true } = {}) {
  if (cachedPython && canExtract(cachedPython)) return cachedPython;

  const override = process.env.BIRDSEYE_PYTHON;
  if (override) {
    if (!canExtract(override)) {
      throw new Error(
        `$BIRDSEYE_PYTHON (${override}) cannot run the extractor. Install its\n` +
          `dependencies there:\n  ${override} -m pip install ${ALL_PINS.join(' ')}`,
      );
    }
    return (cachedPython = override);
  }

  const venvDir = path.join(root, CACHE_DIR, 'py');
  const managed = venvPython(venvDir);
  if (fs.existsSync(managed) && canExtract(managed)) return (cachedPython = managed);

  const onPath = which('python3') || which('python');
  if (onPath && canExtract(onPath)) return (cachedPython = onPath);

  if (!setup) return null;
  return (cachedPython = createVenv(venvDir));
}

/**
 * Non-destructive readiness probe for `init.mjs status`. Never installs.
 * @returns {{ found: boolean, ready: boolean, python: string|null, note: string }}
 */
export function probePython(root) {
  const ready = resolvePython(root, { setup: false });
  if (ready) {
    return { found: true, ready: true, python: ready, note: 'the extractor is installed and ready' };
  }
  const anyPython =
    process.env.BIRDSEYE_PYTHON || which('uv') || which('python3') || which('python');
  if (anyPython) {
    return {
      found: true,
      ready: false,
      python: null,
      note:
        'Python is available; the first run will create birdseye/.cache/py/ and install ' +
        `tree-sitter plus ${GRAMMAR_PINS.length} language grammars`,
    };
  }
  return {
    found: false,
    ready: false,
    python: null,
    note: 'No Python found - install Python 3.10+ (and ideally uv) before running the map',
  };
}

/**
 * Parse `files` (repo-relative paths) and return one record per file:
 * `{ path, lang, loc, symbols, imports: [{spec, kind}], declares: [] }`.
 *
 * Nothing here is resolved - turning a specifier into a file is the language
 * modules' job, because only they know about tsconfig aliases, go.mod module
 * paths and Python source roots.
 *
 * @param {string} root  absolute repo root
 * @param {{ files: string[], python?: string }} opts
 */
export function runExtraction(root, { files, python }) {
  const py = python || resolvePython(root);
  const cacheDir = path.join(root, CACHE_DIR);
  const job = JSON.stringify({ repoRoot: root, cacheDir, files });

  const spawn = (interpreter) =>
    spawnSync(interpreter, [EXTRACTOR], {
      input: job,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: 20 * 60_000,
    });

  let r = spawn(py);
  if (r.status === 3) {
    // tree-sitter vanished from the interpreter between resolve and run -
    // install once more into the managed venv and retry.
    cachedPython = null;
    r = spawn(resolvePython(root));
  }
  if (r.status !== 0) {
    throw new Error(`extractor exited ${r.status}:\n${(r.stderr || r.stdout || '').trim()}`);
  }
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new Error(`extractor produced non-JSON output:\n${r.stdout.slice(0, 500)}`);
  }
}
