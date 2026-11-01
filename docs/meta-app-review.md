# Meta App Review — reviewer login

Create a dedicated ops user in the CraftSquare admin (do not share the owner's personal password). Suggested review account:

- URL: `https://craftsquare.co.in/admin/login` then open `https://craftsquare.co.in/ops`
- Role: admin, with ops view and edit
- Email and password: put them in the App Review notes only, never in git

Screencast order (English UI, from login through the result):

1. `/ops/meta-review` — overview
2. `/ops/meta-review/leads` — submit a Lead Ads test lead and show it on `/ops/leads` plus the WhatsApp welcome
3. `/ops/meta-review/page-connect` — subscribe Page `1351127224742253` to `leadgen`
4. `/ops/meta-review/ads` — create a PAUSED campaign. Do not turn spend on.
5. `/ops/meta-review/whatsapp` — send `lead_welcome` and show the inbound reply

Permission text for the submission is in the audit checklist. The site URL, privacy policy, and data-deletion callback are `https://craftsquare.co.in` and `https://craftsquare.co.in/api/data-deletion`.
