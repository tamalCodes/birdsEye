// Dart and Flutter. Three directives name another file - `import`, `export`
// and `part` - and all three carry a URI. Three URI shapes matter:
//
//   'dart:core'                 the SDK, always external
//   'package:myapp/x.dart'      this package's own lib/, when the name matches
//                               a pubspec in the repo; anything else is a
//                               third-party package
//   './x.dart', 'sub/x.dart'    relative to the importing file
//
// Getting `package:` right is what makes a Flutter app read as a connected
// graph rather than a pile of unrelated files, because idiomatic Dart imports
// its own code by package URI rather than by relative path.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.dart'];

export default {
  id: 'dart',
  langs: ['dart'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, readFile }) {
    const files = new Set(filesWithExtensions(allFiles, EXTENSIONS));
    const byPath = pathResolver({ files, extensions: EXTENSIONS, roots: ['', 'lib'] });

    // package name -> the directory holding its pubspec, so a monorepo with
    // several packages resolves each one to its own lib/.
    const packages = new Map();
    for (const f of allFiles) {
      if (f !== 'pubspec.yaml' && !f.endsWith('/pubspec.yaml')) continue;
      const base = f === 'pubspec.yaml' ? '' : f.slice(0, -'/pubspec.yaml'.length);
      const m = (readFile(f) || '').match(/^\s*name:\s*['"]?([A-Za-z_][\w]*)['"]?\s*$/m);
      if (m) packages.set(m[1], base);
    }

    return {
      resolve(spec, fromRel, kind) {
        if (spec.startsWith('dart:')) return { kind: 'external' };
        if (spec.startsWith('package:')) {
          const rest = spec.slice('package:'.length);
          const cut = rest.indexOf('/');
          if (cut === -1) return { kind: 'external' };
          const pkg = rest.slice(0, cut);
          if (!packages.has(pkg)) return { kind: 'external' };
          const base = packages.get(pkg);
          const target = [base, 'lib', rest.slice(cut + 1)].filter(Boolean).join('/');
          return files.has(target) && target !== fromRel
            ? { kind: 'file', paths: [target] }
            : { kind: 'unresolved' };
        }
        // A bare `sub/x.dart` in a directive is relative to the file, not to a
        // source root, so it is resolved that way.
        return byPath.resolve(spec, fromRel, 'relative');
      },
    };
  },
};
