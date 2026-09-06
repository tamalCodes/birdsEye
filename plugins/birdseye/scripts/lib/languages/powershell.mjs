// PowerShell. Dot-sourcing (`. .\lib\helpers.ps1`) runs another script in the
// current scope, and `Import-Module ./Tools.psm1` loads one by path. Both are
// real file dependencies. Paths are written with backslashes as often as not,
// so they are normalised before probing.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.ps1', '.psm1', '.psd1'];

export default {
  id: 'powershell',
  langs: ['powershell'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    const inner = pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: ['', 'Modules', 'scripts', 'lib'],
    });
    return {
      resolve(spec, fromRel, kind) {
        const normalised = spec.replace(/\\/g, '/').replace(/^\.\//, '');
        // `Import-Module ActiveDirectory` names an installed module, not a file.
        if (!/\.(ps1|psm1|psd1)$/i.test(normalised)) return { kind: 'external' };
        return inner.resolve(normalised, fromRel, kind);
      },
    };
  },
};
