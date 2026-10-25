# Koya Clinic Booking Assessment

A checkpoint-friendly starter repository for implementing Koya Cohort 4 Task 1. The API implementation is not generated yet; open this folder in VS Code and start Codex with `PROMPT_FOR_CODEX.md`.

## Start with Codex

1. Open this repository folder (not just an individual file) in VS Code.
2. Open `PROMPT_FOR_CODEX.md` and copy the full prompt into Codex. The repository's `AGENTS.md`, `CHECKLIST.md`, `STATE.md`, and `IMPLEMENTATION_LOG.md` are designed to preserve progress across a usage-window/context interruption.
3. Let Codex implement in phases and update its checkpoint files after every milestone. If a session stops, begin the next session with:

   > Read `AGENTS.md`, `PROMPT_FOR_CODEX.md`, `CHECKLIST.md`, `STATE.md`, and `IMPLEMENTATION_LOG.md`. Inspect `git status`. Resume from the first incomplete checklist item. Do not redo verified work. Update the checkpoint files after the next milestone.

4. Provide a dedicated PostgreSQL database URL in your local ignored `.env.local` when Codex asks you to test database-backed behavior. Never use the production database for destructive integration tests.

## Planned stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- PostgreSQL (recommended: Neon) for durable state and transaction-safe invariants
- Server-side API-key handling
- SQL migrations, automated tests, and Vercel deployment documentation

## Important files

- `AGENTS.md` — persistent coding constraints
- `PROMPT_FOR_CODEX.md` — the complete implementation prompt
- `RESUME_PROMPT.md` — a short continuation prompt to paste after a limit/context reset
- `docs/CONTRACT.md` — endpoint contract and edge cases from the assessment
- `CHECKLIST.md` — live five-level progress checklist
- `STATE.md` — precise resume point for the next Codex session
- `IMPLEMENTATION_LOG.md` — short audit trail of progress and real test outcomes

## Public API routes to implement

- `POST /reset`
- `GET /slots?provider=...`
- `POST /bookings`
- `GET /bookings?email=...&limit=...&cursor=...`
- `GET /bookings/{id}`
- `DELETE /bookings/{id}`

The final API base URL is the HTTPS Vercel origin (for example `https://your-project.vercel.app`), not an `/api` subpath, once you deploy. Use the actual URL Vercel assigns you.

## GitHub and deployment

Per the candidate's instruction, Codex must not create GitHub remotes, push code, or deploy. Once implementation and tests are complete, follow `docs/DEPLOYMENT_AND_DEMO.md` (Codex is prompted to create it during the final phase), then manually create/publish the GitHub repo and deploy through Vercel.
