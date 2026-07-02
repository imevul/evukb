import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kbUiPackageJson = fileURLToPath(
  new URL('../../packages/kb-ui/package.json', import.meta.url),
);
const requireFromKbUi = createRequire(kbUiPackageJson);

function resolvePackageRoot(specifier: string): string {
  let current = path.dirname(requireFromKbUi.resolve(specifier));
  while (current !== path.dirname(current)) {
    try {
      const pkg = requireFromKbUi(`${current}/package.json`) as { name?: string };
      if (pkg.name === specifier) {
        return current;
      }
    } catch {
      // Keep walking up until the package.json for this specifier is found.
    }
    current = path.dirname(current);
  }
  throw new Error(`Could not resolve package root for ${specifier}`);
}

function resolvePackageDist(specifier: string, distFile: string): string {
  const resolved = requireFromKbUi.resolve(specifier);
  return path.join(path.dirname(resolved), distFile);
}

/** Resolve CodeMirror entry points from kb-ui's dependency graph (pnpm-safe). */
export function codemirrorAlias(specifier: string, distFile: string) {
  return {
    find: specifier,
    replacement: resolvePackageDist(specifier, distFile),
  } as const;
}

export function codemirrorResolve(specifier: string, distFile: string): string {
  return resolvePackageDist(specifier, distFile);
}

export function uiwReactCodemirrorAlias() {
  return {
    find: '@uiw/react-codemirror',
    replacement: uiwReactCodemirrorResolve(),
  } as const;
}

export function uiwReactCodemirrorResolve(): string {
  return path.join(resolvePackageRoot('@uiw/react-codemirror'), 'esm/index.js');
}
