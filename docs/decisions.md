# Architecture Decision Records

Short records of significant decisions taken during this exercise: context, options, decision and trade-offs.

## ADR-001: Invalid optional fields (countryCode) are warned and stored as null, not rejected
- Context: CSV import stored any string as `countryCode` (e.g. `XXX`, `12`); the field is optional, required fields already gate row validity.
- Options: A) reject the row, B) warn and store null, C) warn and keep the raw value.
- Decision: B. Validate against a static ISO 3166-1 alpha-2 list (case-insensitive, stored uppercase, `UK` mapped to `GB`); invalid values become null with a per-row warning in the preview.
- Why: an invalid optional field should not cost us an otherwise valid lead (fail soft), while bad data never reaches the DB. `Intl.DisplayNames` was rejected because it is not strict (`XX` returns `XX`).
- Consequences: the original bad value is lost (visible only in the preview). Validation runs in frontend and backend (defense in depth), with the list duplicated in both packages until there is a shared package. Rows already stored with invalid codes are not cleaned up.

## ADR-002: Orion Connect's companyWebsite is derived from the lead's email domain
- Context: Orion (best data) requires `companyWebsite` (verified: 400 "Missing required input" without it); leads have no website field.
- Options: A) derive it from the email domain, B) skip Orion until we have the field, C) add a `companyWebsite` column now.
- Decision: A. `companyDomainFromEmail` (ada@acme.com -> acme.com); free-mail and placeholder domains (gmail, yahoo, hotmail, example.com, ...) return null and the Orion adapter's `canHandle` is false, so the fallback chain moves to Astra.
- Why: uses the best provider whenever we have a plausible signal, without widening scope; C still needs a fallback for existing leads.
- Consequences: heuristic, the email domain can differ from the company site (subsidiaries, agencies), giving a miss or a wrong match. Most sample leads use free-mail, so Orion is often skipped. Follow-up: `companyWebsite` field via CSV import (IMPROVEMENTS). Patterns: adapter, fallback chain.

## ADR-003: Phone enrichment runs async (workflow.start + persisted status + polling), one workflow per lead
- Context: the provider chain takes 1-5s typically and up to ~72s worst case (3 attempts x per-provider timeout); email verification showed that awaiting workflows in the HTTP request hangs the UI.
- Options: A) `workflow.execute` inside the request, B) `workflow.start`, workflow persists status via activities, UI polls, C) B with push (SSE/websockets).
- Decision: B. `POST /leads/enrich-phone` marks leads PENDING, starts `enrich-phone-<leadId>` and returns 202; the workflow writes IN_PROGRESS + current provider, then FOUND / NOT_FOUND / FAILED; the UI polls every 2s only while some lead is active.
- Why: the request is bounded regardless of providers, progress survives page reloads (the lead row is the single source of truth), and polling needs no new infrastructure.
- Consequences: idempotency key = workflowId; `WorkflowExecutionAlreadyStartedError` is reported as "already running", and the default reuse policy allows re-enrichment once a run closes. Leads with a phone are skipped. Polling costs a `GET /leads` every 2s during enrichment; move to SSE if lists grow. Patterns: idempotency key, retry with exponential backoff, fail fast (non-retryable 4xx).
