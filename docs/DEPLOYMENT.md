# Deployment

This project (GembaLens / OpEx Analyzer, aka "Gemba Tools") is developed entirely through Claude
Code sessions — no manual local dev workflow. Each new conversation starts with a clean context,
so this doc is the persistent record of where things are hosted.

## Source

- GitHub: [gembadigital/Gemba-tools](https://github.com/gembadigital/Gemba-tools) (repo was
  renamed from `gemba-tools` to `Gemba-tools`; both URL casings redirect to the same place)
- Branch: `main`

## Hosting — Vercel

- Dashboard: https://vercel.com/gemba-digital/gemba-tools
- Team: `gemba-digital`
- Production deployment host: `gemba-tools-1cu79ota8-gemba-digital.vercel.app`
- Build config: [vercel.json](../vercel.json) — `vite build`, output `dist`, SPA rewrite, API routes
  under `/api/index`
- Deploys automatically on push to `main` (standard Vercel Git integration)

**Known gap:** the Vercel MCP connector available in Claude Code sessions is authenticated to a
different Vercel account/token than the one that owns this `gemba-tools` project — `list_projects`
and `get_project`/`get_deployment` calls against team `gemba-digital` only see the unrelated
`gemba-iq` project and 404 on this one. Deployment status/build logs for this project currently
have to be checked manually in the Vercel dashboard rather than via the MCP tools, until the
connector is re-authorized against the right account.

## Database — Neon (Postgres)

- Project: https://console.neon.tech/app/projects/wandering-truth-24635321
- Connected to Vercel via the **Vercel-Neon storage integration** (not a manually pasted
  connection string) — `DATABASE_URL` is injected into the Vercel deployment automatically by that
  integration. See [src/server/db.ts](../src/server/db.ts) for the connection code (throws at
  startup if `DATABASE_URL` is missing).
- All app data lives in one generic table keyed by `collection` (customers, opex_assessments,
  five_s_*, etc. — see the comment block above `FIVE_S_COLLECTIONS` in `db.ts`).

## Local dev

Local checkouts (e.g. this Claude Code workspace) do **not** have `DATABASE_URL` set by default —
`npm run dev` will fail at the `db.ts` startup check unless it's added to `.env`. The untracked
`database.json` file in the repo root is a stale leftover from a pre-Postgres JSON-file storage
mode and is no longer read by the app; safe to ignore/delete.
