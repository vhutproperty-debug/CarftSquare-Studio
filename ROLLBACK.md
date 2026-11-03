# CraftSquare OS rollback

New work is additive. Existing pages, APIs, and collections stay in place. Turning a phase off or reverting its pull request leaves stored documents where they are. Nothing in these phases deletes or auto-merges records.

## Flags

Every `CSOS_PHASE_N` is off until it is set to `1`. Permission checks from Phase 0 stay in force when `CSOS_PHASE_0` is unset. That flag only shows the new user screen. It does not grant import, export, edit, or delete.

| Phase | Flag to turn it on | Safe default when unset |
| --- | --- | --- |
| 0 Access and audit | `CSOS_PHASE_0=1` | Off for the user screen. Enforcement stays on. |
| 1 Ops workspace | `CSOS_PHASE_1=1` | Off. Duplicate queue, agreement terms, and dashboard strip stay hidden. |
| 2 Inventory | `CSOS_PHASE_2=1` | Off. Inventory registry stays hidden. |
| 3 Leads and broker portal | `CSOS_PHASE_3=1` | Off. Requirements, inbox, and broker portal stay hidden. |
| 4 Deals and visits | `CSOS_PHASE_4=1` | Off. Site visits stay hidden. |
| 5 Finance | `CSOS_PHASE_5=1` | Off. Expenses and the payments ledger stay hidden. |
| 6 Channels and interior | `CSOS_PHASE_6=1` | Off. Interior screen stays hidden. |

`CSOS_META_AUTOMATION` defaults off. Set it to `1` only to store paused campaign drafts. It cannot activate a campaign or change a budget. WhatsApp sending from the new channel route stays blocked, and the existing sender stays blocked while the WABA is restricted.

WhatsApp sends stay blocked unless `WHATSAPP_WABA_SEND_OVERRIDE=unrestricted` and Meta reports the WABA as unrestricted (`account_review_status=APPROVED`, `business_verification_status=verified`, and `health_status.can_send_message=AVAILABLE`). The override defaults to blocked. Unset it, or set it to `blocked`, to stop sends again. That does not delete conversations.

## Phase 7 flags

Every `CSOS_P7_*` module is off until it is set to `1`. Turning one off hides that module. Stored rows stay.

| Module | Flag to turn it on | Safe default when unset |
| --- | --- | --- |
| Campaign Studio | `CSOS_P7_CAMPAIGN_STUDIO=1` | Off. Proposals stay hidden. Nothing is created or activated on Meta. |
| Lead Capture | `CSOS_P7_LEAD_CAPTURE=1` | Off. Meta and WhatsApp webhooks do not write growth inbox rows. |
| Demand Profiler | `CSOS_P7_DEMAND_PROFILER=1` | Off. Profiles stay hidden. Contacts are not edited. |
| Lead Intelligence | `CSOS_P7_LEAD_INTELLIGENCE=1` | Off. Scores and new duplicate reviews stay hidden. Contacts are not merged. |
| Automated Follow-up | `CSOS_P7_FOLLOWUP=1` | Off. New batches stay hidden. Sends stay blocked while the WABA is restricted. |
| Revenue Attribution | `CSOS_P7_REVENUE=1` | Off. The report stays hidden. Payments are not edited. |

## Phase 7 production snapshot

Recorded on 3 November 2026, before any `CSOS_P7_*` flag was set in production. This is the deployment to promote if Phase 7 must come back down. Nothing was deleted to take this snapshot.

| Item | Value |
| --- | --- |
| Project | `craftsquare-studio` |
| Production deployment | `dpl_GKMyNRGXLKg4KXnnEiptF8hEcYa3` |
| Commit | `0de2efdd793af6c9934010deb65e87e71aaa1c15` |
| Aliases | `craftsquare.co.in`, `www.craftsquare.co.in` |

Production `CSOS_*` values at that deployment. `WHATSAPP_WABA_SEND_OVERRIDE` was unset.

| Name | Production value |
| --- | --- |
| `CSOS_PHASE_0` | `1` |
| `CSOS_PHASE_1` | `1` |
| `CSOS_PHASE_2` | `1` |
| `CSOS_PHASE_3` | `1` |
| `CSOS_PHASE_4` | `1` |
| `CSOS_PHASE_5` | `1` |
| `CSOS_PHASE_6` | `1` |
| `CSOS_META_AUTOMATION` | `1` |
| `CSOS_P7_CAMPAIGN_STUDIO` | unset |
| `CSOS_P7_LEAD_CAPTURE` | unset |
| `CSOS_P7_DEMAND_PROFILER` | unset |
| `CSOS_P7_LEAD_INTELLIGENCE` | unset |
| `CSOS_P7_FOLLOWUP` | unset |
| `CSOS_P7_REVENUE` | unset |
| `WHATSAPP_WABA_SEND_OVERRIDE` | unset |

To roll production back: promote `dpl_GKMyNRGXLKg4KXnnEiptF8hEcYa3`, then remove the six `CSOS_P7_*` production variables or set them to `0`. Leave `WHATSAPP_WABA_SEND_OVERRIDE` unset. Leave the new collections in place.

## Revert a phase

1. Revert that phase's pull request. Later phases stack on earlier ones, so revert from the top of the stack downward, or revert the range you want gone.
2. Remove that phase's `CSOS_PHASE_N` value, or set it to `0`, if the deploy still contains the code.
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
| 7 Campaign Studio | `ops_growth_campaigns` | Ignore the collection. Pausing the flag does not activate or delete a Meta campaign. |
| 7 Lead Capture | `ops_growth_inbox_events` | Ignore the collection. Contacts, deals, and existing leads are not rewritten. |
| 7 Demand Profiler | `ops_growth_demand_profiles` | Ignore the collection. Linked contacts are not edited. A requirement row may exist and can stay. |
| 7 Lead Intelligence | `ops_growth_score_weights`. New rows in `contact_duplicate_reviews` include `leadIds`. | Ignore the weight document. Duplicate reviews stay open until a person resolves them. Contacts are not merged. |
| 7 Follow-up | `ops_growth_wa_templates`, `ops_growth_followup_batches`. Approved sends also enqueue existing `ops_follow_up_jobs`. | Ignore the new collections. Queued jobs remain queued and are not sent while the WABA is restricted. |
| 7 Revenue Attribution | `ops_growth_attribution_links` | Ignore the collection. Deals, visits, and payments are not edited. Unverified payments stay out of collected brokerage. |

## Phase 0 access change to know about

Resale owner name, phone, and flat number are returned only to the super admin. Team logins still see full fields on the contacts and cold-call screens. External broker responses are redacted on the server.
