import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, readState } from "../server/database.mjs";
import { calculateInvestment } from "../server/commissions.mjs";
test("legacy database migrates twice without changing existing people, investments, or commissions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "trailbook-migration-")),
    path = join(dir, "old.sqlite");
  let db = new DatabaseSync(path);
  db.exec(`CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); INSERT INTO metadata VALUES('initialized','true');
    CREATE TABLE investors(id TEXT PRIMARY KEY,name TEXT,email TEXT DEFAULT '',phone TEXT DEFAULT '',notes TEXT DEFAULT '');
    CREATE TABLE agents(id TEXT PRIMARY KEY,name TEXT,email TEXT DEFAULT '',phone TEXT DEFAULT '',notes TEXT DEFAULT '');
    CREATE TABLE managers(id TEXT PRIMARY KEY,name TEXT,email TEXT DEFAULT '',phone TEXT DEFAULT '',notes TEXT DEFAULT '');
    CREATE TABLE investments(id TEXT PRIMARY KEY,name TEXT,investor_id TEXT,agent_id TEXT,manager_id TEXT,principal REAL,start_date TEXT,commission_type TEXT,rate REAL,manager_rate REAL,notes TEXT DEFAULT '');
    INSERT INTO investors(id,name) VALUES('i','Existing investor'); INSERT INTO agents(id,name) VALUES('a','Existing agent');
    INSERT INTO investments VALUES('f','Existing fund','i','a',NULL,120000,'2026-01-01','trailer',1.2,0,'Keep this note');`);
  db.close();
  try {
    for (let n = 0; n < 2; n++) {
      db = openDatabase(path);
      const state = readState(db),
        i = state.investments[0];
      assert.equal(state.investors[0].name, "Existing investor");
      assert.equal(i.principal, 120000);
      assert.equal(i.notes, "Keep this note");
      assert.equal(i.currency, "USD");
      assert.equal(i.return_rate, 0);
      assert.equal(i.term_months, 0);
      assert.equal(i.auto_renew, false);
      assert.equal(calculateInvestment(i, [], "2026-01").agent_commission, 120);
      db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
