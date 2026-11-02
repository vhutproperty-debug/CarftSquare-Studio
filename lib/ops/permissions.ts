import { isSuperAdmin } from '@/lib/auth/rbac/roles';
import { MODULES } from '@/lib/auth/rbac/modules';

export const OPS_MODULE = MODULES.OPS;

export const OPS_PERMISSIONS = {
  dashboard: OPS_MODULE,
  leads: OPS_MODULE,
  contactsView: OPS_MODULE,
  contactsAdd: OPS_MODULE,
  contactsImport: OPS_MODULE,
  contactsExport: OPS_MODULE,
  contactsEdit: OPS_MODULE,
  contactsDelete: OPS_MODULE,
} as const;

export type ContactActor = {
  id: string;
  email: string;
  name: string;
  role: string;
  via: 'session' | 'token';
  status?: string;
};

export type ContactCapabilities = {
  view: boolean;
  importData: boolean;
  exportData: boolean;
  editExisting: boolean;
  deleteData: boolean;
  addInformation: boolean;
  fillEmpty: boolean;
};

/**
 * Viewing is open to every active ops user, with phones and flat numbers included.
 * Import, export, edits of existing data, and deletes are super-admin only.
 * A bearer OPS_API_TOKEN actor is treated as a full importer for the upsert endpoint.
 */
export function contactCapabilities(
  actor: { role?: string; via?: 'session' | 'token'; status?: string } | null | undefined,
): ContactCapabilities {
  const active = Boolean(actor) && actor?.status !== 'suspended';
  const full = active && (actor?.via === 'token' || isSuperAdmin(actor));
  return {
    view: active,
    importData: full,
    exportData: full,
    editExisting: full,
    deleteData: full,
    addInformation: active,
    fillEmpty: active,
  };
}
