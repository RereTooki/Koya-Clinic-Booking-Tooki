# Deployment and demo handoff

## Neon and Vercel setup

1. Create a Neon PostgreSQL database and copy its pooled or direct connection URL with `sslmode=require`.
2. In the Vercel project settings, set server-side environment variables for each applicable environment:
   - `DATABASE_URL`: the Neon connection string.
   - `KOYA_API_KEY`: a long random value shared only with trusted API callers.
   - `APP_BASE_URL`: the exact deployed HTTPS origin, for example `https://your-project.vercel.app`.
3. Before or immediately after the first deployment, run `npm run migrate` once against that database from a trusted shell with `DATABASE_URL` set. Migrations are deliberately not run during build or request handling.
4. Deploy through the Vercel dashboard or your own GitHub/Vercel workflow. This repository intentionally contains no deployment command and no real credentials.

The route handlers specify the Node.js runtime and dynamically render where needed. The SQL migration creates all stateful tables and the partial unique confirmed-booking index.

## GitHub handoff

1. Review `git status`; do not commit `.env.local`, `.next`, `node_modules`, credentials, or database dumps.
2. Create the GitHub repository yourself, add it as the remote, then commit and push your reviewed work.
3. Import that repository into Vercel and configure the variables above.
4. Test with a non-production key and a future slot after deployment.

## Suggested Loom walkthrough (3–5 minutes)

1. Show `.env.example`, the root route folders, and `db/migrations/001_initial.sql`; explain that secrets are server-only.
2. Use `POST /reset` to seed two future slots, then `GET /slots` to show ordering and availability.
3. Create a booking with an `Idempotency-Key`; send the same semantically equivalent body again and show the same ID. Change the body with that key and show `422`.
4. Attempt competing bookings for one slot (or refer to the integration test) and show only one confirmed booking; cancel it and show a new booking can take the slot.
5. Send five valid-email failed booking attempts and show the sixth returns `429` with a whole-second `Retry-After`. Explain that retries of an existing idempotency record happen before this limiter.
6. Use the browser UI to filter by provider, book, look up by email, and cancel. In browser developer tools, show that no `KOYA_API_KEY` appears in client code or requests to the core API routes.
7. Run or show the outputs of `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Only claim integration verification after running it against an isolated `DATABASE_URL_TEST`.
