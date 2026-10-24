import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { addMonths, investmentPosition } from "./commissions.mjs";
export function openDatabase(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS investors (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS managers (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS investments (id TEXT PRIMARY KEY, name TEXT NOT NULL, investor_id TEXT NOT NULL REFERENCES investors(id), agent_id TEXT NOT NULL REFERENCES agents(id), manager_id TEXT REFERENCES managers(id), principal REAL NOT NULL CHECK(principal>0), start_date TEXT NOT NULL, commission_type TEXT NOT NULL CHECK(commission_type IN ('trailer','lump_sum')), rate REAL NOT NULL CHECK(rate>=0 AND rate<=100), manager_rate REAL NOT NULL DEFAULT 0 CHECK(manager_rate>=0 AND manager_rate<=100), notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY, investment_id TEXT NOT NULL REFERENCES investments(id) ON DELETE CASCADE, date TEXT NOT NULL, amount REAL NOT NULL CHECK(amount>0), notes TEXT NOT NULL DEFAULT '');
    CREATE INDEX IF NOT EXISTS withdrawals_investment ON withdrawals(investment_id, date);`);
  // Additive migration: preserve all existing records and their calculations.
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(investments)")
      .all()
      .map((c) => c.name),
  );
  const additions = {
    currency: "TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD','CAD'))",
    return_rate:
      "REAL NOT NULL DEFAULT 0 CHECK(return_rate>=0 AND return_rate<=100)",
    distribution_type:
      "TEXT NOT NULL DEFAULT 'cash' CHECK(distribution_type IN ('cash','drip'))",
    term_months:
      "INTEGER NOT NULL DEFAULT 0 CHECK(term_months>=0 AND term_months<=1200)",
    maturity_date: "TEXT",
    auto_renew: "INTEGER NOT NULL DEFAULT 0 CHECK(auto_renew IN (0,1))",
    upfront_rate:
      "REAL NOT NULL DEFAULT 0 CHECK(upfront_rate>=0 AND upfront_rate<=100)",
    manager_upfront_rate:
      "REAL NOT NULL DEFAULT 0 CHECK(manager_upfront_rate>=0 AND manager_upfront_rate<=100)",
  };
  db.exec("BEGIN");
  try {
    for (const [name, definition] of Object.entries(additions))
      if (!columns.has(name))
        db.exec(`ALTER TABLE investments ADD COLUMN ${name} ${definition}`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  if (!db.prepare("SELECT value FROM metadata WHERE key='initialized'").get()) {
    if (process.env.SEED_DEMO !== "false") seed(db);
    db.prepare(
      "INSERT INTO metadata(key,value) VALUES('initialized','true')",
    ).run();
  }
  return db;
}
export function readState(db) {
  const state = {};
  for (const table of [
    "investors",
    "agents",
    "managers",
    "investments",
    "withdrawals",
  ])
    state[table] = db
      .prepare(
        `SELECT * FROM ${table} ORDER BY ${table === "withdrawals" ? "date DESC, id" : "name COLLATE NOCASE, id"}`,
      )
      .all();
  state.demo =
    db.prepare("SELECT value FROM metadata WHERE key='demo'").get()?.value ===
    "true";
  state.public_demo = process.env.PUBLIC_DEMO === "true";
  state.investments = state.investments.map((i) => ({
    ...i,
    auto_renew: !!i.auto_renew,
    ...investmentPosition(i, state.withdrawals),
  }));
  return state;
}
function seed(db) {
  const month = new Date().toISOString().slice(0, 7);
  const date = (offset, day = "01") => addMonths(month, offset) + "-" + day;
  const people = {
    investors: [
      ["Olivia Rhye", "olivia.rhye@example.com"],
      ["Phoenix Baker", "phoenix.baker@example.com"],
      ["Lana Steiner", "lana.steiner@example.com"],
      ["Demi Wilkinson", "demi.wilkinson@example.com"],
      ["Drew Cano", "drew.cano@example.com"],
      ["Natali Craig", "natali.craig@example.com"],
    ],
    agents: [
      ["Alex Morgan", "alex.morgan@example.com"],
      ["Sarah Chen", "sarah.chen@example.com"],
      ["James Wilson", "james.wilson@example.com"],
    ],
    managers: [
      ["Eleanor Pena", "eleanor.pena@example.com"],
      ["Robert Fox", "robert.fox@example.com"],
    ],
  };
  const ids = {};
  for (const [table, entries] of Object.entries(people))
    ids[table] = entries.map(([name, email]) => {
      const id = randomUUID();
      db.prepare(`INSERT INTO ${table}(id,name,email) VALUES(?,?,?)`).run(
        id,
        name,
        email,
      );
      return id;
    });
  const records = [
    ["Evergreen Growth Fund", 0, 0, 0, 250000, date(-5), "trailer", 1.2, 0.24],
    [
      "Horizon Income Portfolio",
      1,
      1,
      0,
      180000,
      date(-4, "12"),
      "trailer",
      1.5,
      0.3,
    ],
    ["Atlas Private Credit", 2, 0, 1, 320000, date(-3), "trailer", 1.1, 0.2],
    [
      "Meridian Balanced Fund",
      3,
      2,
      1,
      150000,
      date(-2, "08"),
      "trailer",
      1.2,
      0.24,
    ],
    [
      "Summit Opportunities",
      4,
      1,
      0,
      175000,
      date(0, "01"),
      "lump_sum",
      2.5,
      0.5,
    ],
    [
      "Oakwood Capital Fund",
      5,
      2,
      1,
      225000,
      date(-5, "15"),
      "trailer",
      1.4,
      0.25,
    ],
    ["Northstar Global Equity", 0, 0, 0, 100000, date(-1), "trailer", 1.0, 0.2],
    ["Cedar Fixed Income", 2, 1, 1, 80000, date(-4), "lump_sum", 2, 0.4],
  ];
  const investments = records.map(
    ([
      name,
      investor,
      agent,
      manager,
      principal,
      start,
      type,
      rate,
      override,
    ]) => {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO investments(id,name,investor_id,agent_id,manager_id,principal,start_date,commission_type,rate,manager_rate) VALUES(?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        name,
        ids.investors[investor],
        ids.agents[agent],
        ids.managers[manager],
        principal,
        start,
        type,
        rate,
        override,
      );
      return id;
    },
  );
  db.prepare(
    "INSERT INTO withdrawals(id,investment_id,date,amount,notes) VALUES(?,?,?,?,?)",
  ).run(
    randomUUID(),
    investments[1],
    date(0, "15"),
    30000,
    "Sample partial withdrawal",
  );
  db.prepare(
    "INSERT INTO withdrawals(id,investment_id,date,amount,notes) VALUES(?,?,?,?,?)",
  ).run(
    randomUUID(),
    investments[7],
    date(-1, "20"),
    80000,
    "Sample full redemption",
  );
  db.prepare("INSERT INTO metadata(key,value) VALUES('demo','true')").run();
}
