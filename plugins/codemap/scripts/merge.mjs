#!/usr/bin/env node
// Combine the deterministic import pass with whatever the two skills produced
// into a single canonical graph.json.
//
//   node merge.mjs [repoRoot]
//
// routes.json and docs.json are optional. A repo with neither still produces a
// valid graph - it just has fewer node types in it.

import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { readCacheJson } from './lib/cache.mjs';
import { createRefChecker } from './lib/refs.mjs';
import { GRAPH_VERSION, OUT_DIR } from './lib/const.mjs';

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const clamp = (s, n) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n - 3)}...` : s ?? null);

export function mergeGraph(root) {
  const { config } = loadConfig(root);
  const imports = readCacheJson(root, 'imports.json') ?? { files: [], modules: [], unresolved: [] };
  const routes = readCacheJson(root, 'routes.json') ?? { routes: [], edges: [] };
  const docs = readCacheJson(root, 'docs.json') ?? { docs: [] };
  const flowcharts = readCacheJson(root, 'flowcharts.json') ?? { flowcharts: [] };

  const nodes = new Map();
  const edges = new Map();
  const addNode = (node) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
    return nodes.get(node.id);
  };
  const addEdge = (from, to, type, weight, extra) => {
    if (!from || !to || from === to) return;
    if (!nodes.has(from) || !nodes.has(to)) return;
    const key = `${from} ${to} ${type}`;
    const existing = edges.get(key);
    if (existing) {
      if (weight != null) existing.weight = (existing.weight ?? 0) + weight;
      if (extra) Object.assign(existing, extra);
      return;
    }
    const edge = weight == null ? { from, to, type } : { from, to, type, weight };
    edges.set(key, extra ? { ...edge, ...extra } : edge);
  };

  const fileId = (rel) => `file:${rel}`;
  const moduleId = (slug) => `module:${slug}`;

  // ---- modules and files -------------------------------------------------
  for (const m of imports.modules) {
    addNode({
      id: moduleId(m.slug),
      type: 'module',
      label: m.slug,
      path: m.path,
      module: m.slug,
      summary: null,
      meta: { fileCount: m.fileCount ?? 0, codeFileCount: m.codeFileCount ?? 0, fanIn: 0, fanOut: 0 },
    });
  }
  for (const f of imports.files) {
    addNode({
      id: fileId(f.path),
      type: 'file',
      label: path.posix.basename(f.path),
      path: f.path,
      module: f.module ?? null,
      summary: null,
      meta: { fanIn: 0, fanOut: 0 },
    });
  }

  // ---- import edges, at both granularities -------------------------------
  for (const f of imports.files) {
    for (const target of f.imports) addEdge(fileId(f.path), fileId(target), 'imports', 1);
  }
  const moduleOfFile = new Map(imports.files.map((f) => [f.path, f.module]));
  for (const f of imports.files) {
    for (const target of f.imports) {
      const from = f.module;
      const to = moduleOfFile.get(target) ?? null;
      if (from && to && from !== to) addEdge(moduleId(from), moduleId(to), 'imports', 1);
    }
  }

  // ---- routes ------------------------------------------------------------
  for (const r of routes.routes ?? []) {
    const type = r.type === 'screen' ? 'screen' : 'route';
    addNode({
      id: `${type}:${r.id}`,
      type,
      label: r.name ?? r.id,
      path: r.screenFile ?? null,
      module: r.module ?? null,
      summary: clamp(r.summary, 120),
      meta: {
        routePath: r.path ?? null,
        navigatorType: r.navigatorType ?? null,
        parent: r.parent ?? null,
      },
    });
  }
  const routeNodeId = (id) => (nodes.has(`route:${id}`) ? `route:${id}` : `screen:${id}`);
  for (const r of routes.routes ?? []) {
    const self = r.type === 'screen' ? `screen:${r.id}` : `route:${r.id}`;
    // Parent nesting is a navigation relationship, not an import one. Flagging
    // it lets the renderer lay out a real tree and draw cross-links separately.
    if (r.parent) addEdge(routeNodeId(r.parent), self, 'navigates', null, { hierarchy: true });
    if (r.screenFile && nodes.has(fileId(r.screenFile))) addEdge(self, fileId(r.screenFile), 'renders');
  }
  for (const e of routes.edges ?? []) addEdge(routeNodeId(e.from), routeNodeId(e.to), 'navigates');

  // ---- docs --------------------------------------------------------------
  const moduleByPath = new Map(imports.modules.map((m) => [m.path, m.slug]));
  const moduleRootOf = new Map(imports.modules.map((m) => [m.slug, m.path]));
  const refs = createRefChecker(root, config);
  const refCounts = { recovered: 0, deleted: 0, unknown: 0, external: 0 };

  /** The node a path written in a doc points at, doc nodes included. */
  const targetNodeId = (target) => {
    if (nodes.has(`doc:${target}`)) return `doc:${target}`;
    if (nodes.has(fileId(target))) return fileId(target);
    const slug = moduleByPath.get(target);
    if (slug) return moduleId(slug);
    if (nodes.has(moduleId(target))) return moduleId(target);
    return null;
  };

  for (const d of docs.docs ?? []) {
    addNode({
      id: `doc:${d.path}`,
      type: 'doc',
      label: path.posix.basename(d.path),
      path: d.path,
      module: d.module ?? null,
      summary: clamp(d.summary, 120),
      // Filled in below, once every doc node exists and a claimed path can be
      // told apart from a doc it actually points at.
      meta: {
        docKind: d.kind ?? 'OTHER',
        guardrails: (d.guardrails ?? []).slice(0, 10).map((g) => clamp(g, 200)),
        stale: false,
        refs: { deleted: [], unknown: [], external: [] },
      },
    });
  }
  for (const d of docs.docs ?? []) {
    const self = `doc:${d.path}`;
    const moduleRoot = d.module ? moduleRootOf.get(d.module) : null;
    let attached = 0;

    const attach = (target) => {
      const id = targetNodeId(target);
      if (!id) return false;
      // A doc pointing at a doc is a reading order, not documentation.
      addEdge(self, id, id.startsWith('doc:') ? 'links' : 'documents');
      if (!id.startsWith('doc:')) attached++;
      return true;
    };

    for (const target of d.documents ?? []) {
      if (attach(target)) continue;
      // The extractor writes repo-relative paths, but not always correctly.
      const hit = refs.resolve(target, d.path, moduleRoot);
      if (hit) attach(hit.path);
    }
    for (const target of d.links ?? []) addEdge(self, `doc:${target}`, 'links');

    // Every path the extractor gave up on, re-checked against the real tree.
    // Most of them turn out to point at something that is right there.
    const verdicts = nodes.get(self).meta.refs;
    for (const raw of d.stalePaths ?? []) {
      // A path that is on disk is not a finding, whether or not the thing it
      // points at is a node here - an image or an unmapped doc is still there.
      const hit = refs.resolve(raw, d.path, moduleRoot);
      if (hit) {
        if (attach(hit.path)) refCounts.recovered++;
        continue;
      }
      const v = refs.verdict(raw, d.path, moduleRoot);
      if (v.status === 'deleted') {
        verdicts.deleted.push({ path: v.path, wrote: raw, sha: v.sha ?? null, date: v.date ?? null });
      } else {
        verdicts[v.status].push(raw);
      }
      refCounts[v.status]++;
    }
    verdicts.deleted.sort((a, b) => byString(a.path, b.path));
    verdicts.unknown.sort(byString);
    verdicts.external.sort(byString);
    // The badge means one thing now: git removed a file this doc still names.
    nodes.get(self).meta.stale = verdicts.deleted.length > 0;

    // A doc that names no real path still belongs to its owning module.
    if (!attached && d.module && nodes.has(moduleId(d.module))) {
      addEdge(self, moduleId(d.module), 'documents');
    }
  }

  // ---- flowcharts ---------------------------------------------------------
  // Generated once during extraction, not synthesised in the browser - the
  // viewer just lays this out. A module the extractor skipped (nothing here
  // described an end-to-end flow) simply has no meta.flowchart, and the
  // viewer falls back to its manual "ask an agent" prompt.
  let flowchartCount = 0;
  for (const fc of flowcharts.flowcharts ?? []) {
    const node = nodes.get(moduleId(fc.module));
    if (!node) continue;
    const steps = (fc.steps ?? []).map((s) => ({
      id: s.id,
      kind: s.kind ?? 'step',
      label: clamp(s.label, 60),
      detail: clamp(s.detail, 220),
    }));
    const stepIds = new Set(steps.map((s) => s.id));
    const flowEdges = (fc.edges ?? [])
      .filter((e) => stepIds.has(e.from) && stepIds.has(e.to))
      .map((e) => ({ from: e.from, to: e.to, label: clamp(e.label, 24) }));
    if (!steps.length) continue;
    node.meta.flowchart = {
      title: fc.title ?? null,
      summary: clamp(fc.summary, 200),
      steps,
      edges: flowEdges,
      sources: (fc.sources ?? []).slice().sort(byString),
    };
    flowchartCount++;
  }

  // ---- degree ------------------------------------------------------------
  for (const e of edges.values()) {
    if (e.type !== 'imports') continue;
    nodes.get(e.from).meta.fanOut = (nodes.get(e.from).meta.fanOut ?? 0) + 1;
    nodes.get(e.to).meta.fanIn = (nodes.get(e.to).meta.fanIn ?? 0) + 1;
  }

  const nodeList = [...nodes.values()].sort((a, b) => byString(a.id, b.id));
  const edgeList = [...edges.values()].sort(
    (a, b) => byString(a.from, b.from) || byString(a.to, b.to) || byString(a.type, b.type),
  );

  const count = (t) => nodeList.filter((n) => n.type === t).length;
  return {
    version: GRAPH_VERSION,
    repo: { name: config.name, root },
    config: { editor: config.editor },
    stats: {
      files: count('file'),
      modules: count('module'),
      routes: count('route') + count('screen'),
      docs: count('doc'),
      flowcharts: flowchartCount,
      unresolved: (imports.unresolved ?? []).length,
      stale: nodeList.filter((n) => n.meta?.stale).length,
      refs: refCounts,
    },
    nodes: nodeList,
    edges: edgeList,
  };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const root = path.resolve(process.argv[2] ?? process.cwd());
  const graph = mergeGraph(root);
  fs.mkdirSync(path.join(root, OUT_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, OUT_DIR, 'graph.json'), `${JSON.stringify(graph, null, 2)}\n`);
  const s = graph.stats;
  console.log(
    `graph.json: ${s.modules} modules, ${s.files} files, ${s.routes} routes, ${s.docs} docs, ` +
      `${s.flowcharts} flowcharts, ${graph.edges.length} edges`,
  );
  const r = s.refs;
  console.log(
    `doc refs: ${r.recovered} recovered, ${r.deleted} deleted (${s.stale} docs), ` +
      `${r.unknown} never here, ${r.external} outside the repo`,
  );
}
