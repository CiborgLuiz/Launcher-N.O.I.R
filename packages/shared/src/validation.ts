export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function expectObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) {
    throw new Error(`${label} precisa ser um objeto`);
  }
  return value;
}

export function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} precisa ser uma string nao vazia`);
  }
  return value;
}

export function expectOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return expectString(value, label);
}

export function expectNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} precisa ser um numero valido`);
  }
  return value;
}

export function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} precisa ser booleano`);
  }
  return value;
}

export function expectArray<T = unknown>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} precisa ser uma lista`);
  }
  return value as T[];
}

export function expectEnum<T extends string>(value: unknown, label: string, allowed: readonly T[]): T {
  const candidate = expectString(value, label);
  if (!allowed.includes(candidate as T)) {
    throw new Error(`${label} precisa ser um de: ${allowed.join(", ")}`);
  }
  return candidate as T;
}
