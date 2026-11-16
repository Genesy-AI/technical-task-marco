# Improvements

## Context
- Reviewed: backend (Express routes, Temporal workflows/activities, provider adapters, Prisma schema) and frontend (LeadsList, CSV import, API layer), while fixing email verification, validating countryCode on import (ADR-001) and building phone enrichment (ADR-002, ADR-003).
- Timebox: <X h>.
- Not looked at: authentication/authorization (routes are open), message generation quality, accessibility, deployment/infra, load testing.
- Sources: `NOTES.md`, `docs/decisions.md`, session findings. Already-fixed items are excluded.

## Top 3 priorities
1. **Email verification still blocks the HTTP request** (IMP-01): users wait up to ~90 s and lose the result if the request is dropped.
2. **New lead fields are only half shipped** (IMP-02): phone, years at company and LinkedIn exist in the DB but cannot be imported or used in messages.
3. **Phone status can get stuck or overwrite user data** (IMP-03, IMP-04): users see an endless "In progress", or a phone they typed silently replaced.

## Backlog

### Now

**IMP-01 Make email verification async**
- Problem: `POST /leads/verify-emails` awaits `client.workflow.execute` per lead inside the request (`backend/src/index.ts:292`); opens a new Temporal `Connection` per request and never closes it (`:285`); workflowId uses `Date.now()`, so a double click verifies twice; the activity has no heartbeat (`backend/src/workflows/activities/utils.ts`).
- Impact: UI hangs on big batches; timed-out requests lose results; duplicate provider spend.
- Proposal: same pattern as phone enrichment (ADR-003): `workflow.start` with `verify-email-<leadId>` as idempotency key, status persisted by an activity, UI polls; one shared Temporal client (`backend/src/temporal/client.ts`); add `heartbeat()` + `heartbeatTimeout`.
- Effort: M

**IMP-02 Finish phone / yearsAtCompany / linkedinUrl fields**
- Problem: columns exist (migration in 5084e80) but CSV import (`POST /leads/bulk`) and message composition don't handle them; only frontend types reference `yearsAtCompany`/`linkedinUrl`.
- Impact: a requested feature is not usable; users can't personalise messages with the new data.
- Proposal: map + validate them in CSV import (warn-and-null per ADR-001), show them in the table, expose them as message variables via a field registry so the composer scales as fields grow.
- Effort: M

**IMP-03 Reconcile stalled phone enrichments**
- Problem: a terminated run, or DB writes failing after retries, leaves the lead PENDING/IN_PROGRESS (`backend/src/workflows/enrichPhone.ts`); the IN_PROGRESS write (`:55`) is outside the per-provider try.
- Impact: UI polls forever; user doesn't know they should retry.
- Proposal: `describe()` the workflow for active leads with no running execution and mark them FAILED; meanwhile show "Stalled, retry" after N minutes.
- Effort: M

**IMP-04 Never overwrite a phone set after the click**
- Problem: the FOUND write ignores the current value (`backend/src/workflows/activities/phone.ts`).
- Impact: manual edits silently lost; users stop trusting the data.
- Proposal: conditional update `where: { id, phone: null }`, or skip in `loadLeadForPhoneEnrichment`.
- Effort: S

**IMP-05 Error-path polish for Enrich Phone**
- Problem: if the FAILED cleanup `updateMany` throws, the route returns 500 although workflows started, and `onError` doesn't refetch (`backend/src/routes/enrichPhone.ts`, `LeadsList`); the FAILED tooltip says "Providers could not be reached" for every cause (`frontend/src/utils/phoneEnrichment.ts`); axios has no timeout (`frontend/src/utils/axios.ts`).
- Impact: misleading status and copy; UI can wait indefinitely.
- Proposal: try/catch around the cleanup + invalidate leads in `onError`; copy "Enrichment failed. Try again later."; axios timeout aligned with backend limits.
- Effort: S

**IMP-06 CI: build, test, lint on every PR**
- Problem: the frontend typecheck stayed red unnoticed; ESLint can't run (legacy `frontend/.eslintrc.cjs` vs flat-config ESLint).
- Impact: regressions reach main.
- Proposal: CI job running `pnpm build` + `pnpm test` in both packages; migrate to `eslint.config.js` (or pin ESLint 8).
- Effort: S

### Next

**IMP-07 Order phone providers by measured hit rate, latency and cost**
- Problem: order is static Orion → Astra → Nimbus (`backend/src/workflows/phoneEnrichment.ts:22`), chosen from vendor descriptions; latency was measured once by hand (`backend/src/providers/timeouts.ts`); cost per lookup isn't modelled.
- Impact: we may pay for the slowest, most failure-prone provider first on leads where it rarely hits (e.g. Orion is already skipped for free-mail leads), so more time and spend per phone found.
- Proposal: (1) record each attempt (provider, segment, found/not, latency, error class, cost) via an activity; (2) report hit rate, p50/p95 latency and **expected cost per phone found = cost / hit rate** per provider and segment (corporate vs free-mail domain); (3) make the order config-driven and pass it as workflow input (keeps the workflow deterministic); (4) roll out behind a flag and compare against the static order. Revisit timeouts from p95.
- Effort: M (instrumentation S, ordering + rollout M)

**IMP-08 Add `companyWebsite` to leads**
- Problem: Orion needs it; we derive it from the email domain (ADR-002), so most sample leads (free-mail) skip the best provider.
- Impact: lower phone hit rate.
- Proposal: migration + CSV import mapping; keep the email-domain fallback for existing leads.
- Effort: M

**IMP-09 Throttle provider calls before rate limits arrive**
- Problem: providers announced rate limits; nothing throttles today (`backend/src/workflows/enrichPhone.ts`).
- Impact: bulk enrichment triggers 429s, wasted retries, possible bans.
- Proposal: per-provider task queues with `maxTaskQueueActivitiesPerSecond`; treat 429 as retryable with backoff, honouring `Retry-After`.
- Effort: M

**IMP-10 Store phone country / E.164**
- Problem: Nimbus returns the phone's ISO country but we drop it (`backend/src/workflows/activities/phone.ts`).
- Impact: phones can't be formatted or dialled reliably.
- Proposal: `phoneCountryCode` column or normalise to E.164 via migration.
- Effort: S

**IMP-11 countryCode data quality**
- Problem: existing rows hold invalid codes (`backend/prisma/schema.prisma:18`); only `/leads/bulk` validates; the ISO list is duplicated in frontend and backend.
- Impact: garbage in reports and messages; the copies drift.
- Proposal: one-off migration nulling invalid codes; reuse `normalizeCountryCode` on every write path; single shared list (workspace package or API).
- Effort: M

**IMP-12 Provider secrets out of code**
- Problem: API keys fall back to README sandbox values (`backend/src/providers/config.ts`).
- Impact: leak risk in production.
- Proposal: secrets manager / env only; fail fast at startup when missing.
- Effort: S

### Later

**IMP-13 Keep PII out of Temporal history**
- Problem: name/email travel as activity input/output (`backend/src/workflows/enrichPhone.ts`).
- Impact: wider PII footprint for compliance (GDPR).
- Proposal: pass only `leadId` and load inside activities, or a payload codec that encrypts.
- Effort: M

**IMP-14 Split `index.ts` routes and share one PrismaClient**
- Problem: all legacy routes live in `backend/src/index.ts`; two `PrismaClient` instances (`backend/src/index.ts`, `backend/src/db/prisma.ts`).
- Impact: double connection pools; harder to change safely.
- Proposal: move routes to `routes/` incrementally, importing the shared client.
- Effort: M

**IMP-15 Scale the leads list**
- Problem: `GET /leads` returns every lead, polled every 2 s while enrichment runs (`frontend/src/components/LeadsList.tsx:27`).
- Impact: slow UI and DB load as lists grow.
- Proposal: pagination + status-only polling endpoint; SSE when needed.
- Effort: L

## Roadmap
- **Phase 1 – Trustworthy UX (Now):** no hanging requests, no stuck or overwritten statuses, finished lead fields, CI guarding main.
- **Phase 2 – Hit rate & data quality (Next):** measure providers and reorder by cost per phone found, add companyWebsite, throttle for rate limits, clean country data, secrets out of code.
- **Phase 3 – Production hardening & scale (Later):** PII minimisation, route/module cleanup, pagination and push updates.

## Open questions for product
- What does each provider charge per lookup (hit vs miss), and is there a monthly budget? (IMP-07 depends on it.)
- Optimise for hit rate, speed or cost per phone, and does that differ by segment?
- Should a phone a user typed ever be replaced by enrichment?
- When may a NOT_FOUND lead be re-enriched (manual only, or after N days)?
- Should `companyWebsite` be required in CSV import?
- How long may lead PII be kept in workflow history?
- Who may trigger bulk enrichment/verification? Routes are currently unauthenticated.
