// The bridge to graphify's deterministic AST extractor.
//
// birdsEye's extraction stage is now entirely graphify: a local, token-free
// tree-sitter parse. This module owns the one piece that needs care - getting a
// Python interpreter that has `graphify` importable - and then shells out to
// lib/py/bridge.py for the actual work.
//
// The interpreter, in order of preference:
//   1. $BIRDSEYE_PYTHON                        - explicit override
//   2. birdseye/.cache/py/                     - venv birdsEye manages itself
//   3. a python3 on PATH that already imports graphify
//   4. otherwise: create the venv in (2) and pip-install the pinned version
//
// Nothing here calls a model. The only network access is the one-time
// `pip install graphifyy` when the venv is first created.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CACHE_DIR } from './const.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(here, 'py', 'bridge.py');

// Pinned deliberately: graphify is pre-1.0 and its extraction output shape has
// changed between minor versions. Bump this consciously, re-run the corpus, and
// eyeball a diff before shipping.
export const GRAPHIFY_PIN = 'graphifyy==0.9.53';

// The oldest graphify whose extract() emits the `imports`/`imports_from`
// relations birdsEye's dependency graph is built from. Anything older (the
// MIT-era 0.4.x line) only produces `contains`/`calls` and would silently give
// a far thinner map, so it is rejected rather than used.
const GRAPHIFY_MIN = [0, 9, 0];

const IS_WIN = process.platform === 'win32';
const venvPython = (dir) =>
  IS_WIN ? path.join(dir, 'Scripts', 'python.exe') : path.join(dir, 'bin', 'python');

const VERSION_CHECK = [
  'import sys',
  'try:',
  '    from importlib.metadata import version',
  '    v = version("graphifyy")',
  'except Exception:',
  '    import graphify; v = getattr(graphify, "__version__", "0")',
  'parts = []',
  'for p in str(v).split(".")[:3]:',
  '    n = "".join(c for c in p if c.isdigit())',
  '    parts.append(int(n) if n else 0)',
  'while len(parts) < 3: parts.append(0)',
  `sys.exit(0 if tuple(parts) >= tuple(${JSON.stringify(GRAPHIFY_MIN)}) else 7)`,
].join('\n');

function canImportGraphify(python) {
  if (!python) return false;
  const r = spawnSync(python, ['-c', VERSION_CHECK], { stdio: 'ignore', timeout: 30_000 });
  return r.status === 0;
}

function which(cmd) {
  const r = spawnSync(IS_WIN ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split('\n')[0].trim() || null;
}

function createVenv(dir) {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const uv = which('uv');
  if (uv) {
    const mk = spawnSync(uv, ['venv', dir], { encoding: 'utf8', timeout: 120_000 });
    if (mk.status !== 0) throw new Error(`uv venv failed:\n${mk.stderr || mk.stdout}`);
    const py = venvPython(dir);
    const inst = spawnSync(uv, ['pip', 'install', '--python', py, GRAPHIFY_PIN], {
      encoding: 'utf8',
      timeout: 600_000,
    });
    if (inst.status !== 0) throw new Error(`uv pip install failed:\n${inst.stderr || inst.stdout}`);
    return py;
  }
  const base = which('python3') || which('python');
  if (!base) {
    throw new Error(
      'No Python found. birdsEye needs Python 3.10+ (and ideally `uv`) to run its\n' +
        'AST extractor. Install one, or point $BIRDSEYE_PYTHON at an interpreter\n' +
        `that has graphify: pip install ${GRAPHIFY_PIN}`,
    );
  }
  const mk = spawnSync(base, ['-m', 'venv', dir], { encoding: 'utf8', timeout: 120_000 });
  if (mk.status !== 0) throw new Error(`python -m venv failed:\n${mk.stderr || mk.stdout}`);
  const py = venvPython(dir);
  const inst = spawnSync(py, ['-m', 'pip', 'install', '-q', GRAPHIFY_PIN], {
    encoding: 'utf8',
    timeout: 600_000,
  });
  if (inst.status !== 0) throw new Error(`pip install failed:\n${inst.stderr || inst.stdout}`);
  return py;
}

/**
 * A Python executable that can `import graphify`, creating a managed venv if
 * that is what it takes. Result is cached in-process.
 * @param {string} root  absolute repo root
 * @param {{ setup?: boolean }} opts  setup:false = never install, just probe
 */
let cachedPython = null;
export function resolvePython(root, { setup = true } = {}) {
  if (cachedPython && canImportGraphify(cachedPython)) return cachedPython;

  const override = process.env.BIRDSEYE_PYTHON;
  if (override) {
    if (!canImportGraphify(override)) {
      throw new Error(
        `$BIRDSEYE_PYTHON (${override}) cannot import graphify. Install it there:\n` +
          `  ${override} -m pip install ${GRAPHIFY_PIN}`,
      );
    }
    return (cachedPython = override);
  }

  const venvDir = path.join(root, CACHE_DIR, 'py');
  const managed = venvPython(venvDir);
  if (fs.existsSync(managed) && canImportGraphify(managed)) return (cachedPython = managed);

  const onPath = which('python3') || which('python');
  if (onPath && canImportGraphify(onPath)) return (cachedPython = onPath);

  if (!setup) return null;
  return (cachedPython = createVenv(venvDir));
}

/**
 * Non-destructive readiness probe for `init.mjs status`. Never installs.
 * @returns {{ found: boolean, ready: boolean, python: string|null, note: string }}
 */
export function probePython(root) {
  const ready = resolvePython(root, { setup: false });
  if (ready) return { found: true, ready: true, python: ready, note: 'graphify is installed and importable' };
  const anyPython =
    process.env.BIRDSEYE_PYTHON || which('uv') || which('python3') || which('python');
  if (anyPython) {
    return {
      found: true,
      ready: false,
      python: null,
      note: `Python is available; the first run will create birdseye/.cache/py/ and install ${GRAPHIFY_PIN}`,
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
 * Run graphify over `files` (repo-relative paths) and return the file-level
 * dependency graph the bridge produces.
 *
 * @param {string} root  absolute repo root
 * @param {{ files: string[], python?: string }} opts
 * @returns {import('./ast-types').BridgeResult}
 */
export function runExtraction(root, { files, python }) {
  const py = python || resolvePython(root);
  const cacheDir = path.join(root, CACHE_DIR, 'graphify');
  const job = JSON.stringify({ repoRoot: root, cacheDir, files });

  const run = () =>
    spawnSync(py, [BRIDGE], {
      input: job,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: 20 * 60_000,
    });

  let r = run();
  if (r.status === 3) {
    // graphify vanished from the interpreter between resolve and run - install
    // once more into the managed venv and retry.
    cachedPython = null;
    const fresh = resolvePython(root);
    r = spawnSync(fresh, [BRIDGE], {
      input: job,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      timeout: 20 * 60_000,
    });
  }
  if (r.status !== 0) {
    throw new Error(`graphify bridge exited ${r.status}:\n${(r.stderr || r.stdout || '').trim()}`);
  }
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new Error(`graphify bridge produced non-JSON output:\n${r.stdout.slice(0, 500)}`);
  }
}
