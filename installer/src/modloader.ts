export type ModLoaderInfo = {
  type: 'forge' | 'fabric' | 'neoforge' | 'quilt' | 'vanilla';
  version: string;
};

export function parseModloader(modLoaders: { id: string; primary: boolean }[]) {
  const primary = modLoaders.find((m) => m.primary) || modLoaders[0];
  if (!primary) return { type: 'vanilla', version: '' } as ModLoaderInfo;
  const [loader, version] = primary.id.split('-');
  if (loader.includes('forge')) return { type: 'forge', version };
  if (loader.includes('fabric')) return { type: 'fabric', version };
  if (loader.includes('neoforge')) return { type: 'neoforge', version };
  if (loader.includes('quilt')) return { type: 'quilt', version };
  return { type: 'vanilla', version: '' };
}
