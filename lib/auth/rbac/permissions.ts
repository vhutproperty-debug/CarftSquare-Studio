export {
  MODULES,
  MODULE_KEYS,
  MODULE_LABELS,
  PERMISSIONS,
  PERMISSION_LABELS,
  ALL_PERMISSIONS,
  type ModuleKey,
  type Permission,
} from '@/lib/auth/rbac/modules';

export {
  ACTIONS,
  ACTION_KEYS,
  ACTION_LABELS,
  methodToAction,
  type ActionKey,
} from '@/lib/auth/rbac/actions';

export {
  createFullMatrix,
  createModuleFullAccess,
  normalizePermissionMatrix,
  hasMatrixAction,
  hasAnyModuleAccess,
  isEmptyPermissionMatrix,
  countGrantedActions,
  matrixToCatalog,
  migrateLegacyPermissionList,
  type PermissionMatrix,
} from '@/lib/auth/rbac/matrix';
