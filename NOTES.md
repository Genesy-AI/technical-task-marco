# Notes

Codebase issues found during the session that are out of scope for the current task.
One line each: problem, impact, suggested fix. This feeds IMPROVEMENTS.md.

- `POST /leads/verify-emails` still awaits `client.workflow.execute` inside the HTTP request (`backend/src/index.ts:292`; leads now run concurrently, but the response waits for the slowest, up to ~90s): start workflows with `client.workflow.start`, persist results via an activity, and have the UI poll status.
- `verify-emails` workflowId includes `Date.now()` (`backend/src/index.ts:296`): no idempotency, a double click verifies the same lead twice; use `verify-email-<leadId>` as in ADR-003.
- A new Temporal `Connection.connect` is opened per request (`backend/src/index.ts:276`) and is not closed if a later step throws; create one shared client at startup.
- `verifyEmail` activity has no heartbeat/cancellation (`backend/src/workflows/activities/utils.ts`): timed-out attempts keep running in the worker; add `heartbeat()` + `heartbeatTimeout` once the real provider is wired.
- Frontend axios instance has no request timeout (`frontend/src/utils/axios.ts`): a stuck backend leaves the UI waiting indefinitely; set a timeout aligned with backend limits.
- ISO country code list is duplicated in `frontend/src/utils/countryCode.ts` and `backend/src/validation/countryCode.ts`: the copies can drift; extract a shared workspace package (or have the backend expose the list) and keep one copy.
- `countryCode` has no DB-level constraint (`backend/prisma/schema.prisma:18`) and existing rows may hold invalid values (e.g. `XXX`, `12`): reports and messages show garbage; run a one-off data migration that nulls invalid codes once ADR-001 is accepted.
- Only `POST /leads/bulk` validates `countryCode`; other write paths (`POST /leads`, `PUT /leads/:id`) should reuse `normalizeCountryCode` if they ever accept it.
- ~~Frontend `pnpm build` failed (optimistic lead lacked `emailVerified`)~~: fixed with the enrich-phone frontend step. Lesson: CI should run `pnpm build` so the typecheck cannot stay red.
- Frontend `eslint` cannot run (`frontend/.eslintrc.cjs` uses the legacy config with an ESLint that expects flat config): lint gives no signal; migrate to `eslint.config.js` or pin ESLint 8.
- Nimbus returns the phone's ISO `countryCode` but it is not persisted (`backend/src/workflows/activities/phone.ts`, only visible in Temporal history): phones are stored without country context, so they cannot be dialled/formatted reliably; add a `phoneCountryCode` column (or normalize to E.164 with it) via a migration.
- Provider API keys fall back to the README sandbox values in code (`backend/src/providers/config.ts`): fine for the exercise, a leak risk in production; load them from a secrets manager and fail fast at startup when missing.
- Leads have no `companyWebsite` (ADR-002): Orion, the best provider, is skipped for free-mail leads (most of the sample data); add the field and map it in CSV import.
- Providers announced rate limits but nothing throttles calls today (`backend/src/workflows/enrichPhone.ts`): a bulk enrichment can trigger 429s (retried, but wasteful); run provider activities on a per-provider task queue with `maxTaskQueueActivitiesPerSecond`.
- Lead PII (name, email) is stored in Temporal workflow history as activity input/output (`backend/src/workflows/enrichPhone.ts`): history retention widens the PII footprint; pass only `leadId` to provider activities and load the lead inside them, or add a payload codec that encrypts data.
- Two `PrismaClient` instances exist (`backend/src/index.ts` and `backend/src/db/prisma.ts`): double connection pools; make `index.ts` import the shared one when the routes are split out.
- A phone-enrichment run that is terminated (Temporal UI/CLI) or whose DB writes fail after retries cannot write a final status (`backend/src/workflows/enrichPhone.ts`): the lead stays PENDING/IN_PROGRESS and the UI polls until a re-click; add a reconciliation (route `describe()`s active leads with no running workflow) or show "Stalled, retry" after N minutes.
- The IN_PROGRESS write sits outside the per-provider try (`backend/src/workflows/enrichPhone.ts:55`): a DB failure there aborts the chain instead of falling back; low risk on local SQLite, covered by the reconciliation above.
- If the FAILED cleanup `updateMany` throws (`backend/src/routes/enrichPhone.ts`, end of handler), the route returns 500 although some workflows started, and `LeadsList` `onError` does not refetch: started leads show up only after a reload; wrap the cleanup in its own try/catch and invalidate the leads query in `onError`.
- A found phone overwrites any phone set after the click (`backend/src/workflows/activities/phone.ts`, FOUND write): a manual edit is silently replaced; write FOUND with `where: { id, phone: null }` or skip in `loadLeadForPhoneEnrichment` when `lead.phone` is set.
- FAILED badge tooltip says "Providers could not be reached" (`frontend/src/utils/phoneEnrichment.ts`) but FAILED also covers a deleted lead, bad credentials or DB errors: misleading copy; use "Enrichment failed. Try again later."
