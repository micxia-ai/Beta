import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateInvestment,
  investmentPosition,
  investmentSchedule,
  normalizeTerms,
  report,
  termMaturity,
  validateWithdrawals,
} from "../server/commissions.mjs";
const base = {
  id: "fund",
  name: "Fund",
  investor_id: "investor",
  agent_id: "agent",
  manager_id: "manager",
  principal: 120000,
  start_date: "2026-01-01",
  commission_type: "trailer",
  rate: 1.2,
  manager_rate: 0.24,
  currency: "CAD",
  return_rate: 12,
  distribution_type: "drip",
  term_months: 0,
  auto_renew: false,
  upfront_rate: 0,
  manager_upfront_rate: 0,
};
const withdrawal = (date, amount) => ({
  id: date,
  investment_id: "fund",
  date,
  amount,
});
test("DRIP compounds monthly; subsequent trailer uses the increased current balance", () => {
  const jan = calculateInvestment(base, [], "2026-01"),
    feb = calculateInvestment(base, [], "2026-02");
  assert.equal(jan.monthly_return, 1200);
  assert.equal(jan.drip_amount, 1200);
  assert.equal(jan.cash_dividend, 0);
  assert.equal(jan.closing_balance, 121200);
  assert.equal(jan.agent_trailer_commission, 120);
  assert.equal(feb.monthly_return, 1212);
  assert.equal(feb.closing_balance, 122412);
  assert.equal(feb.agent_trailer_commission, 121.2);
  assert.equal(
    investmentPosition(base, [], "2026-01-15").current_balance,
    120000,
  );
  assert.equal(
    investmentPosition(base, [], "2026-02-15").current_balance,
    121200,
  );
});
test("cash dividends distribute monthly without increasing invested balance", () => {
  const i = { ...base, distribution_type: "cash" };
  const feb = calculateInvestment(i, [], "2026-02");
  assert.equal(feb.monthly_return, 1200);
  assert.equal(feb.cash_dividend, 1200);
  assert.equal(feb.drip_amount, 0);
  assert.equal(feb.closing_balance, 120000);
  assert.equal(feb.cumulative_cash_dividends, 2400);
  assert.equal(feb.agent_trailer_commission, 120);
});
test("partial withdrawals reduce both monthly returns and future compounded commission", () => {
  const events = [withdrawal("2026-01-15", 60000)];
  const jan = calculateInvestment(base, events, "2026-01"),
    feb = calculateInvestment(base, events, "2026-02");
  assert.equal(jan.monthly_return, 890.32);
  assert.equal(jan.closing_balance, 60890.32);
  assert.equal(feb.agent_trailer_commission, 60.89);
  assert.equal(feb.drip_amount, 608.9);
});
test("trailers can also pay separate upfront agent and manager commissions", () => {
  const r = calculateInvestment(
    { ...base, upfront_rate: 2, manager_upfront_rate: 0.5 },
    [],
    "2026-01",
  );
  assert.equal(r.agent_upfront_commission, 2400);
  assert.equal(r.manager_upfront_commission, 600);
  assert.equal(r.agent_commission, 2520);
  assert.equal(r.manager_commission, 624);
  assert.equal(r.total_commission, 3144);
});
test("maturity without renewal stops returns and trailer while retaining the redeemable balance", () => {
  const i = { ...base, term_months: 1 };
  const jan = calculateInvestment(i, [], "2026-01"),
    feb = calculateInvestment(i, [], "2026-02");
  assert.equal(jan.current_maturity_date, "2026-01-31");
  assert.equal(feb.closing_balance, 121200);
  assert.equal(feb.monthly_return, 0);
  assert.equal(feb.total_commission, 0);
  assert.equal(feb.status, "matured");
});
test("renewal pays upfront again on the compounded balance and advances the term once", () => {
  const i = {
    ...base,
    term_months: 1,
    auto_renew: true,
    upfront_rate: 2,
    manager_upfront_rate: 0.5,
  };
  const feb = calculateInvestment(i, [], "2026-02");
  assert.equal(feb.renewal_count, 1);
  assert.equal(feb.current_maturity_date, "2026-02-28");
  assert.equal(feb.commission_events[0].date, "2026-02-01");
  assert.equal(feb.commission_events[0].base, 121200);
  assert.equal(feb.agent_upfront_commission, 2424);
  assert.equal(feb.total_commission, 3175.44);
  assert.deepEqual(calculateInvestment(i, [], "2026-02"), feb);
});
test("lump-sum renewals pay the renewed principal once per term", () => {
  const schedule = investmentSchedule(
    {
      ...base,
      commission_type: "lump_sum",
      rate: 2,
      manager_rate: 0.5,
      term_months: 2,
      auto_renew: true,
    },
    [],
    "2026-01",
    4,
  );
  assert.equal(schedule[0].total_commission, 3000);
  assert.equal(schedule[1].total_commission, 0);
  assert.equal(schedule[2].total_commission, 3060.3);
  assert.equal(schedule[3].total_commission, 0);
});
test("custom maturity and leap-year calendar boundaries remain inclusive", () => {
  const r = calculateInvestment(
    { ...base, distribution_type: "cash", maturity_date: "2026-01-15" },
    [],
    "2026-01",
  );
  assert.equal(r.earning_days, 15);
  assert.equal(r.monthly_return, 580.65);
  assert.equal(termMaturity("2024-01-01", 2), "2024-02-29");
  assert.equal(termMaturity("2026-01-31", 1), "2026-02-27");
});
test("DRIP withdrawals can use posted growth but cannot spend future/unposted distributions", () => {
  assert.doesNotThrow(() =>
    validateWithdrawals(base, [withdrawal("2026-02-01", 121200)]),
  );
  assert.throws(
    () => validateWithdrawals(base, [withdrawal("2026-01-31", 121200)]),
    /available CAD balance/,
  );
  const i = { ...base, term_months: 1, auto_renew: true };
  const events = [withdrawal("2026-01-15", 120000)];
  const jan = calculateInvestment(i, events, "2026-01"),
    feb = calculateInvestment(i, events, "2026-02");
  assert.equal(jan.cash_dividend, 580.65);
  assert.equal(jan.drip_amount, 0);
  assert.equal(feb.closing_balance, 0);
  assert.equal(feb.commission_events.length, 0);
});
test("reports never combine USD and CAD amounts", () => {
  const state = {
    investments: [
      base,
      { ...base, id: "usd", currency: "USD", principal: 240000 },
    ],
    withdrawals: [],
    investors: [],
    agents: [],
    managers: [],
  };
  const cad = report(state, "2026-01", "CAD"),
    usd = report(state, "2026-01", "USD");
  assert.equal(cad.rows.length, 1);
  assert.equal(cad.summary.invested_balance, 121200);
  assert.equal(cad.summary.total_commission, 144);
  assert.equal(usd.summary.total_commission, 288);
});
test("investment terms validate currencies, term lengths, maturity, and return rates", () => {
  for (const patch of [
    { currency: "EUR" },
    { term_months: 1.5 },
    { term_months: 0, auto_renew: true },
    { maturity_date: "2025-12-31" },
    { return_rate: -1 },
    { upfront_rate: 101 },
    { start_date: "9998-12-01", term_months: 1200 },
  ])
    assert.throws(
      () => normalizeTerms({ ...base, ...patch }),
      (e) => e.status === 400,
    );
});
test("unbounded future projections fail with a useful validation error", () => {
  assert.throws(
    () => calculateInvestment(base, [], "9997-12"),
    /within 200 years/,
  );
});
