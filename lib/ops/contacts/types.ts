export const CONTACTS_COLLECTION = 'contacts';
export const COMPLEX_LINKS_COLLECTION = 'complex_links';
export const UNITS_COLLECTION = 'units';
export const UNIT_LINKS_COLLECTION = 'unit_links';
export const INTERACTIONS_COLLECTION = 'interactions';
export const TASKS_COLLECTION = 'tasks';
export const CONTACT_IMPORT_JOBS_COLLECTION = 'contact_import_jobs';
export const CONTACT_IMPORT_ROWS_COLLECTION = 'contact_import_rows';
export const CONTACT_IMPORT_JOURNAL_COLLECTION = 'contact_import_journal';

export const CONTACT_ROLES = ['owner', 'tenant', 'broker', 'buyer'] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const UNIT_RELATIONS = ['owner', 'tenant'] as const;
export type UnitRelation = (typeof UNIT_RELATIONS)[number];

export const CALL_OUTCOMES = ['interested', 'callback', 'not_interested', 'wrong_number', 'dnd'] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  interested: 'Interested',
  callback: 'Callback',
  not_interested: 'Not interested',
  wrong_number: 'Wrong number',
  dnd: 'DND',
};

/** Stored when no agreement end is known so expiring dates sort first. */
export const FAR_DATE = '9999-12-31';

export const IMPORT_STAGE_LIMIT = 400;
export const IMPORT_COMMIT_LIMIT = 200;
export const UPSERT_LIMIT = 200;

export type Contact = {
  id: string;
  name: string;
  phones: string[];
  email: string;
  roles: ContactRole[];
  do_not_call: boolean;
  opted_out: boolean;
  suspected_broker: 'VERIFY' | null;
  wrong_number: boolean;
  source: string;
  assignedTo: string;
  lastOutcome: string;
  lastContactedAt: string;
  unitCount: number;
  ownerUnitCount: number;
  nearestAgreementEnd: string;
  queueBand: number;
  complexKeys: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type ComplexLink = {
  id: string;
  contactId: string;
  complex: string;
  complexKey: string;
  createdAt: string;
  createdBy: string;
  importJobId: string;
};

export type UnitRecord = {
  id: string;
  complex: string;
  complexKey: string;
  tower: string;
  towerKey: string;
  flat: string;
  flatKey: string;
  unitKey: string;
  createdAt: string;
  updatedAt: string;
};

export type UnitLink = {
  id: string;
  contactId: string;
  unitId: string;
  relation: UnitRelation;
  agreementStart: string;
  agreementEnd: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  importJobId: string;
};

export type InteractionChange = {
  field: string;
  from: string;
  to: string;
};

export type InteractionKind = 'call' | 'note' | 'outcome' | 'field_fill' | 'assign' | 'import' | 'system';

export type Interaction = {
  id: string;
  contactId: string;
  kind: InteractionKind;
  outcome: string;
  note: string;
  changes: InteractionChange[];
  actorId: string;
  actorEmail: string;
  actorName: string;
  importJobId: string;
  createdAt: string;
};

export type OpsTask = {
  id: string;
  contactId: string;
  type: 'callback' | 'assignment';
  dueAt: string;
  assigneeId: string;
  status: 'open' | 'done' | 'cancelled';
  note: string;
  createdBy: string;
  sourceInteractionId: string;
  createdAt: string;
  updatedAt: string;
};

export type ContactIndexSpec = {
  collection: string;
  keys: Record<string, 1 | -1>;
  options?: { unique?: boolean; sparse?: boolean };
};

/**
 * Indexes sized for a directory of about 88,000 contacts.
 * Phone uniqueness is a multikey index: one number belongs to one contact.
 * The queue index supports the daily sort without scanning every document into memory.
 */
export const CONTACT_INDEX_SPECS: ContactIndexSpec[] = [
  { collection: CONTACTS_COLLECTION, keys: { id: 1 }, options: { unique: true } },
  { collection: CONTACTS_COLLECTION, keys: { phones: 1 }, options: { unique: true, sparse: true } },
  { collection: CONTACTS_COLLECTION, keys: { name: 1 } },
  { collection: CONTACTS_COLLECTION, keys: { updatedAt: -1 } },
  { collection: CONTACTS_COLLECTION, keys: { suspected_broker: 1 }, options: { sparse: true } },
  { collection: CONTACTS_COLLECTION, keys: { email: 1 }, options: { sparse: true } },
  {
    collection: CONTACTS_COLLECTION,
    keys: { do_not_call: 1, opted_out: 1, wrong_number: 1, queueBand: 1, ownerUnitCount: -1, nearestAgreementEnd: 1 },
  },
  { collection: CONTACTS_COLLECTION, keys: { complexKeys: 1, queueBand: 1 } },
  { collection: CONTACTS_COLLECTION, keys: { assignedTo: 1, queueBand: 1 } },
  { collection: COMPLEX_LINKS_COLLECTION, keys: { id: 1 }, options: { unique: true } },
  { collection: COMPLEX_LINKS_COLLECTION, keys: { contactId: 1, complexKey: 1 }, options: { unique: true } },
  { collection: COMPLEX_LINKS_COLLECTION, keys: { complexKey: 1 } },
  { collection: COMPLEX_LINKS_COLLECTION, keys: { contactId: 1 } },
  { collection: UNITS_COLLECTION, keys: { id: 1 }, options: { unique: true } },
  { collection: UNITS_COLLECTION, keys: { unitKey: 1 }, options: { unique: true } },
  { collection: UNITS_COLLECTION, keys: { complexKey: 1 } },
  { collection: UNIT_LINKS_COLLECTION, keys: { id: 1 }, options: { unique: true } },
  { collection: UNIT_LINKS_COLLECTION, keys: { contactId: 1, unitId: 1 }, options: { unique: true } },
  { collection: UNIT_LINKS_COLLECTION, keys: { unitId: 1 } },
  { collection: UNIT_LINKS_COLLECTION, keys: { contactId: 1 } },
  { collection: UNIT_LINKS_COLLECTION, keys: { agreementEnd: 1 } },
  { collection: UNIT_LINKS_COLLECTION, keys: { relation: 1 } },
  { collection: INTERACTIONS_COLLECTION, keys: { id: 1 }, options: { unique: true } },
  { collection: INTERACTIONS_COLLECTION, keys: { contactId: 1, createdAt: -1 } },
  { collection: INTERACTIONS_COLLECTION, keys: { actorId: 1, createdAt: -1 } },
  { collection: INTERACTIONS_COLLECTION, keys: { importJobId: 1 } },
  { collection: TASKS_COLLECTION, keys: { id: 1 }, options: { unique: true } },
  { collection: TASKS_COLLECTION, keys: { contactId: 1, status: 1 } },
  { collection: TASKS_COLLECTION, keys: { assigneeId: 1, status: 1, dueAt: 1 } },
  { collection: TASKS_COLLECTION, keys: { type: 1, status: 1, dueAt: 1 } },
  { collection: CONTACT_IMPORT_JOBS_COLLECTION, keys: { id: 1 }, options: { unique: true } },
  { collection: CONTACT_IMPORT_JOBS_COLLECTION, keys: { createdAt: -1 } },
  { collection: CONTACT_IMPORT_ROWS_COLLECTION, keys: { id: 1 }, options: { unique: true } },
  { collection: CONTACT_IMPORT_ROWS_COLLECTION, keys: { jobId: 1, status: 1 } },
  { collection: CONTACT_IMPORT_ROWS_COLLECTION, keys: { jobId: 1, phoneKeys: 1 } },
  { collection: CONTACT_IMPORT_ROWS_COLLECTION, keys: { jobId: 1, index: 1 } },
  { collection: CONTACT_IMPORT_JOURNAL_COLLECTION, keys: { id: 1 }, options: { unique: true } },
  { collection: CONTACT_IMPORT_JOURNAL_COLLECTION, keys: { jobId: 1, seq: 1 } },
  { collection: CONTACT_IMPORT_JOURNAL_COLLECTION, keys: { jobId: 1, contactId: 1 }, options: { unique: true } },
];
