// MSBuild project files. A .NET solution states its internal dependency graph
// exactly once, in `<ProjectReference Include="..\Core\Core.csproj" />`, and
// nowhere else - C# `using` names a namespace, not a project. `<Import>` pulls
// in shared build logic, which is the same kind of link.
//
// `<PackageReference>` is NuGet, so it is reported as an external dependency
// rather than resolved.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.csproj', '.fsproj', '.vbproj', '.props', '.targets'];

export default {
  id: 'msbuild',
  langs: ['msbuild'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    const inner = pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: [''],
    });
    return {
      resolve(spec, fromRel, kind) {
        if (kind === 'package') return { kind: 'external' };
        return inner.resolve(spec, fromRel, 'relative');
      },
    };
  },
};
