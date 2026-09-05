#!/usr/bin/env python3
"""birdsEye <-> graphify bridge.

Reads a JSON job on stdin, runs graphify's deterministic AST extraction over the
given files, collapses the symbol-level graph down to a file-level dependency
graph, and writes that JSON to stdout. No LLM, no network, no tokens - this is
the whole "extraction" stage of birdsEye now.

stdin  : {"repoRoot": abs, "cacheDir": abs, "files": [repo-relative, ...]}
stdout : {
  "graphifyVersion": str,
  "files":     [{"path", "symbols", "loc", "lang"}],
  "edges":     [{"from", "to", "weight", "kinds": {relation: count}}],
  "externals": [{"from", "module", "count"}],
  "unresolved": int,
  "failed":     int,
  "stats": {"rawNodes": int, "rawEdges": int}
}

Exit codes: 0 ok, 3 graphify import failed (caller installs it), 1 anything else.
"""

from __future__ import annotations

import contextlib
import json
import os
import sys
from pathlib import Path

# Relations that mean a source file imports another source file. Graphify can
# also emit follow-on `calls`, `references`, and `uses` edges between the same
# files; those are useful symbol facts, but counting them here makes one import
# look like several dependencies in the viewer.
IMPORT_RELATIONS = {
    "imports",
    "imports_from",
    "re_exports",
}

EXT_LANG = {
    ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".py": "python", ".go": "go", ".rs": "rust", ".rb": "ruby",
    ".java": "java", ".kt": "kotlin", ".kts": "kotlin", ".scala": "scala",
    ".cs": "csharp", ".php": "php", ".swift": "swift", ".c": "c", ".h": "c",
    ".cc": "cpp", ".cpp": "cpp", ".cxx": "cpp", ".hpp": "cpp",
    ".lua": "lua", ".ex": "elixir", ".exs": "elixir", ".jl": "julia",
    ".zig": "zig", ".m": "objc", ".sh": "bash", ".bash": "bash",
}


def _fail(code: int, msg: str) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    sys.exit(code)


def _line_no(loc: object) -> int:
    if not isinstance(loc, str):
        return 0
    digits = "".join(ch for ch in loc if ch.isdigit())
    return int(digits) if digits else 0


def main() -> None:
    try:
        job = json.load(sys.stdin)
    except Exception as exc:  # noqa: BLE001
        _fail(1, f"bridge: bad job json: {exc}")

    repo_root = Path(job["repoRoot"]).resolve()
    cache_dir = Path(job.get("cacheDir") or (repo_root / "birdseye" / ".cache" / "graphify"))
    rels = list(job.get("files") or [])

    try:
        import graphify  # noqa: F401
        from graphify.extract import extract
    except Exception as exc:  # noqa: BLE001
        _fail(3, f"bridge: graphify not importable: {exc}")

    graphify_version = getattr(graphify, "__version__", None)
    if not graphify_version:
        try:
            from importlib.metadata import version as _v

            graphify_version = _v("graphifyy")
        except Exception:  # noqa: BLE001
            graphify_version = "unknown"

    abs_paths = [repo_root / r for r in rels]
    abs_paths = [p for p in abs_paths if p.is_file()]
    cache_dir.mkdir(parents=True, exist_ok=True)

    # `root` anchors node ids + relativises source_file to the repo; `cache_root`
    # keeps graphify's own content-hash cache inside birdseye/.cache.
    # graphify prints progress to stdout; keep our stdout clean for the JSON.
    try:
        with contextlib.redirect_stdout(sys.stderr):
            try:
                result = extract(abs_paths, cache_root=cache_dir, root=repo_root)
            except TypeError:
                # Older graphify (<=0.4.x) has no `root=` kwarg.
                result = extract(abs_paths, cache_root=cache_dir)
    except Exception as exc:  # noqa: BLE001
        _fail(1, f"bridge: extract() raised: {exc}")

    raw_nodes = result.get("nodes", [])
    raw_edges = result.get("edges", [])

    # node id -> repo-relative source file
    node_file: dict[str, str] = {}
    for n in raw_nodes:
        nid = n.get("id")
        sf = n.get("source_file")
        if not nid or not sf:
            continue
        sf = sf.replace("\\", "/")
        if os.path.isabs(sf):
            try:
                sf = str(Path(sf).resolve().relative_to(repo_root))
            except Exception:  # noqa: BLE001
                continue
        node_file[nid] = sf

    # Per-file tallies.
    known = set(rels)
    files: dict[str, dict] = {}
    for rel in rels:
        ext = Path(rel).suffix.lower()
        files[rel] = {"path": rel, "symbols": 0, "loc": 0, "lang": EXT_LANG.get(ext, ext.lstrip(".") or "?")}

    for n in raw_nodes:
        rel = node_file.get(n.get("id"))
        if rel not in files:
            continue
        loc = _line_no(n.get("source_location"))
        f = files[rel]
        if loc > f["loc"]:
            f["loc"] = loc
        # A node that is not the file node itself is a symbol (function/class/...).
        if _line_no(n.get("source_location")) != 1 and n.get("label", "").strip() not in (
            "", Path(rel).name,
        ):
            f["symbols"] += 1

    # File-level dependency edges + external usage.
    dep: dict[tuple[str, str], dict[str, int]] = {}
    ext: dict[tuple[str, str], int] = {}
    unresolved = 0

    for e in raw_edges:
        rel_type = e.get("relation")
        if rel_type not in IMPORT_RELATIONS:
            continue
        src = node_file.get(e.get("source"))
        if src not in files:
            continue
        tgt_id = e.get("target")
        tgt = node_file.get(tgt_id)
        if tgt is None:
            # Target is not one of our source files: an external package, or a
            # dependency graphify could not resolve to a file.
            mod = _external_name(tgt_id)
            if mod:
                ext[(src, mod)] = ext.get((src, mod), 0) + 1
            else:
                unresolved += 1
            continue
        if tgt not in files or tgt == src:
            continue
        bucket = dep.setdefault((src, tgt), {})
        bucket[rel_type] = bucket.get(rel_type, 0) + 1

    edges = [
        {
            "from": a,
            "to": b,
            "weight": _import_weight(kinds),
            "kinds": dict(sorted(kinds.items())),
        }
        for (a, b), kinds in sorted(dep.items())
    ]
    externals = [
        {"from": a, "module": m, "count": c}
        for (a, m), c in sorted(ext.items())
    ]

    out = {
        "graphifyVersion": graphify_version,
        "files": [files[r] for r in rels if r in files],
        "edges": edges,
        "externals": externals,
        "unresolved": unresolved,
        "failed": len(result.get("failed_sources", []) or []),
        "stats": {"rawNodes": len(raw_nodes), "rawEdges": len(raw_edges)},
    }
    json.dump(out, sys.stdout)
    sys.stdout.write("\n")


def _external_name(node_id: object) -> str | None:
    """Best-effort package name for an unresolved import target id.

    graphify names external targets like `ref_node_fs`, `ref_react`,
    `ref_node_path`. Anything without that shape is a genuine dangling edge.
    """
    if not isinstance(node_id, str) or not node_id:
        return None
    for prefix in ("ref_node_", "ref_"):
        if node_id.startswith(prefix):
            name = node_id[len(prefix):].replace("_", "-")
            return name or None
    return None


def _import_weight(kinds: dict[str, int]) -> int:
    """Human-facing import count for one file pair.

    `imports_from` is the module-specifier edge and `imports` is usually the
    imported binding count. Taking the max avoids double-counting the same
    statement while still showing when several bindings come from one file.
    """
    return max(1, *(kinds.get(rel, 0) for rel in IMPORT_RELATIONS))


if __name__ == "__main__":
    main()
