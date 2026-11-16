# Architecture Decision Records

Short records of significant decisions taken during this exercise: context, options, decision and trade-offs.

## ADR-001: Invalid optional fields (countryCode) are warned and stored as null, not rejected
- Context: CSV import stored any string as `countryCode` (e.g. `XXX`, `12`); the field is optional, required fields already gate row validity.
- Options: A) reject the row, B) warn and store null, C) warn and keep the raw value.
- Decision: B. Validate against a static ISO 3166-1 alpha-2 list (case-insensitive, stored uppercase, `UK` mapped to `GB`); invalid values become null with a per-row warning in the preview.
- Why: an invalid optional field should not cost us an otherwise valid lead (fail soft), while bad data never reaches the DB. `Intl.DisplayNames` was rejected because it is not strict (`XX` returns `XX`).
- Consequences: the original bad value is lost (visible only in the preview). Validation runs in frontend and backend (defense in depth), with the list duplicated in both packages until there is a shared package. Rows already stored with invalid codes are not cleaned up.
