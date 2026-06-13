/** Client-safe RBAC helpers — no MongoDB or server imports. */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
};

export const ADMIN_GRANT_MODULES = [
  'blog',
  'gallery',
  'projects',
  'reviews',
  'leads',
  'ai_quotes',
  'customers',
  'analytics',
];

export const MODULE_KEYS = [
  'dashboard',
  'blog',
  'gallery',
  'projects',
  'reviews',
  'leads',
  'ai_quotes',
  'customers',
  'analytics',
  'marketing',
  'team',
  'contact_enquiries',
  'testimonials',
  'settings',
  'future_modules',
];

export const ACTION_KEYS = ['view', 'create', 'edit', 'delete', 'publish', 'archive'];

export const MODULE_LABELS = {
  dashboard: 'Dashboard',
  blog: 'Blog',
  gallery: 'Gallery',
  projects: 'Projects',
  reviews: 'Reviews',
  leads: 'Leads',
  ai_quotes: 'AI Quotes',
  customers: 'Customers',
  analytics: 'Analytics',
  marketing: 'Marketing',
  team: 'Team',
  contact_enquiries: 'Contact Enquiries',
  testimonials: 'Testimonials',
  settings: 'Settings',
  future_modules: 'Future Modules',
};

export const ACTION_LABELS = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  publish: 'Publish',
  archive: 'Archive',
};

function isEmptyMatrix(matrix) {
  return !matrix || typeof matrix !== 'object' || Object.keys(matrix).length === 0;
}

function hasMatrixAction(matrix, moduleKey, action) {
  return matrix?.[moduleKey]?.[action] === true;
}

function hasAnyModuleAccess(matrix, moduleKey) {
  const entry = matrix?.[moduleKey];
  if (!entry) return false;
  return ACTION_KEYS.some((action) => entry[action] === true);
}

function isLegacyFullAccess(user) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (user.permissions === undefined || user.permissions === null) return true;
  if (Array.isArray(user.permissions) && user.permissions.length === 0) return true;
  if (typeof user.permissions === 'object' && !Array.isArray(user.permissions)) {
    return isEmptyMatrix(user.permissions);
  }
  return false;
}

export function isSuperAdmin(user) {
  if (!user) return false;
  if (user.isSuperAdmin === true) return true;
  return user.role === ROLES.SUPER_ADMIN;
}

export function canAccess(user, moduleKey, action = 'view') {
  if (!user) return false;
  if (user.status === 'suspended') return false;
  if (isSuperAdmin(user) || isLegacyFullAccess(user)) return true;
  const matrix = user.permissions || {};
  if (action) return hasMatrixAction(matrix, moduleKey, action);
  return hasAnyModuleAccess(matrix, moduleKey);
}

export function canAccessAny(user, moduleKeys, action = 'view') {
  if (!user) return false;
  return moduleKeys.some((moduleKey) => canAccess(user, moduleKey, action));
}

export function emptyPermissionMatrix() {
  const matrix = {};
  for (const moduleKey of MODULE_KEYS) {
    matrix[moduleKey] = {};
    for (const action of ACTION_KEYS) {
      matrix[moduleKey][action] = false;
    }
  }
  return matrix;
}

export function toggleMatrixAction(matrix, moduleKey, action, granted) {
  return {
    ...matrix,
    [moduleKey]: {
      ...(matrix[moduleKey] || {}),
      [action]: granted,
    },
  };
}

export function toggleModuleRow(matrix, moduleKey, granted) {
  const next = { ...matrix };
  next[moduleKey] = {};
  for (const action of ACTION_KEYS) {
    next[moduleKey][action] = granted;
  }
  return next;
}

export async function adminApiFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    return { response, data, forbidden: response.status === 403, unauthorized: response.status === 401 };
  } catch (error) {
    return {
      response: { ok: false, status: 0 },
      data: { error: error?.name === 'AbortError' ? 'Request timed out.' : 'Request failed.' },
      forbidden: false,
      unauthorized: false,
      failed: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(value);
  }
}

export const ACTION_LABELS_EXTENDED = {
  login: 'Login',
  logout: 'Logout',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  publish: 'Publish',
  archive: 'Archive',
  assign_permissions: 'Permission Change',
  permission_change: 'Permission Change',
  reset_password: 'Password Reset',
  suspend: 'Suspension',
  suspension: 'Suspension',
  activate: 'Activation',
  activation: 'Activation',
  admin_creation: 'Admin Creation',
  admin_deletion: 'Admin Deletion',
};
