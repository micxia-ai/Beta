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
- Browse historical or projected monthly commissions and six-month activity, separated by USD/CAD.
- Track annual investment returns, DRIP compounding, monthly cash dividends, current balances, term maturity, and renewal upfront payments.
- Record dated partial or full withdrawals; delete incorrect withdrawals to recalculate.
- Inspect daily weighted balances, payout formulas, and withdrawal history.
- Export each monthly ledger as a CSV with agent and manager payouts.
- Responsive desktop and mobile layouts, keyboard-accessible dialogs, and bundled fonts.

## Commission rules

Each investment uses **USD or CAD**. Select the report currency in the top bar. Totals and CSV exports include only that currency; no exchange rate or combined USD/CAD total is applied. Trailer rates are **annual percentages**; lump-sum rates are **one-time percentages**. These assumptions are explicitly shown in the app.

For each calendar month, trailer commission is:

```text
average daily invested balance × annual rate / 100 / 12
```

The daily balance is zero before the investment starts. The start date earns commission. A withdrawal reduces the balance **from the following day**, so both the start and final withdrawal dates earn commission. Every day of the calendar month, including zero-balance days, is included in the monthly average. Partial withdrawals use the reduced balance for subsequent days and months. Leap years use the actual number of days in February.

Example: $120,000 invested for all of January at a 1.2% annual agent rate pays $120. If $60,000 is withdrawn on January 15, the average balance is `(120000 × 15 + 60000 × 16) / 31 = $89,032.258…`, and the agent earns **$89.03**. With a 0.24% manager override, the manager earns **$17.81**, making the total **$106.84**.

Lump-sum commission is `term starting balance × one-time rate / 100`, payable in the initial start month and each renewal month. A trailer investment can also define separate agent and manager upfront rates; those payments are additional to its monthly trailer. Subsequent withdrawals do not claw back earned lump-sum commission. Manager overrides are additional to agent earnings. Each upfront event, monthly agent trailer, and monthly manager trailer is rounded separately to cents before totals are summed. Calculations use the unrounded average balance; the displayed average is rounded for readability.

Changing an investment's rate recalculates all months using that rate. This is a calculator, not an immutable payment ledger: it does not track historical rate schedules, payout settlement, taxes, or market prices. Return distributions are calculated from the configured contract rate, rather than imported bank or brokerage payments. Future-dated records are included in projections. Reporting dates are limited to 200 years from an investment’s start to keep calculation time bounded.

## Investment returns, balances, and renewal

Each investment includes an annual nominal return rate, DRIP or cash distribution choice, optional term in whole months, optional explicit maturity date, and an automatic renewal option. Rates are annual percentages divided by 12, using the same daily balance proration as trailer commissions.

- **DRIP:** earned returns are rounded and reinvested at each calendar month-end. The higher balance compounds the next month and is used for subsequent trailer payments.
- **Cash Dividend Payout:** returns are distributed monthly without increasing invested capital.
- **Current balance:** calculated through the displayed as-of date, including posted DRIP and dated withdrawals. It is separate from the reporting month's projected closing balance. Incomplete months do not yet post their return.
- **Monthly tracking:** investment details show up to 12 months of earned returns, DRIP credits, cash payouts, closing balances, and commissions. The calculator projects the next 12 months. CSV reports include currency, rates, return distributions, term, maturity, renewal, and separate upfront/trailer amounts.
- **Term and maturity:** a term of N months ends on the day before the clamped N-month anniversary of its start. For example, January 1 plus one month has an inclusive maturity of January 31; January 31 plus one month ends February 27 in a non-leap year. You may override the first maturity date. Without renewal, earnings stop after maturity and the redeemable balance remains until withdrawn.
- **Renewal:** starts the next day after inclusive maturity for the configured number of months. Upfront or lump-sum commission is paid again on the renewed balance, including posted DRIP and excluding previous capital withdrawals. Monthly trailer continues against the current balance. Renewal records are calculated deterministically; repeated reads do not create duplicate payments.
- **Withdrawals:** may use previously posted DRIP growth, but cannot spend unposted returns or make a dated balance negative. Full withdrawals close the capital balance. Final accrued return is paid as cash at month-end, even for DRIP, so the investment does not silently reopen.

Example: 120,000 at a 12% annual return reinvests 1,200 in January, closing at 121,200. February reinvests 1,212 and closes at 122,412. At a 1.2% annual agent trailer, the agent earns 120 in January and 121.20 in February. If a one-month term renews on February 1 with a 2% upfront rate, the agent also earns 2,424 upfront in February. The example applies independently in USD or CAD.

Existing databases migrate automatically and additively. Existing investments default to USD, zero return and upfront rates, cash distribution, and no maturity or renewal, preserving their prior calculations. Editing rates, terms, distribution choice, or maturity recalculates the full historical model; this is not a settled-payment audit ledger. Changing currency relabels the investment, not its amount.

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

After the source is pushed to GitHub, sign in to Render, create a **Blueprint**, and connect the `micxia-ai/Beta` repository. Render reads `render.yaml`. Grant Render access if the repository is private. Once the first deploy is live, use the actual service URL supplied by Render and append `/#calculator` to open the calculator directly. A Render setup link is not the running testing site; the testing service URL is only valid after a deployment succeeds. The user-provided testing address is https://trailbook-testing.onrender.com/; a source push alone does not prove the new version is live.

The free testing service uses a **separate, ephemeral sample database** under `/tmp/trailbook/`. It does not upload the cloud workspace's database. Records on this public testing service are shared and may reset during redeploys or restarts; the app displays a public-testing banner. Use fictitious sample information only. For a production investment database, add authentication, use a paid persistent disk, and configure backups before entering real records.

`PUBLIC_DEMO=true` enables that banner. The cloud development database remains local and persistent. Free Render instances may take time to wake from inactivity. Automatic deployment is disabled so later pushes do not redeploy the testing service unexpectedly.
