# Notes

Codebase issues found during the session that are out of scope for the current task.
One line each: problem, impact, suggested fix. This feeds IMPROVEMENTS.md.

- `POST /leads/verify-emails` awaits `client.workflow.execute` sequentially inside the HTTP request (`backend/src/index.ts:283`): one slow lead blocks the whole batch and the response (up to ~93s per lead); start workflows with `client.workflow.start`, persist results via an activity, and have the UI poll status.
- A new Temporal `Connection.connect` is opened per request (`backend/src/index.ts:276`) and is not closed if a later step throws; create one shared client at startup.
- `verifyEmail` activity has no heartbeat/cancellation (`backend/src/workflows/activities/utils.ts`): timed-out attempts keep running in the worker; add `heartbeat()` + `heartbeatTimeout` once the real provider is wired.
- Frontend axios instance has no request timeout (`frontend/src/utils/axios.ts`): a stuck backend leaves the UI waiting indefinitely; set a timeout aligned with backend limits.
