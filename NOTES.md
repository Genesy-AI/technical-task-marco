# Notes

Codebase issues found during the session that are out of scope for the current task.
One line each: problem, impact, suggested fix. This feeds IMPROVEMENTS.md.

- `POST /leads/verify-emails` awaits `client.workflow.execute` sequentially inside the HTTP request (`backend/src/index.ts:283`): one slow lead blocks the whole batch and the response (up to ~93s per lead); start workflows with `client.workflow.start`, persist results via an activity, and have the UI poll status.
- A new Temporal `Connection.connect` is opened per request (`backend/src/index.ts:276`) and is not closed if a later step throws; create one shared client at startup.
- `verifyEmail` activity has no heartbeat/cancellation (`backend/src/workflows/activities/utils.ts`): timed-out attempts keep running in the worker; add `heartbeat()` + `heartbeatTimeout` once the real provider is wired.
- Frontend axios instance has no request timeout (`frontend/src/utils/axios.ts`): a stuck backend leaves the UI waiting indefinitely; set a timeout aligned with backend limits.
- ISO country code list is duplicated in `frontend/src/utils/countryCode.ts` and `backend/src/validation/countryCode.ts`: the copies can drift; extract a shared workspace package (or have the backend expose the list) and keep one copy.
- `countryCode` has no DB-level constraint (`backend/prisma/schema.prisma:18`) and existing rows may hold invalid values (e.g. `XXX`, `12`): reports and messages show garbage; run a one-off data migration that nulls invalid codes once ADR-001 is accepted.
- Only `POST /leads/bulk` validates `countryCode`; other write paths (`POST /leads`, `PUT /leads/:id`) should reuse `normalizeCountryCode` if they ever accept it.
- Frontend `pnpm build` already fails at `solution` HEAD (5edd52c): optimistic lead in `frontend/src/api/mutations/useApiMutation.ts:64` lacks `emailVerified`: typecheck is red, so real type errors can hide; add `emailVerified: null` to the optimistic object.
- Nimbus returns the phone's ISO `countryCode` but it is not persisted (`backend/src/workflows/activities/phone.ts`, only visible in Temporal history): phones are stored without country context, so they cannot be dialled/formatted reliably; add a `phoneCountryCode` column (or normalize to E.164 with it) via a migration.
- Provider API keys fall back to the README sandbox values in code (`backend/src/providers/config.ts`): fine for the exercise, a leak risk in production; load them from a secrets manager and fail fast at startup when missing.
- Leads have no `companyWebsite` (ADR-002): Orion, the best provider, is skipped for free-mail leads (most of the sample data); add the field and map it in CSV import.
- Providers announced rate limits but nothing throttles calls today (`backend/src/workflows/enrichPhone.ts`): a bulk enrichment can trigger 429s (retried, but wasteful); run provider activities on a per-provider task queue with `maxTaskQueueActivitiesPerSecond`.
- Lead PII (name, email) is stored in Temporal workflow history as activity input/output (`backend/src/workflows/enrichPhone.ts`): history retention widens the PII footprint; pass only `leadId` to provider activities and load the lead inside them, or add a payload codec that encrypts data.
- Two `PrismaClient` instances exist (`backend/src/index.ts` and `backend/src/db/prisma.ts`): double connection pools; make `index.ts` import the shared one when the routes are split out.
- A workflow killed by `workflowExecutionTimeout` (3m, `backend/src/routes/enrichPhone.ts`) cannot run its cleanup, so the lead would stay IN_PROGRESS until re-enriched: unlikely (worst case ~72s), but add a reconciliation job or show "stale" in the UI after N minutes.
