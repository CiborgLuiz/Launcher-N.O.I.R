import { ModLoader } from "../../shared/src";

export function parseModLoader(modLoaders: Array<{ id: string; primary: boolean }>): { type: ModLoader; version: string } {
  const primary = modLoaders.find((loader) => loader.primary) || modLoaders[0];
  if (!primary?.id) {
    throw new Error("Manifest sem modloader primario");
  }

  const [type, ...rest] = primary.id.split("-");
  const normalized = type === "neoForge" ? "neoforge" : type.toLowerCase();
  if (!["forge", "fabric", "neoforge", "quilt"].includes(normalized)) {
    throw new Error(`Modloader nao suportado: ${primary.id}`);
  }
  return {
    type: normalized as ModLoader,
    version: rest.join("-")
  };
}
