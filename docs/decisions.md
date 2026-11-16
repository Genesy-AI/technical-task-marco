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
