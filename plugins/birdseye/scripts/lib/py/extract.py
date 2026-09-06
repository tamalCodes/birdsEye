#!/usr/bin/env python3
"""birdsEye's source extractor.

Reads a JSON job on stdin, parses every listed file with tree-sitter, and writes
one JSON record per file to stdout. No LLM, no network, no tokens.

This deliberately does ONE job: find what a file declares and what it imports,
as those things literally appear in the syntax tree. It does not resolve a
specifier to a file, because resolution needs to know the repo - tsconfig path
aliases, go.mod module paths, Python source roots - and all of that already
lives on the Node side in scripts/lib/languages/. Keeping the split here means
this file never needs to know what a repository is.

stdin  : {"repoRoot": abs, "cacheDir": abs, "files": [repo-relative, ...]}
stdout : {
  "extractorVersion": int,
  "files": [{
     "path":     repo-relative,
     "lang":     str,
     "loc":      int,            # physical lines
     "symbols":  int,            # top-level-ish definitions
     "imports":  [{"spec": str, "kind": str}],
     "declares": [str],          # package / namespace / module names
  }],
  "failed":  [{"path", "error"}],
  "stats":   {"parsed": int, "cached": int, "skipped": int}
}

Exit codes: 0 ok, 3 tree-sitter missing (caller installs it), 1 anything else.
"""

from __future__ import annotations

import hashlib
import importlib
import re
import json
import os
import sys
from pathlib import Path

# Bump when the shape of a file record changes or a language handler is fixed.
# Every cached entry keyed on an older version is discarded, so a fix reaches
# existing repos without anyone needing to remember `--force`.
EXTRACTOR_VERSION = 7

# ---------------------------------------------------------------------------
# language table
# ---------------------------------------------------------------------------
# extension -> (birdsEye language id, pip module, factory attribute)
#
# The factory attribute is what the grammar package exposes: nearly all of them
# expose `language`, but the multi-dialect ones (TypeScript, PHP) expose one
# factory per dialect.
LANGS = {
    ".ts":    ("typescript", "tree_sitter_typescript", "language_typescript"),
    ".mts":   ("typescript", "tree_sitter_typescript", "language_typescript"),
    ".cts":   ("typescript", "tree_sitter_typescript", "language_typescript"),
    ".tsx":   ("typescript", "tree_sitter_typescript", "language_tsx"),
    ".js":    ("javascript", "tree_sitter_javascript", "language"),
    ".jsx":   ("javascript", "tree_sitter_javascript", "language"),
    ".mjs":   ("javascript", "tree_sitter_javascript", "language"),
    ".cjs":   ("javascript", "tree_sitter_javascript", "language"),
    ".py":    ("python", "tree_sitter_python", "language"),
    ".go":    ("go", "tree_sitter_go", "language"),
    ".rs":    ("rust", "tree_sitter_rust", "language"),
    ".rb":    ("ruby", "tree_sitter_ruby", "language"),
    ".java":  ("java", "tree_sitter_java", "language"),
    ".kt":    ("kotlin", "tree_sitter_kotlin", "language"),
    ".kts":   ("kotlin", "tree_sitter_kotlin", "language"),
    ".scala": ("scala", "tree_sitter_scala", "language"),
    ".cs":    ("csharp", "tree_sitter_c_sharp", "language"),
    ".php":   ("php", "tree_sitter_php", "language_php"),
    ".swift": ("swift", "tree_sitter_swift", "language"),
    ".c":     ("c", "tree_sitter_c", "language"),
    ".h":     ("c", "tree_sitter_c", "language"),
    ".cc":    ("cpp", "tree_sitter_cpp", "language"),
    ".cpp":   ("cpp", "tree_sitter_cpp", "language"),
    ".cxx":   ("cpp", "tree_sitter_cpp", "language"),
    ".hpp":   ("cpp", "tree_sitter_cpp", "language"),
    ".m":     ("objc", "tree_sitter_objc", "language"),
    ".lua":   ("lua", "tree_sitter_lua", "language"),
    ".ex":    ("elixir", "tree_sitter_elixir", "language"),
    ".exs":   ("elixir", "tree_sitter_elixir", "language"),
    ".jl":    ("julia", "tree_sitter_julia", "language"),
    ".zig":   ("zig", "tree_sitter_zig", "language"),
    # Single-file components: the script block is JS/TS, the rest is markup.
    # Parsed with the TypeScript grammar, which reads plain JS too.
    ".vue":    ("vue", "tree_sitter_typescript", "language_typescript"),
    ".svelte": ("svelte", "tree_sitter_typescript", "language_typescript"),
    ".astro":  ("astro", "tree_sitter_typescript", "language_typescript"),
    ".sh":     ("bash", "tree_sitter_bash", "language"),
    ".bash":   ("bash", "tree_sitter_bash", "language"),
    ".groovy": ("groovy", "tree_sitter_groovy", "language"),
    ".gradle": ("groovy", "tree_sitter_groovy", "language"),
    ".json":   ("json", "tree_sitter_json", "language"),
    ".dart":   ("dart", "tree_sitter_dart", "language"),
    ".sql":    ("sql", "tree_sitter_sql", "language"),
    ".tf":     ("terraform", "tree_sitter_hcl", "language"),
    ".tfvars": ("terraform", "tree_sitter_hcl", "language"),
    ".hcl":    ("terraform", "tree_sitter_hcl", "language"),
    ".ps1":    ("powershell", "tree_sitter_powershell", "language"),
    ".psm1":   ("powershell", "tree_sitter_powershell", "language"),
    ".psd1":   ("powershell", "tree_sitter_powershell", "language"),
}

# Languages whose file is mostly markup with the code in a script region. The
# markup is blanked out before parsing so a `<template>` that happens to
# contain the word `import`, or a string that looks like one, cannot produce an
# edge - the same reason the old regex extractors stripped comments first.
SCRIPT_HOSTS = {"vue", "svelte", "astro"}

_SCRIPT_RE = re.compile(r"<script\b[^>]*>(.*?)</script\s*>", re.S | re.I)
# Astro puts its component script in `---` fenced frontmatter at the very top.
_ASTRO_FRONTMATTER_RE = re.compile(r"\A\s*---[^\n]*\n(.*?)\n\s*---", re.S)


def blank_outside(text: str, spans: list[tuple[int, int]]) -> str:
    """Replace everything outside `spans` with spaces, keeping newlines.

    Offsets and line numbers survive intact, so a symbol's reported line still
    matches the real file.
    """
    out = []
    pos = 0
    for start, end in sorted(spans):
        if start < pos:
            continue
        out.append(re.sub(r"[^\n]", " ", text[pos:start]))
        out.append(text[start:end])
        pos = end
    out.append(re.sub(r"[^\n]", " ", text[pos:]))
    return "".join(out)


def script_regions(text: str, lang_id: str) -> str:
    spans = [m.span(1) for m in _SCRIPT_RE.finditer(text)]
    if lang_id == "astro":
        fm = _ASTRO_FRONTMATTER_RE.search(text)
        if fm is not None:
            spans.append(fm.span(1))
    return blank_outside(text, spans)


def _fail(code: int, msg: str) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    sys.exit(code)


# ---------------------------------------------------------------------------
# small helpers over tree-sitter nodes
# ---------------------------------------------------------------------------

def txt(node) -> str:
    """A node's source text, decoded permissively."""
    if node is None:
        return ""
    return node.text.decode("utf8", "replace")


def unquote(s: str) -> str:
    """Strip one layer of quotes from a string literal's raw text."""
    s = s.strip()
    for pair in ('"""', "'''"):
        if s.startswith(pair) and s.endswith(pair) and len(s) >= 6:
            return s[3:-3]
    if len(s) >= 2 and s[0] in "\"'`" and s[-1] == s[0]:
        return s[1:-1]
    # Go raw strings, C includes, Rust byte strings.
    if len(s) >= 2 and s[0] == "<" and s[-1] == ">":
        return s[1:-1]
    return s


def walk(node):
    """Every node in the tree, parents before children."""
    stack = [node]
    while stack:
        n = stack.pop()
        yield n
        stack.extend(reversed(n.children))


def children_of_type(node, *types):
    return [c for c in node.children if c.type in types]


def first_of_type(node, *types):
    for c in node.children:
        if c.type in types:
            return c
    return None


def string_literals_in(node):
    """Every string literal under `node`, in source order, unquoted."""
    out = []
    for n in walk(node):
        if "string" in n.type and n.type not in ("string_interpolation",):
            if n.child_count == 0 or n.type.endswith("literal") or n.type == "string":
                out.append(unquote(txt(n)))
    return out


class Acc:
    """Collects one file's findings, de-duplicating as it goes."""

    def __init__(self) -> None:
        self.imports: list[dict] = []
        self.declares: list[str] = []
        self.symbols = 0
        self._seen_imports: dict[tuple[str, str, bool], dict] = {}
        self._seen_declares: set[str] = set()

    def imp(self, spec: str, kind: str, names: list[str] | None = None,
            reexport: bool = False) -> None:
        spec = (spec or "").strip()
        if not spec:
            return
        key = (kind, spec, reexport)
        existing = self._seen_imports.get(key)
        if existing is not None:
            # The same module imported twice in one file - one statement for
            # values, one for types, say. Union the names rather than dropping
            # the second statement's, or a barrel hop would miss them.
            if names:
                have = existing.setdefault("names", [])
                for n in names:
                    if n not in have:
                        have.append(n)
            return
        record: dict = {"spec": spec, "kind": kind}
        if names:
            record["names"] = list(dict.fromkeys(names))
        if reexport:
            record["reexport"] = True
        self._seen_imports[key] = record
        self.imports.append(record)

    def decl(self, name: str) -> None:
        name = (name or "").strip()
        if name and name not in self._seen_declares:
            self._seen_declares.add(name)
            self.declares.append(name)

    def sym(self) -> None:
        self.symbols += 1


# ---------------------------------------------------------------------------
# per-language handlers
#
# Each takes the parsed root node and an Acc. They walk the tree themselves so
# each one can decide how deep to look: a JS `require()` can appear anywhere,
# while a Java `import` is only ever top level.
# ---------------------------------------------------------------------------

JS_SYMBOLS = {
    "function_declaration", "generator_function_declaration", "class_declaration",
    "method_definition", "interface_declaration", "type_alias_declaration",
    "enum_declaration", "abstract_class_declaration",
}
# `require`-alikes whose first string argument is a real dependency.
JS_REQUIRE_FNS = {"require", "import"}
JS_MOCK_FNS = {"jest.mock", "jest.unmock", "jest.requireActual", "vi.mock", "vi.unmock"}


def js_binding_names(node, exporting: bool) -> list[str]:
    """The names a JS import or export clause deals in.

    Which side of an alias matters, and it flips between the two cases:

      `import { a as b } from "m"`     reads `a` FROM m, so `a` is the name to
                                       look for inside m.
      `export { a as b } from "m"`     offers `b` TO everyone else, so `b` is
                                       the name a consumer will ask this file
                                       for - and `export { default as Card }`
                                       is exactly this case, which is how most
                                       barrels forward a default export.

    Take the wrong side and a barrel silently stops matching its consumers.
    """
    names: list[str] = []
    for c in walk(node):
        if c.type in ("import_specifier", "export_specifier"):
            alias = c.child_by_field_name("alias") if exporting else None
            name = alias if alias is not None else c.child_by_field_name("name")
            if name is not None:
                names.append(txt(name))
        elif c.type in ("namespace_import", "*"):
            names.append("*")
    return names


def handle_js(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "import_statement":
            s = first_of_type(n, "string")
            if s is not None:
                clause = first_of_type(n, "import_clause")
                names = js_binding_names(clause, exporting=False) if clause is not None else []
                # A default or side-effect import binds nothing a barrel can
                # forward, so it stays an edge to the module itself.
                acc.imp(unquote(txt(s)), "js", names=names)
        elif t == "export_statement":
            # `export ... from "x"` re-exports; a bare `export class K {}` does not.
            s = first_of_type(n, "string")
            if s is not None:
                acc.imp(unquote(txt(s)), "js", names=js_binding_names(n, exporting=True), reexport=True)
        elif t == "call_expression":
            fn = txt(n.child_by_field_name("function"))
            if fn in JS_REQUIRE_FNS or fn in JS_MOCK_FNS:
                args = n.child_by_field_name("arguments")
                if args is not None:
                    lits = [c for c in args.children if c.type == "string"]
                    if lits:
                        acc.imp(unquote(txt(lits[0])), "js")
        elif t == "import" and n.parent is not None and n.parent.type == "call_expression":
            # `import("./x")` - the callee is an `import` keyword node, not an
            # identifier, so the call_expression branch above misses it.
            args = n.parent.child_by_field_name("arguments")
            if args is not None:
                lits = [c for c in args.children if c.type == "string"]
                if lits:
                    acc.imp(unquote(txt(lits[0])), "js")
        elif t in JS_SYMBOLS:
            acc.sym()
        elif t == "variable_declarator":
            # `const f = () => {}` and `const C = class {}` are declarations in
            # every sense that matters to a reader.
            v = n.child_by_field_name("value")
            if v is not None and v.type in (
                "arrow_function", "function_expression", "function", "class",
            ):
                acc.sym()


PY_SYMBOLS = {"function_definition", "class_definition"}


def handle_python(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "import_statement":
            for c in n.children:
                if c.type == "dotted_name":
                    acc.imp(txt(c), "absolute")
                elif c.type == "aliased_import":
                    name = first_of_type(c, "dotted_name")
                    if name is not None:
                        acc.imp(txt(name), "absolute")
        elif t == "import_from_statement":
            mod = n.child_by_field_name("module_name")
            base = txt(mod) if mod is not None else ""
            if not base:
                # `from . import x` - the dots are anonymous children.
                base = "".join(txt(c) for c in n.children if c.type == ".")
            if base:
                acc.imp(base, "relative" if base.startswith(".") else "absolute")
            # `from pkg import thing` - `thing` may be a submodule or may be a
            # plain symbol. Emitted weak so the resolver can stay quiet when it
            # turns out to be a symbol.
            # Compared by source range, not identity: py-tree-sitter hands out a
            # fresh Node object per accessor call, so `c is mod` is never true
            # and the module itself would be re-read as an imported name.
            mod_span = (mod.start_byte, mod.end_byte) if mod is not None else None
            for c in n.children:
                if mod_span is not None and (c.start_byte, c.end_byte) == mod_span:
                    continue
                names = []
                if c.type == "dotted_name":
                    names = [txt(c)]
                elif c.type == "aliased_import":
                    inner = first_of_type(c, "dotted_name")
                    if inner is not None:
                        names = [txt(inner)]
                for name in names:
                    if not name or "." in name:
                        continue
                    joined = f"{base}{name}" if base.endswith(".") else f"{base}.{name}"
                    acc.imp(joined, "weak")
        elif t in PY_SYMBOLS:
            acc.sym()


def handle_go(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "import_spec":
            p = n.child_by_field_name("path")
            if p is not None:
                acc.imp(unquote(txt(p)), "absolute")
        elif t == "package_clause":
            name = first_of_type(n, "package_identifier")
            if name is not None:
                acc.decl(txt(name))
        elif t in ("function_declaration", "method_declaration", "type_spec"):
            acc.sym()


def handle_rust(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "mod_item":
            # `mod foo;` declares a file module; `mod foo { .. }` is inline and
            # points at no other file.
            if first_of_type(n, "declaration_list") is None:
                name = n.child_by_field_name("name")
                if name is not None:
                    acc.imp(f"mod {txt(name)}", "relative")
            else:
                acc.sym()
        elif t == "use_declaration":
            arg = n.child_by_field_name("argument")
            if arg is not None:
                # Handed over raw: expanding `use a::{b, c::d}` into concrete
                # paths is the resolver's job and already lives in rust.mjs.
                acc.imp(txt(arg), "use-raw")
        elif t in ("function_item", "struct_item", "enum_item", "trait_item", "union_item"):
            acc.sym()


def handle_csharp(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "using_directive":
            name = None
            for c in n.children:
                if c.type in ("qualified_name", "identifier", "alias_qualified_name"):
                    name = c
            if name is not None:
                acc.imp(txt(name), "namespace")
        elif t in ("namespace_declaration", "file_scoped_namespace_declaration"):
            name = n.child_by_field_name("name")
            if name is not None:
                acc.decl(txt(name))
        elif t in (
            "class_declaration", "interface_declaration", "struct_declaration",
            "record_declaration", "method_declaration", "enum_declaration",
        ):
            acc.sym()


def handle_java(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "import_declaration":
            name = first_of_type(n, "scoped_identifier", "identifier")
            if name is not None:
                spec = txt(name)
                # `import a.b.*;` - the star is a sibling, so the name node is
                # already the package.
                acc.imp(spec, "namespace")
        elif t == "package_declaration":
            name = first_of_type(n, "scoped_identifier", "identifier")
            if name is not None:
                acc.decl(txt(name))
        elif t in (
            "class_declaration", "interface_declaration", "enum_declaration",
            "record_declaration", "method_declaration", "annotation_type_declaration",
        ):
            acc.sym()


def handle_kotlin(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        # The grammar names the whole statement `import` and the keyword inside
        # it `import` too, so the qualified name is what tells them apart.
        if t in ("import", "import_header"):
            ident = first_of_type(n, "qualified_identifier", "identifier")
            if ident is None:
                continue
            acc.imp(txt(ident).strip().rstrip("*").rstrip("."), "namespace")
        elif t in ("package_header",):
            ident = first_of_type(n, "identifier", "qualified_identifier")
            spec = txt(ident) if ident is not None else txt(n).replace("package", "", 1)
            acc.decl(spec.strip())
        elif t in (
            "class_declaration", "function_declaration", "object_declaration",
            "property_declaration",
        ):
            acc.sym()


def handle_scala(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "import_declaration":
            body = txt(n).replace("import", "", 1).strip()
            acc.imp(body.split("{")[0].strip().rstrip("._"), "namespace")
        elif t == "package_clause":
            ident = first_of_type(n, "package_identifier", "identifier", "stable_identifier")
            if ident is not None:
                acc.decl(txt(ident))
        elif t in (
            "class_definition", "object_definition", "trait_definition",
            "function_definition", "val_definition",
        ):
            acc.sym()


RUBY_REQUIRE = {"require", "require_relative", "load", "autoload"}


def handle_ruby(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "call":
            method = txt(n.child_by_field_name("method"))
            if method in RUBY_REQUIRE:
                args = n.child_by_field_name("arguments")
                if args is not None:
                    lits = string_literals_in(args)
                    if lits:
                        kind = "relative" if method == "require_relative" else "absolute"
                        acc.imp(lits[-1], kind)
        elif t in ("class", "module", "method", "singleton_method"):
            acc.sym()


def handle_php(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "namespace_use_declaration":
            for c in walk(n):
                if c.type in ("qualified_name", "namespace_name"):
                    acc.imp(txt(c).strip("\\"), "namespace")
                    break
        elif t == "namespace_definition":
            name = first_of_type(n, "namespace_name")
            if name is not None:
                acc.decl(txt(name).strip("\\"))
        elif t in ("include_expression", "include_once_expression",
                   "require_expression", "require_once_expression"):
            lits = string_literals_in(n)
            if lits:
                acc.imp(lits[0], "relative")
        elif t in (
            "class_declaration", "interface_declaration", "trait_declaration",
            "function_definition", "method_declaration", "enum_declaration",
        ):
            acc.sym()


def handle_swift(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "import_declaration":
            body = txt(n).replace("import", "", 1).strip()
            # `import struct Foo.Bar` - drop the kind keyword.
            parts = body.split()
            acc.imp(parts[-1] if parts else body, "namespace")
        elif t in (
            "class_declaration", "function_declaration", "protocol_declaration",
            "property_declaration",
        ):
            acc.sym()


def handle_c_family(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t in ("preproc_include", "preproc_import"):
            p = n.child_by_field_name("path")
            raw = txt(p) if p is not None else ""
            if raw:
                # `"local.h"` is a path we can resolve; `<system.h>` never is.
                kind = "relative" if raw.startswith('"') else "system"
                acc.imp(unquote(raw), kind)
        elif t in (
            "function_definition", "struct_specifier", "class_specifier",
            "enum_specifier", "union_specifier", "namespace_definition",
        ):
            acc.sym()


def handle_lua(root, acc: Acc) -> None:
    for n in walk(root):
        if n.type == "function_call":
            name = n.child_by_field_name("name")
            if name is not None and txt(name) in ("require", "dofile", "loadfile"):
                lits = string_literals_in(n)
                if lits:
                    acc.imp(lits[0], "absolute")
        elif n.type in ("function_declaration", "function_definition"):
            acc.sym()


ELIXIR_IMPORTERS = {"alias", "import", "require", "use"}


def handle_elixir(root, acc: Acc) -> None:
    for n in walk(root):
        if n.type != "call":
            continue
        target = n.child_by_field_name("target")
        head = txt(target) if target is not None else ""
        if head in ELIXIR_IMPORTERS:
            for c in walk(n):
                if c.type == "alias":
                    acc.imp(txt(c), "namespace")
                    break
        elif head == "defmodule":
            for c in walk(n):
                if c.type == "alias":
                    acc.decl(txt(c))
                    break
            acc.sym()
        elif head in ("def", "defp", "defmacro"):
            acc.sym()


def handle_julia(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t in ("using_statement", "import_statement"):
            for c in walk(n):
                if c.type == "identifier":
                    acc.imp(txt(c), "namespace")
                    break
        elif t == "call_expression":
            # This grammar exposes the callee as the first child rather than a
            # named `function` field.
            fn = n.child_by_field_name("function") or (n.children[0] if n.children else None)
            if fn is not None and txt(fn) == "include":
                lits = string_literals_in(n)
                if lits:
                    acc.imp(lits[0], "relative")
        elif t in ("function_definition", "struct_definition", "macro_definition",
                   "abstract_definition"):
            acc.sym()


def handle_zig(root, acc: Acc) -> None:
    for n in walk(root):
        if n.type in ("BuiltinCallExpr", "builtin_call_expression", "builtin_function"):
            raw = txt(n)
            if raw.startswith("@import"):
                lits = string_literals_in(n)
                if lits:
                    acc.imp(lits[0], "relative")
        elif n.type in ("FnProto", "function_declaration", "VarDecl"):
            acc.sym()


BASH_SOURCE_CMDS = {"source", "."}


def handle_bash(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "command":
            name = n.child_by_field_name("name")
            if name is not None and txt(name).strip() in BASH_SOURCE_CMDS:
                for c in n.children:
                    if c.type in ("word", "string", "raw_string", "concatenation"):
                        if c is name or txt(c).strip() in BASH_SOURCE_CMDS:
                            continue
                        spec = unquote(txt(c))
                        # `source "$DIR/other.sh"` - the variable is unknowable
                        # statically, but the tail after it usually is, and a
                        # sibling path is the overwhelmingly common case.
                        if "$" in spec:
                            spec = spec.rsplit("/", 1)[-1] if "/" in spec else ""
                        acc.imp(spec, "relative")
                        break
        elif t == "function_definition":
            acc.sym()


def handle_groovy(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "import_declaration":
            name = first_of_type(n, "scoped_identifier", "identifier")
            if name is not None:
                acc.imp(txt(name), "namespace")
        elif t == "package_declaration":
            name = first_of_type(n, "scoped_identifier", "identifier")
            if name is not None:
                acc.decl(txt(name))
        elif t in ("juxt_function_call", "function_call"):
            # Gradle's `apply from: "other.gradle"` pulls in another build file.
            head = n.children[0] if n.children else None
            if head is not None and txt(head) == "apply":
                raw = txt(n)
                if "from:" in raw:
                    lits = string_literals_in(n)
                    if lits:
                        acc.imp(lits[0], "relative")
        elif t in ("function_definition", "class_definition"):
            acc.sym()


# Only `extends` is followed. A JSON file names no code, so every other key
# would be an invented dependency; a tsconfig chain is a real one, and it is
# the chain resolve.mjs already walks to answer what an alias means.
JSON_PATH_KEYS = {"extends"}


def handle_json(root, acc: Acc) -> None:
    for n in walk(root):
        if n.type != "pair":
            continue
        key = n.child_by_field_name("key")
        value = n.child_by_field_name("value")
        if key is None or value is None:
            continue
        if unquote(txt(key)) not in JSON_PATH_KEYS:
            continue
        if value.type == "string":
            acc.imp(unquote(txt(value)), "relative")
        elif value.type == "array":
            for lit in string_literals_in(value):
                acc.imp(lit, "relative")


def handle_dart(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        # `import`, `export` and `part` all carry their target in a `uri` node,
        # so one branch covers every way a Dart file names another.
        if t == "uri":
            acc.imp(unquote(txt(n)), "dart")
        elif t in ("class_definition", "mixin_declaration", "extension_declaration",
                   "enum_declaration", "function_signature", "method_signature"):
            acc.sym()


def handle_terraform(root, acc: Acc) -> None:
    for n in walk(root):
        if n.type != "block":
            continue
        head = first_of_type(n, "identifier")
        kind = txt(head) if head is not None else ""
        if kind in ("resource", "module", "variable", "output", "data", "provider"):
            acc.sym()
        if kind != "module":
            continue
        # `module "x" { source = "./modules/vpc" }` is the only cross-file
        # reference Terraform has; everything else in a directory is already
        # one module and needs no edge.
        body = first_of_type(n, "body")
        for attr in walk(body) if body is not None else []:
            if attr.type != "attribute":
                continue
            name = first_of_type(attr, "identifier")
            if name is None or txt(name) != "source":
                continue
            # HCL keeps a string's text in `template_literal`, with the quotes
            # as separate sibling nodes, so the generic string collector does
            # not see it.
            for c in walk(attr):
                if c.type == "template_literal":
                    acc.imp(txt(c), "relative")
                    break
            break


PS_IMPORT_CMDS = {"import-module", "using"}


def handle_powershell(root, acc: Acc) -> None:
    for n in walk(root):
        t = n.type
        if t == "command":
            op = first_of_type(n, "command_invokation_operator")
            name = first_of_type(n, "command_name_expr", "command_name")
            if op is not None and txt(op).strip() == "." and name is not None:
                # Dot-sourcing: `. .\lib\helpers.ps1` runs another script in
                # this scope, which is exactly an import.
                acc.imp(txt(name).strip(), "relative")
                continue
            if name is not None and txt(name).strip().lower() in PS_IMPORT_CMDS:
                for c in n.children:
                    if c is name:
                        continue
                    raw = txt(c).strip()
                    if raw and not raw.startswith("-") and raw.lower() not in PS_IMPORT_CMDS:
                        acc.imp(unquote(raw), "relative")
                        break
        elif t == "function_statement":
            acc.sym()


SQL_CREATE_PREFIX = "create_"


def handle_sql(root, acc: Acc) -> None:
    """Objects a file creates are what it declares; objects it names are imports.

    An `object_reference` sitting directly under a `create_*` node is the thing
    being defined. Every other one is a use of something defined elsewhere, and
    if that elsewhere is another file in this repo it is a real dependency.
    """
    declared_spans = set()
    for n in walk(root):
        if not n.type.startswith(SQL_CREATE_PREFIX):
            continue
        acc.sym()
        target = first_of_type(n, "object_reference")
        if target is not None:
            declared_spans.add((target.start_byte, target.end_byte))
            acc.decl(txt(target).lower())
    for n in walk(root):
        if n.type != "object_reference":
            continue
        if (n.start_byte, n.end_byte) in declared_spans:
            continue
        # `SELECT u.name FROM users u` parses the alias `u` as an
        # object_reference inside a `field`. It names a table only in that
        # query, so crediting it as a dependency would invent one called `u`.
        parent = n.parent
        if parent is not None and parent.type == "field":
            continue
        acc.imp(txt(n).lower(), "namespace")


HANDLERS = {
    "typescript": handle_js,
    "javascript": handle_js,
    "python": handle_python,
    "go": handle_go,
    "rust": handle_rust,
    "csharp": handle_csharp,
    "java": handle_java,
    "kotlin": handle_kotlin,
    "scala": handle_scala,
    "ruby": handle_ruby,
    "php": handle_php,
    "swift": handle_swift,
    "c": handle_c_family,
    "cpp": handle_c_family,
    "objc": handle_c_family,
    "lua": handle_lua,
    "elixir": handle_elixir,
    "julia": handle_julia,
    "zig": handle_zig,
    "vue": handle_js,
    "svelte": handle_js,
    "astro": handle_js,
    "bash": handle_bash,
    "groovy": handle_groovy,
    "json": handle_json,
    "dart": handle_dart,
    "terraform": handle_terraform,
    "powershell": handle_powershell,
    "sql": handle_sql,
}


# ---------------------------------------------------------------------------
# parser pool
# ---------------------------------------------------------------------------

class Parsers:
    """Lazily built tree-sitter parsers, one per grammar dialect.

    A missing grammar package is not fatal: that language's files simply come
    back with no imports, exactly like a file type birdsEye cannot parse at all.
    """

    def __init__(self) -> None:
        self._cache: dict[str, object] = {}
        self.missing: set[str] = set()

    def for_ext(self, ext: str):
        entry = LANGS.get(ext)
        if entry is None:
            return None, None
        lang_id, module_name, factory = entry
        key = f"{module_name}.{factory}"
        if key in self._cache:
            return lang_id, self._cache[key]
        if key in self.missing:
            return lang_id, None
        try:
            from tree_sitter import Language, Parser

            mod = importlib.import_module(module_name)
            language = Language(getattr(mod, factory)())
            parser = Parser(language)
        except Exception:  # noqa: BLE001
            # Reported as the pip package a user would install, not as the
            # internal cache key.
            self.missing.add(module_name.replace("_", "-"))
            return lang_id, None
        self._cache[key] = parser
        return lang_id, parser


# ---------------------------------------------------------------------------
# cache
# ---------------------------------------------------------------------------

def load_cache(cache_dir: Path) -> dict:
    try:
        with open(cache_dir / "extract.cache.json", encoding="utf8") as fh:
            data = json.load(fh)
    except Exception:  # noqa: BLE001
        return {}
    if data.get("version") != EXTRACTOR_VERSION:
        return {}
    entries = data.get("entries")
    return entries if isinstance(entries, dict) else {}


def save_cache(cache_dir: Path, entries: dict) -> None:
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        tmp = cache_dir / "extract.cache.json.tmp"
        with open(tmp, "w", encoding="utf8") as fh:
            json.dump({"version": EXTRACTOR_VERSION, "entries": entries}, fh)
        os.replace(tmp, cache_dir / "extract.cache.json")
    except Exception:  # noqa: BLE001
        # A cache we cannot write is a slow run, not a failed one.
        pass


# ---------------------------------------------------------------------------

def extract_one(parsers: Parsers, abs_path: Path, rel: str, source: bytes) -> dict:
    ext = Path(rel).suffix.lower()
    lang_id, parser = parsers.for_ext(ext)
    loc = source.count(b"\n") + (0 if source.endswith(b"\n") or not source else 1)
    record = {
        "path": rel,
        "lang": lang_id or (ext.lstrip(".") or "?"),
        "loc": loc,
        "symbols": 0,
        "imports": [],
        "declares": [],
    }
    if parser is None:
        return record
    if lang_id in SCRIPT_HOSTS:
        text = source.decode("utf8", "replace")
        source = script_regions(text, lang_id).encode("utf8")
    tree = parser.parse(source)
    acc = Acc()
    handler = HANDLERS.get(lang_id)
    if handler is not None:
        handler(tree.root_node, acc)
    record["symbols"] = acc.symbols
    record["imports"] = acc.imports
    record["declares"] = acc.declares
    return record


def main() -> None:
    try:
        job = json.load(sys.stdin)
    except Exception as exc:  # noqa: BLE001
        _fail(1, f"extract: bad job json: {exc}")

    try:
        import tree_sitter  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        _fail(3, f"extract: tree-sitter not importable: {exc}")

    repo_root = Path(job["repoRoot"]).resolve()
    cache_dir = Path(job.get("cacheDir") or (repo_root / "birdseye" / ".cache"))
    rels = list(job.get("files") or [])

    cache = load_cache(cache_dir)
    fresh: dict = {}
    parsers = Parsers()
    files: list[dict] = []
    failed: list[dict] = []
    parsed = cached = skipped = 0

    for rel in rels:
        abs_path = repo_root / rel
        try:
            source = abs_path.read_bytes()
        except Exception:  # noqa: BLE001
            skipped += 1
            continue
        digest = hashlib.sha256(source).hexdigest()
        hit = cache.get(rel)
        if hit and hit.get("hash") == digest:
            record = dict(hit["record"])
            record["path"] = rel
            files.append(record)
            fresh[rel] = {"hash": digest, "record": record}
            cached += 1
            continue
        try:
            record = extract_one(parsers, abs_path, rel, source)
        except Exception as exc:  # noqa: BLE001
            failed.append({"path": rel, "error": f"{type(exc).__name__}: {exc}"})
            continue
        files.append(record)
        fresh[rel] = {"hash": digest, "record": record}
        parsed += 1

    save_cache(cache_dir, fresh)

    json.dump(
        {
            "extractorVersion": EXTRACTOR_VERSION,
            "files": files,
            "failed": failed,
            "missingGrammars": sorted(parsers.missing),
            "stats": {"parsed": parsed, "cached": cached, "skipped": skipped},
        },
        sys.stdout,
    )
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
