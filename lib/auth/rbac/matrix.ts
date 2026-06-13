import { ACTION_KEYS, type ActionKey } from '@/lib/auth/rbac/actions';
import { MODULE_KEYS, type ModuleKey } from '@/lib/auth/rbac/modules';

export type PermissionMatrix = Partial<Record<ModuleKey, Partial<Record<ActionKey, boolean>>>>;

export function createFullMatrix(granted = true): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  for (const moduleKey of MODULE_KEYS) {
    matrix[moduleKey] = {};
    for (const action of ACTION_KEYS) {
      matrix[moduleKey]![action] = granted;
    }
  }
  return matrix;
}

export function createModuleFullAccess(moduleKey: ModuleKey, granted = true): Partial<Record<ActionKey, boolean>> {
  const entry: Partial<Record<ActionKey, boolean>> = {};
  for (const action of ACTION_KEYS) {
    entry[action] = granted;
  }
  return entry;
}

function isValidModuleKey(value: string): value is ModuleKey {
  return MODULE_KEYS.includes(value as ModuleKey);
}

function isValidActionKey(value: string): value is ActionKey {
  return ACTION_KEYS.includes(value as ActionKey);
}

export function migrateLegacyPermissionList(list: string[]): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  for (const item of list) {
    const moduleKey = String(item).trim();
    if (isValidModuleKey(moduleKey)) {
      matrix[moduleKey] = createModuleFullAccess(moduleKey, true);
    }
  }
  return matrix;
}

export function normalizePermissionMatrix(input: unknown): PermissionMatrix {
  if (Array.isArray(input)) {
    return migrateLegacyPermissionList(input.map(String));
  }

  if (!input || typeof input !== 'object') {
    return {};
  }

  const matrix: PermissionMatrix = {};
  for (const [rawModule, rawActions] of Object.entries(input as Record<string, unknown>)) {
    if (!isValidModuleKey(rawModule) || !rawActions || typeof rawActions !== 'object' || Array.isArray(rawActions)) {
      continue;
    }

    const moduleEntry: Partial<Record<ActionKey, boolean>> = {};
    for (const [rawAction, rawValue] of Object.entries(rawActions as Record<string, unknown>)) {
      if (isValidActionKey(rawAction) && rawValue === true) {
        moduleEntry[rawAction] = true;
      }
    }

    if (Object.keys(moduleEntry).length) {
      matrix[rawModule] = moduleEntry;
    }
  }

  return matrix;
}

export function isEmptyPermissionMatrix(matrix: PermissionMatrix): boolean {
  return !matrix || Object.keys(matrix).length === 0;
}

export function hasMatrixAction(
  matrix: PermissionMatrix,
  moduleKey: ModuleKey,
  action: ActionKey,
): boolean {
  return matrix[moduleKey]?.[action] === true;
}

export function hasAnyModuleAccess(matrix: PermissionMatrix, moduleKey: ModuleKey): boolean {
  const entry = matrix[moduleKey];
  if (!entry) return false;
  return ACTION_KEYS.some((action) => entry[action] === true);
}

export function countGrantedActions(matrix: PermissionMatrix): number {
  let count = 0;
  for (const moduleKey of MODULE_KEYS) {
    const entry = matrix[moduleKey];
    if (!entry) continue;
    for (const action of ACTION_KEYS) {
      if (entry[action]) count += 1;
    }
  }
  return count;
}

export function matrixToCatalog(matrix: PermissionMatrix) {
  return MODULE_KEYS.map((moduleKey) => ({
    module: moduleKey,
    actions: ACTION_KEYS.filter((action) => hasMatrixAction(matrix, moduleKey, action)),
  }));
}
