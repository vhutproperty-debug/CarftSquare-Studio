export const ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  PUBLISH: 'publish',
  ARCHIVE: 'archive',
} as const;

export type ActionKey = (typeof ACTIONS)[keyof typeof ACTIONS];

export const ACTION_KEYS: ActionKey[] = Object.values(ACTIONS);

export const ACTION_LABELS: Record<ActionKey, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  publish: 'Publish',
  archive: 'Archive',
};

export function methodToAction(method: string): ActionKey {
  switch (String(method || 'GET').toUpperCase()) {
    case 'POST':
      return ACTIONS.CREATE;
    case 'PUT':
    case 'PATCH':
      return ACTIONS.EDIT;
    case 'DELETE':
      return ACTIONS.DELETE;
    default:
      return ACTIONS.VIEW;
  }
}
