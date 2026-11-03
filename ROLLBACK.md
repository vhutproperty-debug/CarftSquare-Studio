# CraftSquare OS rollback

New work is additive. Existing pages, APIs, and collections stay in place. Turning a phase off or reverting its pull request leaves stored documents where they are. Nothing in these phases deletes or auto-merges records.

## Flags

Set the variable to `0` and redeploy. Permission checks from Phase 0 stay in force when `CSOS_PHASE_0=0`; that flag only hides the new user screen, it does not grant import, export, edit, or delete.

| Phase | Flag | Safe default when unset |
| --- | --- | --- |
| 0 Access and audit | `CSOS_PHASE_0` | On. Enforcement cannot be widened by the flag. |
| 1 Ops workspace | `CSOS_PHASE_1` | On. Set `0` to hide the duplicate queue, agreement terms, and dashboard strip. |
| 2 Inventory | `CSOS_PHASE_2` | On. Set `0` to hide the inventory registry. |
| 3 Leads and broker portal | `CSOS_PHASE_3` | On. Set `0` to hide requirements, the inbox, and the broker portal. |
| 4 Deals and visits | `CSOS_PHASE_4` | On. Set `0` to hide site visits. |
| 5 Finance | `CSOS_PHASE_5` | On. Set `0` to hide expenses and the payments ledger. |
| 6 Channels and interior | `CSOS_PHASE_6` | On for the interior screen. Meta automation stays off unless `CSOS_META_AUTOMATION=1`. WhatsApp send stays blocked while the WABA is restricted. |

`CSOS_META_AUTOMATION` defaults off. Even when it is on, campaign creation is paused-only and cannot activate a campaign or change a budget.

## Revert a phase

1. Revert that phase's pull request. Later phases stack on earlier ones, so revert from the top of the stack downward, or revert the range you want gone.
2. Set that phase's `CSOS_PHASE_N=0` if the deploy still contains the code.
3. Leave the new collections in MongoDB. They are unused once the code is gone, and dropping them is a separate, explicit decision.

## Data written by each phase

Down steps do not delete documents.

| Phase | Collections added | Down step |
| --- | --- | --- |
| 0 | `ops_audit_events` (append-only). New role values on existing `admins` documents only when a super admin creates or edits a user. | Stop creating users with the new roles. Existing `admin` and `super_admin` rows are unchanged. Audit events can stay. |
| 1 | `contact_duplicate_reviews`, `ops_agreement_terms` | Ignore the collections. Contacts and agreements are not rewritten. |
| 2 | `ops_developers`, `ops_towers`, `ops_canonical_apartments`, `ops_rental_listings` | Ignore the collections. Developer projects and resale units are not merged or deleted. |
| 3 | `ops_client_requirements`, `ops_inbox_items` are not stored as a merged lead. Inbox is a read model. Requirements are new rows. | Ignore `ops_client_requirements`. |
| 4 | `ops_site_visits` | Ignore the collection. Deal documents are not deleted. |
| 5 | `ops_expenses`, `ops_payments` | Ignore the collections. Commission is not marked collected without a verified payment row. |
| 6 | `ops_interior_projects` | Ignore the collection. No campaign is activated. |

## Phase 0 access change to know about

Resale owner name, phone, and flat number are returned only to the super admin. Team logins still see full fields on the contacts and cold-call screens. External broker responses are redacted on the server.
