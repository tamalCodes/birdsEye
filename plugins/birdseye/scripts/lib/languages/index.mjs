// The language registry. Each module owns one language family's *resolution*:
// turning an import specifier the extractor found into the file it points at.
// Parsing itself is shared - lib/py/extract.py handles every language - so a
// module here is only ever about what a specifier means in that language.
//
// A language is *active* for a repo when the repo actually contains files with
// its extensions and the module's `detect(root, files)` agrees. Detection is
// automatic - no config needed.

import path from 'node:path';
import javascript from './javascript.mjs';
import go from './go.mjs';
import python from './python.mjs';
import rust from './rust.mjs';
import csharp from './csharp.mjs';
import java from './java.mjs';
import kotlin from './kotlin.mjs';
import scala from './scala.mjs';
import swift from './swift.mjs';
import elixir from './elixir.mjs';
import ruby from './ruby.mjs';
import php from './php.mjs';
import cfamily from './cfamily.mjs';
import lua from './lua.mjs';
import julia from './julia.mjs';
import zig from './zig.mjs';
import bash from './bash.mjs';
import groovy from './groovy.mjs';
import json from './json.mjs';
import dart from './dart.mjs';
import terraform from './terraform.mjs';
import powershell from './powershell.mjs';
import sql from './sql.mjs';
import ocaml from './ocaml.mjs';
import fortran from './fortran.mjs';
import verilog from './verilog.mjs';
import pascal from './pascal.mjs';
import commonlisp from './commonlisp.mjs';
import perl from './perl.mjs';
import msbuild from './msbuild.mjs';

export const LANGUAGES = [
  javascript, go, python, rust, csharp,
  java, kotlin, scala, swift, elixir,
  ruby, php, cfamily, lua, julia, zig,
  bash, groovy, json,
  dart, terraform, powershell, sql,
  ocaml, fortran, verilog, pascal, commonlisp, perl, msbuild,
];

/** Every extension any language can parse - the widened `config.extensions`. */
export const ALL_EXTENSIONS = [...new Set(LANGUAGES.flatMap((l) => l.extensions))];

/** @returns {Array<{id:string, extensions:string[], module:object}>} */
export function resolveLanguages(root, files) {
  const present = new Set(files.map((f) => path.extname(f).toLowerCase()));
  return LANGUAGES.filter(
    (m) => m.extensions.some((e) => present.has(e)) && m.detect(root, files),
  ).map((m) => ({ id: m.id, extensions: m.extensions, module: m }));
}

/** The language module owning `rel`'s extension, or null. */
export function languageForFile(rel, active) {
  const ext = path.extname(rel).toLowerCase();
  return active.find((l) => l.extensions.includes(ext))?.module ?? null;
}

/**
 * The module that resolves for an extractor language id (`typescript`, `objc`).
 * The extractor's ids are finer than the registry's: one module can own several,
 * which is why `langs` exists alongside `id`.
 */
export function moduleForLang(langId) {
  return LANGUAGES.find((m) => (m.langs ?? [m.id]).includes(langId)) ?? null;
}

export function allExtensions(active) {
  return [...new Set(active.flatMap((l) => l.extensions))];
}
