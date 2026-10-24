# Trailbook

A single-user investment database and monthly commission calculator. Built with React, TypeScript, Vite, Node.js 24, and SQLite. No external database or credentials are required.

## Run

Requires **Node.js 24 or newer** and npm.

```sh
cd /workspace/Beta
npm ci --cache /workspace/.npm
npm run dev
```

Development runs the Vite frontend on port **5173** and the API on **3001**. Vite proxies `/api` to the API. Both processes are started and stopped together.

For a production build:

```sh
npm run build
npm start
```

Production serves the frontend and API together on port **3001**. Set `PORT` to change the production/API port. The development proxy expects the API on port 3001.

## Features

- Dedicated calculator at `/#calculator`, with a numbered form, payout cards, formula explanation, and a 12-month scenario schedule. Scenarios can load existing investments but never change saved records. Changed inputs are marked until recalculated; scenario CSV exports use the last current calculation.
- Create, edit, search, and delete investors, agents, and overriding managers.
- Link each investment to an investor, an agent, and an optional manager.
- Choose recurring trailer or one-time lump-sum commissions, with separate adjustable agent and manager rates per investment.
- Browse historical or projected monthly commissions and six-month activity.
- Record dated partial or full withdrawals; delete incorrect withdrawals to recalculate.
- Inspect daily weighted balances, payout formulas, and withdrawal history.
- Export each monthly ledger as a CSV with agent and manager payouts.
- Responsive desktop and mobile layouts, keyboard-accessible dialogs, and bundled fonts.

## Commission rules

All amounts are **USD**. Trailer rates are **annual percentages**; lump-sum rates are **one-time percentages**. These assumptions are explicitly shown in the app.

For each calendar month, trailer commission is:

```text
average daily invested balance × annual rate / 100 / 12
```

The daily balance is zero before the investment starts. The start date earns commission. A withdrawal reduces the balance **from the following day**, so both the start and final withdrawal dates earn commission. Every day of the calendar month, including zero-balance days, is included in the monthly average. Partial withdrawals use the reduced balance for subsequent days and months. Leap years use the actual number of days in February.

Example: $120,000 invested for all of January at a 1.2% annual agent rate pays $120. If $60,000 is withdrawn on January 15, the average balance is `(120000 × 15 + 60000 × 16) / 31 = $89,032.258…`, and the agent earns **$89.03**. With a 0.24% manager override, the manager earns **$17.81**, making the total **$106.84**.

Lump-sum commission is `original principal × one-time rate / 100`, payable only in the investment start month. Subsequent withdrawals do not claw back earned lump-sum commission. Manager overrides are additional to agent earnings. Each agent and manager payout is rounded separately to cents per investment before totals are summed. Calculations use the unrounded average balance; the displayed average is rounded for readability.

Changing an investment's rate recalculates all months using that rate. This is a calculator, not an immutable payment ledger: it does not track historical rate schedules, payout settlement, taxes, or actual investment returns. Future-dated records are included in projections.

## Database and sample portfolio

The server stores records in `data/trailbook.sqlite`, using foreign keys and SQLite WAL mode. The database directory is ignored by Git. Set `DATABASE_PATH` to override its location.

On the first run, a clearly labeled sample portfolio is seeded. Use **Start with a clean workspace** to remove the sample portfolio. The confirmation warns that this also removes records added while the sample portfolio is present. Clearing it is permanent and prevents reseeding on restart. To start a brand-new database without samples, set `SEED_DEMO=false` before its first startup.

To back up the full database, stop the app and copy the entire `data/` directory to a safe location. Monthly CSV exports are reports, not full database backups. Treat database files as private: this app has no authentication or tenant isolation and is intended for a trusted single-user environment. Add authentication and deployment access controls before sharing it publicly.

## Validation

```sh
npm test             # Calculation edge cases, API validation, CSV, restart persistence
npm run build        # Type check and production build
npm run test:e2e     # Desktop CRUD/calculation/export and mobile browser workflows
```

Browser tests use an isolated temporary SQLite database and a test server on port 3101. They do not modify the development portfolio. Chromium defaults to `/usr/bin/chromium`; set `CHROMIUM_PATH` to use another installed Chromium executable. Run the build before browser tests, which exercise the production output.

The cloud task is already isolated. Use the existing checkout in `/workspace/Beta`; no extra Git worktree is needed.

## Render testing deployment

`render.yaml` defines a **free** Render Node web service. It builds the application, starts the production server using Render's `PORT`, and checks `/api/health`. No paid disk or other paid resource is configured.

After the source is pushed to GitHub, sign in to Render, create a **Blueprint**, and connect the `micxia-ai/Beta` repository. Render reads `render.yaml`. Grant Render access if the repository is private. Once the first deploy is live, use the actual service URL supplied by Render and append `/#calculator` to open the calculator directly. A Render setup link is not the running testing site; no public testing URL exists until deployment succeeds.

The free testing service uses a **separate, ephemeral sample database** under `/tmp/trailbook/`. It does not upload the cloud workspace's database. Records on this public testing service are shared and may reset during redeploys or restarts; the app displays a public-testing banner. Use fictitious sample information only. For a production investment database, add authentication, use a paid persistent disk, and configure backups before entering real records.

`PUBLIC_DEMO=true` enables that banner. The cloud development database remains local and persistent. Free Render instances may take time to wake from inactivity. Automatic deployment is disabled so later pushes do not redeploy the testing service unexpectedly.
