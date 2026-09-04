#!/usr/bin/env node
// Turn the flat AST graph into the hierarchical containment tree the viewer
// renders: root -> modules -> folders -> files, with file-level dependency
// edges the browser rolls up to whatever level is currently expanded.
//
//   node build.mjs [repoRoot]
//
// Inputs:  birdseye/.cache/ast.json           (from ast.mjs - required)
//          birdseye/.cache/structure.scan.json (from structure.mjs scan - optional)
// Output:  birdseye/graph.json                 (schema version 5)
//
// No model calls. Everything here is arithmetic over the two cache files.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { walkFiles } from './lib/walk.mjs';
import { readCacheJson } from './lib/cache.mjs';
import { GRAPH_VERSION, OUT_DIR, IGNORE_FILE } from './lib/const.mjs';
import { sharedKindOf } from './lib/taxonomy.mjs';

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const posix = (p) => p.split(path.sep).join('/');

/**
 * feature | shared for one scan candidate, deterministic (no skill in the loop).
 * A folder that owns screens or a page directory is a feature; a folder whose
 * name marks it as infrastructure is shared; anything genuinely unsure defaults
 * to feature (a visible box beats a hidden one) but is flagged.
 */
function kindOfCandidate(c) {
  if (c.guess === 'feature') return { kind: 'feature', ambiguous: false };
  if (c.guess === 'shared') return { kind: 'shared', ambiguous: false };
  if (c.hasPageDir || c.screenFilesHere > 0) return { kind: 'feature', ambiguous: false };
  if (c.nameKind) return { kind: 'shared', ambiguous: false };
  return { kind: 'feature', ambiguous: true };
}

/** Pick the code root + module list from the scan, or fall back to config. */
function taxonomy(root, config, scan) {
  const primary = scan?.primary ?? scan?.roots?.[0] ?? null;
  if (primary) {
    const codeRoot = primary.codeRoot ?? '';
    const modules = primary.candidates.map((c) => {
      const { kind, ambiguous } = kindOfCandidate(c);
      return {
        slug: c.path.split('/').pop(),
        path: c.path,
        kind,
        ambiguous,
        sharedKind: kind === 'shared' ? c.nameKind ?? sharedKindOf(c.slug ?? '') ?? 'shared' : null,
      };
    });
    return { codeRoot, modules, entryPoints: primary.entryPoints ?? [] };
  }
  // No scan: every configured moduleRoot is a feature.
  const modules = (config.moduleRoots ?? [])
    .filter((p) => !p.endsWith('/*'))
    .filter((p) => {
      try {
        return fs.statSync(path.join(root, p)).isDirectory();
      } catch {
        return false;
      }
    })
    .map((p) => ({ slug: p.split('/').pop(), path: p, kind: 'feature', ambiguous: true, sharedKind: null }));
  return { codeRoot: '', modules, entryPoints: [] };
}

export function buildGraph(root) {
  const { config } = loadConfig(root);
  const ast = readCacheJson(root, 'ast.json') ?? { files: [], edges: [], externals: [], languages: [], stats: {} };
  const scan = readCacheJson(root, 'structure.scan.json');
  const { codeRoot, modules, entryPoints } = taxonomy(root, config, scan);

  // Longest path first so a nested module wins over its parent.
  const orderedModules = modules.slice().sort((a, b) => b.path.length - a.path.length || byString(a.slug, b.slug));
  const moduleOf = (rel) => {
    for (const m of orderedModules) {
      if (rel === m.path || rel.startsWith(`${m.path}/`)) return m;
    }
    return null;
  };

  // Every walked file, for accurate folder/module file totals (docs, assets and
  // configs count toward a module's size even though only code files get nodes).
  const walked = walkFiles(root, { ignore: config.ignore, ignoreFiles: ['.gitignore', IGNORE_FILE] });
  const codeFileSet = new Set(ast.files.map((f) => f.path));
  const astFileByPath = new Map(ast.files.map((f) => [f.path, f]));

  // ---- nodes -----------------------------------------------------------
  const nodes = new Map();
  const add = (node) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
    return nodes.get(node.id);
  };
  const contains = []; // { from, to }
  const link = (from, to) => contains.push({ from, to });

  const rootLabel = codeRoot ? codeRoot.split('/').pop() : config.name;
  const rootId = 'root:.';
  add({
    id: rootId,
    type: 'root',
    label: rootLabel,
    path: codeRoot,
    parent: null,
    module: null,
    meta: { entryPoints: [], fileCount: 0, codeFileCount: 0, symbolCount: 0, descendantFiles: 0 },
  });

  const featureModules = orderedModules.filter((m) => m.kind === 'feature');
  const sharedModules = orderedModules.filter((m) => m.kind === 'shared');

  let zoneId = null;
  if (sharedModules.length) {
    zoneId = 'zone:general';
    add({
      id: zoneId,
      type: 'zone',
      label: 'General-purpose',
      path: null,
      parent: rootId,
      module: null,
      meta: { moduleCount: sharedModules.length, fileCount: 0, codeFileCount: 0, symbolCount: 0, descendantFiles: 0 },
    });
    link(rootId, zoneId);
  }

  const moduleId = (m) => `module:${m.slug}`;
  for (const m of orderedModules) {
    const id = moduleId(m);
    add({
      id,
      type: 'module',
      label: m.slug,
      path: m.path,
      parent: m.kind === 'shared' ? zoneId : rootId,
      module: m.slug,
      meta: {
        kind: m.kind,
        sharedKind: m.sharedKind,
        ambiguous: m.ambiguous,
        fileCount: 0,
        codeFileCount: 0,
        symbolCount: 0,
        descendantFiles: 0,
        fanIn: 0,
        fanOut: 0,
      },
    });
    link(m.kind === 'shared' ? zoneId : rootId, id);
  }

  // ---- folder + file nodes, per module -------------------------------
  const folderId = (rel) => `folder:${rel}`;
  const fileId = (rel) => `file:${rel}`;

  /** Ensure the chain of folder nodes from a module down to `dirRel` exists. */
  const ensureFolder = (m, dirRel) => {
    if (dirRel === m.path) return moduleId(m);
    const parentRel = dirRel.slice(0, dirRel.lastIndexOf('/'));
    const parentId = parentRel === m.path ? moduleId(m) : ensureFolder(m, parentRel);
    const id = folderId(dirRel);
    if (!nodes.has(id)) {
      add({
        id,
        type: 'folder',
        label: dirRel.slice(dirRel.lastIndexOf('/') + 1),
        path: dirRel,
        parent: parentId,
        module: m.slug,
        meta: { fileCount: 0, codeFileCount: 0, symbolCount: 0, descendantFiles: 0, fanIn: 0, fanOut: 0 },
      });
      link(parentId, id);
    }
    return id;
  };

  const looseFiles = []; // code files under codeRoot but in no module
  for (const af of ast.files) {
    const rel = af.path;
    const m = moduleOf(rel);
    if (!m) {
      if (!codeRoot || rel === codeRoot || rel.startsWith(`${codeRoot}/`)) looseFiles.push(rel);
      continue;
    }
    const dirRel = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : m.path;
    const parentId = dirRel && dirRel !== rel ? ensureFolder(m, dirRel) : moduleId(m);
    const id = fileId(rel);
    add({
      id,
      type: 'file',
      label: rel.slice(rel.lastIndexOf('/') + 1),
      path: rel,
      parent: parentId,
      module: m.slug,
      meta: {
        lang: af?.lang ?? null,
        symbolCount: af?.symbols ?? 0,
        loc: af?.loc ?? 0,
        entry: entryPoints.includes(rel) || undefined,
        fanIn: 0,
        fanOut: 0,
      },
    });
    link(parentId, id);
  }
  // Code files that sit directly in the code root, in no subdirectory module -
  // the "spine" files of a flat library (graphify/extract.py, src/index.ts).
  // They get their own synthetic module so the top level stays a handful of
  // boxes instead of a hundred loose file circles.
  let coreModuleId = null;
  if (looseFiles.length) {
    const existingSlugs = new Set(orderedModules.map((m) => m.slug));
    let slug = 'core';
    while (existingSlugs.has(slug)) slug = `${slug}-`;
    coreModuleId = `module:${slug}`;
    add({
      id: coreModuleId,
      type: 'module',
      label: codeRoot ? codeRoot.split('/').pop() : 'core',
      path: codeRoot,
      parent: rootId,
      module: slug,
      meta: {
        kind: 'feature',
        sharedKind: null,
        ambiguous: false,
        core: true,
        fileCount: 0,
        codeFileCount: 0,
        symbolCount: 0,
        descendantFiles: 0,
        fanIn: 0,
        fanOut: 0,
      },
    });
    link(rootId, coreModuleId);
    featureModules.push({ slug, path: codeRoot, kind: 'feature' });
  }
  for (const rel of looseFiles) {
    const af = astFileByPath.get(rel);
    const id = fileId(rel);
    add({
      id,
      type: 'file',
      label: rel.slice(rel.lastIndexOf('/') + 1),
      path: rel,
      parent: coreModuleId ?? rootId,
      module: coreModuleId ? coreModuleId.slice('module:'.length) : null,
      meta: {
        lang: af?.lang ?? null,
        symbolCount: af?.symbols ?? 0,
        loc: af?.loc ?? 0,
        entry: entryPoints.includes(rel) || undefined,
        fanIn: 0,
        fanOut: 0,
      },
    });
    link(coreModuleId ?? rootId, id);
  }

  // ---- file counts (all walked files, not just code) -----------------
  const bumpCounts = (rel, isCode, symbols) => {
    // Walk every containing node from the file's directory up to the root.
    let dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    const seen = new Set();
    const bumpNode = (n) => {
      if (!n || seen.has(n.id)) return;
      seen.add(n.id);
      n.meta.fileCount = (n.meta.fileCount ?? 0) + 1;
      if (isCode) {
        n.meta.codeFileCount = (n.meta.codeFileCount ?? 0) + 1;
        n.meta.symbolCount = (n.meta.symbolCount ?? 0) + symbols;
      }
    };
    // folder chain
    while (dir) {
      if (nodes.has(folderId(dir))) bumpNode(nodes.get(folderId(dir)));
      dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
    }
    const m = moduleOf(rel);
    if (m) {
      bumpNode(nodes.get(moduleId(m)));
      if (m.kind === 'shared' && zoneId) bumpNode(nodes.get(zoneId));
    } else if (coreModuleId && !rel.slice(codeRoot ? codeRoot.length + 1 : 0).includes('/')) {
      bumpNode(nodes.get(coreModuleId));
    }
    bumpNode(nodes.get(rootId));
  };
  for (const rel of walked) {
    if (codeRoot && rel !== codeRoot && !rel.startsWith(`${codeRoot}/`)) continue;
    const isCode = codeFileSet.has(rel);
    bumpCounts(rel, isCode, isCode ? astFileByPath.get(rel)?.symbols ?? 0 : 0);
  }

  // ---- path compression: fold single-child pass-through folders ------
  const childrenOf = new Map();
  for (const { from, to } of contains) {
    if (!childrenOf.has(from)) childrenOf.set(from, []);
    childrenOf.get(from).push(to);
  }
  for (const node of [...nodes.values()]) {
    if (node.type !== 'folder') continue;
    let kids = childrenOf.get(node.id) ?? [];
    // Fold while this folder holds exactly one child folder and no files.
    while (kids.length === 1 && nodes.get(kids[0])?.type === 'folder') {
      const only = nodes.get(kids[0]);
      node.label = `${node.label}/${only.label}`;
      node.path = only.path;
      node.meta = only.meta;
      // re-parent grandchildren to node
      const grand = childrenOf.get(only.id) ?? [];
      for (const g of grand) nodes.get(g).parent = node.id;
      childrenOf.set(node.id, grand);
      nodes.delete(only.id);
      kids = grand;
    }
  }
  // Rebuild contains from the (possibly rewritten) parent pointers.
  const finalContains = [];
  for (const n of nodes.values()) {
    if (n.parent && nodes.has(n.parent)) finalContains.push({ from: n.parent, to: n.id });
  }

  // ---- descendant file totals (bottom-up) ---------------------------
  const kids2 = new Map();
  for (const { from, to } of finalContains) {
    if (!kids2.has(from)) kids2.set(from, []);
    kids2.get(from).push(to);
  }
  const countDesc = (id) => {
    const n = nodes.get(id);
    if (n.type === 'file') {
      n.meta.descendantFiles = 0;
      return 1;
    }
    let total = 0;
    for (const c of kids2.get(id) ?? []) total += countDesc(c);
    n.meta.descendantFiles = total;
    return total;
  };
  countDesc(rootId);
  if (nodes.get(rootId).meta.entryPoints) {
    nodes.get(rootId).meta.entryPoints = entryPoints.filter((e) => nodes.has(fileId(e)));
  }

  // ---- dependency edges (file level only; viewer rolls them up) -----
  const depends = [];
  for (const e of ast.edges) {
    const from = fileId(e.from);
    const to = fileId(e.to);
    if (!nodes.has(from) || !nodes.has(to)) continue;
    depends.push({ from, to, type: 'depends', weight: e.weight, kinds: e.kinds });
    nodes.get(from).meta.fanOut = (nodes.get(from).meta.fanOut ?? 0) + 1;
    nodes.get(to).meta.fanIn = (nodes.get(to).meta.fanIn ?? 0) + 1;
  }

  // Roll fan-in/out up to modules so the collapsed top-level view can size boxes.
  const ancestors = (id) => {
    const out = [];
    let cur = nodes.get(id)?.parent;
    while (cur) {
      out.push(cur);
      cur = nodes.get(cur)?.parent;
    }
    return out;
  };
  const modFan = new Map();
  for (const e of depends) {
    const fromMods = new Set([nodes.get(e.from).module, ...ancestors(e.from).map((a) => nodes.get(a)?.module)].filter(Boolean));
    const toMods = new Set([nodes.get(e.to).module, ...ancestors(e.to).map((a) => nodes.get(a)?.module)].filter(Boolean));
    for (const fm of fromMods) for (const tm of toMods) {
      if (fm === tm) continue;
      const k = `${fm} ${tm}`;
      modFan.set(k, (modFan.get(k) ?? 0) + e.weight);
    }
  }
  const moduleDepends = [...modFan.entries()]
    .map(([k, weight]) => {
      const [from, to] = k.split(' ');
      return { from: `module:${from}`, to: `module:${to}`, weight };
    })
    .filter((e) => nodes.has(e.from) && nodes.has(e.to))
    .sort((a, b) => byString(a.from, b.from) || byString(a.to, b.to));
  for (const e of moduleDepends) {
    nodes.get(e.from).meta.fanOut = (nodes.get(e.from).meta.fanOut ?? 0) + 1;
    nodes.get(e.to).meta.fanIn = (nodes.get(e.to).meta.fanIn ?? 0) + 1;
  }

  const nodeList = [...nodes.values()].sort((a, b) => byString(a.id, b.id));
  const count = (t) => nodeList.filter((n) => n.type === t).length;

  return {
    version: GRAPH_VERSION,
    repo: { name: config.name, root },
    config: { editor: config.editor },
    codeRoot,
    graphify: { version: ast.graphifyVersion ?? null },
    stats: {
      modules: count('module'),
      featureModules: featureModules.length,
      sharedModules: sharedModules.length,
      ambiguousModules: nodeList.filter((n) => n.type === 'module' && n.meta.ambiguous).length,
      folders: count('folder'),
      files: count('file'),
      dependEdges: depends.length,
      moduleDependEdges: moduleDepends.length,
      languages: ast.languages ?? [],
      symbols: ast.stats?.symbols ?? 0,
      externalRefs: ast.stats?.externalRefs ?? 0,
      unresolved: ast.stats?.unresolved ?? 0,
      failed: ast.stats?.failed ?? 0,
    },
    nodes: nodeList,
    edges: [...finalContains.map((c) => ({ ...c, type: 'contains' })), ...depends, ...moduleDepends.map((e) => ({ ...e, type: 'module-depends' }))].sort(
      (a, b) => byString(a.type, b.type) || byString(a.from, b.from) || byString(a.to, b.to),
    ),
  };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const graph = buildGraph(root);
  fs.mkdirSync(path.join(root, OUT_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, OUT_DIR, 'graph.json'), `${JSON.stringify(graph, null, 2)}\n`);
  const s = graph.stats;
  console.log(
    `graph.json: ${s.modules} modules (${s.featureModules} feature, ${s.sharedModules} general-purpose` +
      `${s.ambiguousModules ? `, ${s.ambiguousModules} unsure` : ''}), ` +
      `${s.folders} folders, ${s.files} files, ${s.dependEdges} dependency edges`,
  );
  if (s.languages.length) console.log(`languages: ${s.languages.join(', ')}  ·  graphify ${graph.graphify.version ?? '?'}`);
  if (s.unresolved || s.failed) console.log(`${s.unresolved} unresolved refs, ${s.failed} files graphify could not parse`);
}
