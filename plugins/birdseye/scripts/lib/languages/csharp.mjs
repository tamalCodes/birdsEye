// C# / .NET. `using` names a namespace, and namespaces are decoupled from file
// paths, so there is no exact file to resolve to without a compiler. Instead
// every `.cs` file reports the namespaces it declares, which builds a
// namespace -> files index, and an import of a namespace draws an edge to every
// file that declares it. Real files, coarser target - the edges are tagged
// `approx`.

export default {
  id: 'csharp',
  langs: ['csharp'],
  extensions: ['.cs'],
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    // Namespace declarations come straight from the parse: no second regex
    // sweep of every file, and no false hit inside a comment or a string.
    const nsToFiles = new Map();
    for (const f of allFiles) {
      if (!f.endsWith('.cs')) continue;
      for (const ns of declaresOf(f)) {
        if (!nsToFiles.has(ns)) nsToFiles.set(ns, new Set());
        nsToFiles.get(ns).add(f);
      }
    }

    return {
      resolve(spec, fromRel) {
        // Exact namespace, else the longest declared prefix (covers
        // `using static Some.Namespace.TypeName`).
        let ns = spec;
        while (ns && !nsToFiles.has(ns)) {
          const cut = ns.lastIndexOf('.');
          if (cut === -1) {
            ns = null;
            break;
          }
          ns = ns.slice(0, cut);
        }
        if (ns) {
          const paths = [...nsToFiles.get(ns)].filter((p) => p !== fromRel);
          return paths.length ? { kind: 'file', paths, approx: true } : { kind: 'external' };
        }
        // Not a namespace declared anywhere in the repo - System.*, a NuGet
        // package, or a namespace with no files of its own. All external.
        return { kind: 'external' };
      },
    };
  },
};
