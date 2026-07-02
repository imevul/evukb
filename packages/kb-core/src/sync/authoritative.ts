export function isMountAuthoritativeEnabled(env: Record<string, string | undefined>): boolean {
  return env.EVUKB_ENABLE_MOUNT_AUTHORITATIVE === 'true';
}

export function isImportWritebackEnabled(env: Record<string, string | undefined>): boolean {
  return env.EVUKB_ENABLE_IMPORT_WRITEBACK === 'true';
}

export function managedRelativePath(path: string, name: string): string {
  return path ? `${path}/${name}` : name;
}

export function resolveManagedMountRelativePath(node: { path: string; name: string }): string {
  return managedRelativePath(node.path, node.name);
}

export function shouldDeleteManagedPath(
  relativePath: string,
  keepRelativePaths: ReadonlySet<string>,
): boolean {
  return !keepRelativePaths.has(relativePath);
}
