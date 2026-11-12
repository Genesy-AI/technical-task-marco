# Working agreement (Claude Code)

This is a recorded take-home exercise. I (Marco) drive and make the decisions; you are my pair programmer. Optimize for clear reasoning I can review and explain, not for speed.

## How to respond

Use this structure, kept short:

1. **Understanding**: 3-6 bullets on the relevant code flow, with file paths.
2. **Options and trade-offs**: 2-3 options, the pros/cons of each, and your recommendation. Say what could go wrong with the recommended one.
3. **Assumptions / open questions**: anything you assumed (product or technical). Flag product questions explicitly.
4. **Changes**: what you changed and why, file by file.
5. **Verify**: commands you ran and their results, plus manual steps for me (UI clicks, Temporal UI at http://localhost:8233).
6. **Commit**: a suggested Conventional Commit message and the files to stage.

## Rules

- Explain before editing. If a change touches more than 2 files, show the plan and wait for my OK.
- Keep changes scoped to the current task. No unrelated refactors. No new dependencies without asking.
- Never use a single knob as the whole fix (e.g. only raising a timeout so a slow call succeeds). Timeouts must be realistic for the dependency and always paired with bounded retries and user-visible feedback; state the trade-off explicitly.
- Add or extend vitest tests for pure logic (parsers, adapters, generators). Run `pnpm test` in the package you touched and a typecheck (`pnpm build`) and report the result.
- Do not commit unless I ask; when I say "commit", stage only the files of this step and use the suggested message.
- When you notice a codebase issue outside the current task, append one line to `NOTES.md` (problem, impact, suggested fix) instead of fixing it.
- Do not edit `backend/prisma/dev.db` directly; schema changes go through Prisma migrations.

## Session workflow

- One task per session: I run `/clear` between tasks, so do not rely on context from a previous task; this file is the shared context.
- For larger features (e.g. phone enrichment) I use plan mode: propose the plan, wait for my corrections, then implement.
- PR review: use `gh pr list`, `gh pr view <n>` and `gh pr diff <n>` to read the PR. Draft inline comments (file, line, comment) and a summary with an approve/request-changes decision, and show them to me first. Only post to GitHub (`gh api` / `gh pr review`) after I approve each comment.
- Before suggesting the commit for a feature (not for small fixes), offer to run the `reviewer` subagent on the diff and summarize its findings for me to decide on.
- Edits always need my approval in the session so I can review each diff; read-only and test commands are pre-approved in `.claude/settings.json`. Never push.

## Decision log (ADR)

When we make a significant decision (choosing between alternatives with real trade-offs, e.g. sync vs async enrichment, how to handle Orion's missing companyWebsite, rejecting vs warning on invalid optional fields), append an entry to `docs/decisions.md` in this format, max ~10 lines each:

```
## ADR-00N: <decision title>
- Context: <the problem, 1-2 lines>
- Options: <A, B, (C)>
- Decision: <what we chose>
- Why: <the trade-off that decided it>
- Consequences: <what we accept or must follow up on>
```

Name the pattern when one applies (e.g. adapter, fallback chain, retry with exponential backoff, idempotency key, single source of truth, defense in depth, fail fast).

## Written deliverables

You draft them; I review and approve before they are saved or posted.

- **IMPROVEMENTS.md** (repo root), written like a ticket document in a project management tool. Structure: `Context` (what was reviewed, timebox, what was not looked at) / `Top 3 priorities` / `Backlog` grouped as Now, Next, Later, each ticket with Problem (with file evidence), Impact (user or business), Proposal, Effort (S/M/L) / `Roadmap` (phases with goals) / `Open questions for product`. Build it from `NOTES.md`, `docs/decisions.md` and what we found during the session.
- **PR review**: inline comments (file, line, comment) in a collegial tone, asking before prescribing, plus a summary that acknowledges what is good and ends with a clear Approve or Request changes decision. Show me every comment before posting.

## Temporal conventions

- Workflow code must be deterministic: no network, no Prisma, no `Date.now()`/`Math.random()`. All I/O goes in activities.
- Every activity has a bounded `startToCloseTimeout` and an explicit retry policy (`maximumAttempts`). Use `ApplicationFailure.nonRetryable` for errors that retrying cannot fix (4xx auth/validation).
- Long-running work is started with `client.workflow.start` and its status is persisted, not awaited inside an HTTP request.

## Project facts

- Backend: Express 5 + Prisma (SQLite) + Temporal, port 4000. `cd backend && pnpm run dev`. Migrations: `pnpm migrate:dev`, then `pnpm gen:prisma`.
- Temporal dev server: `temporal server start-dev` (gRPC localhost:7233, UI localhost:8233). Worker runs inside the backend process, task queue `myQueue`.
- Frontend: React 18 + Vite + React Query + Tailwind. `cd frontend && pnpm run dev`.
- Tests: vitest in both packages (`pnpm test`).
- Sample CSVs in `docs/`. Wireframe in `docs/ui-wireframes.png`.
