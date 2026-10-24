import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/index.mjs";
process.env.SEED_DEMO = "false";
test("CAD lifecycle persists, reports distributions and renewals, and validates DRIP withdrawals", async () => {
  const server = createApp({ databasePath: ":memory:" });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const request = async (path, method = "GET", body) => {
    const r = await fetch(base + "/api/" + path, {
      method,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    const investor = (
        await request("investors", "POST", { name: "CAD Investor" })
      ).data,
      agent = (await request("agents", "POST", { name: "CAD Agent" })).data;
    const body = {
      name: "CAD DRIP",
      investor_id: investor.id,
      agent_id: agent.id,
      principal: 120000,
      start_date: "2026-01-01",
      commission_type: "trailer",
      rate: 1.2,
      currency: "CAD",
      return_rate: 12,
      distribution_type: "drip",
      term_months: 1,
      auto_renew: true,
      upfront_rate: 2,
    };
    const created = await request("investments", "POST", body);
    assert.equal(created.status, 201);
    const id = created.data.id;
    const cad = (await request("commissions?month=2026-02&currency=CAD")).data;
    assert.equal(cad.rows.length, 1);
    assert.equal(cad.rows[0].monthly_return, 1212);
    assert.equal(cad.rows[0].agent_upfront_commission, 2424);
    assert.equal(cad.summary.total_commission, 2545.2);
    assert.equal(cad.currency, "CAD");
    assert.equal(
      (await request("commissions?month=2026-02&currency=USD")).data.rows
        .length,
      0,
    );
    assert.equal(
      (await request("commissions?month=2026-02&currency=EUR")).status,
      400,
    );
    const state = (await request("state")).data;
    assert.equal(state.investments[0].auto_renew, true);
    assert.equal(typeof state.investments[0].current_balance, "number");
    const csv = await (
      await fetch(base + "/api/export?month=2026-02&currency=CAD")
    ).text();
    assert.ok(csv.includes('"CAD"'));
    assert.ok(csv.includes('"1212.00"'));
    assert.ok(csv.includes('"2424.00"'));
    assert.equal(
      (
        await request("withdrawals", "POST", {
          investment_id: id,
          date: "2026-01-31",
          amount: 121200,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("withdrawals", "POST", {
          investment_id: id,
          date: "2026-02-01",
          amount: 121200,
        })
      ).status,
      201,
    );
    assert.equal(
      (await request("investments/" + id, "PUT", { ...body, return_rate: 0 }))
        .status,
      400,
    );
    assert.equal(
      (await request("investments", "POST", { ...body, currency: "EUR" }))
        .status,
      400,
    );
    assert.equal(
      (
        await request("investments", "POST", {
          ...body,
          term_months: 0,
          auto_renew: true,
        })
      ).status,
      400,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
