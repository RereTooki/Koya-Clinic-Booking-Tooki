# Instructions for Codex — Koya Clinic Booking API

Read `PROMPT_FOR_CODEX.md`, `docs/CONTRACT.md`, `CHECKLIST.md`, and `STATE.md` before making changes. These repository files are the durable handoff if a Codex session or usage window ends.

## Non-negotiable rules

- Implement the assessment contract in `docs/CONTRACT.md`; do not redesign endpoint paths, status codes, or response shapes to suit the UI.
- Use TypeScript, React, Next.js App Router, and Tailwind CSS for the web app and API. Use PostgreSQL (Neon is the intended low-cost Vercel-friendly option) for durable state.
- Treat database constraints and transactions—not an in-memory mutex—as the source of truth for concurrent booking safety, idempotency, and rate limiting.
- Keep `KOYA_API_KEY` and `DATABASE_URL` server-only. Never prefix them with `NEXT_PUBLIC_`, put them in a client component, log them, or commit real values.
- The six public contract routes live at the site root: `/reset`, `/slots`, `/bookings`, and `/bookings/{id}` (GET and DELETE on the latter). Do **not** add an `/api` prefix to those endpoints.
- Every public contract route, including GET and `/reset`, must check `X-API-Key` and return `401` with `{"error":"..."}` when missing/wrong.
- Use JSON for all API responses. Every API error body must be exactly an object with an `error` string; never return stack traces.
- Persist checklist and state updates to disk after every meaningful milestone, not just at the end. See `CHECKLIST.md`, `STATE.md`, and `IMPLEMENTATION_LOG.md`.
- Run and report real verification commands. Never mark a test or build as passed if it was not run successfully.
- Do not deploy, create a GitHub remote, push to GitHub, or run Vercel deployment commands. The user owns GitHub and hosting steps.
- Do not stop to ask the user routine implementation questions. Choose a sensible, documented default and keep moving. Pause only if an external credential/action is genuinely required for a task that cannot otherwise be implemented or tested.

## Working method

1. Inspect the existing repository and `git status` before editing.
2. Update `STATE.md` with the phase you are starting and the next concrete actions.
3. Make the smallest coherent set of changes for one milestone.
4. Run the applicable lint/typecheck/tests/build; record exact commands and outcomes.
5. Update `CHECKLIST.md`, `STATE.md`, and append a concise entry to `IMPLEMENTATION_LOG.md`.
6. Continue to the next phase while practical. Do not dump large source files into chat; edit the repository directly.
7. If interrupted or usage limits stop work, leave the repository in a buildable state where possible and update `STATE.md` with exact completed work, failures, and the next command/task.
