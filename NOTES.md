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
