import {
  investmentSchedule,
  roundMoney,
  validDate,
  validMonth,
  normalizeTerms,
  validateWithdrawals,
} from "./commissions.mjs";

export function calculateScenario(body) {
  function fail(message) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
  function amount(value, label, zero = false, limit = 1e12) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < (zero ? 0 : 0.01) ||
      value > limit
    )
      fail(`Enter a valid ${label}.`);
    return value;
  }
  function date(value) {
    if (!validDate(value) || value < "1900-01-01" || value > "9998-12-31")
      fail("Enter a valid investment or withdrawal date.");
    return value;
  }
  function cents(value, label) {
    amount(value, label);
    if (Math.abs(value * 100 - Math.round(value * 100)) > 0.0001)
      fail(`${label} supports up to two decimal places.`);
    return value;
  }
  if (
    !validMonth(body.month) ||
    body.month < "1901-01" ||
    body.month > "9997-01"
  )
    fail("Choose a valid reporting month.");
  if (!["trailer", "lump_sum"].includes(body.commission_type))
    fail("Choose a commission structure.");
  if (typeof body.include_manager !== "boolean")
    fail("Choose whether a manager override applies.");
  const investment = {
    id: "scenario",
    name: "Commission scenario",
    principal: cents(body.principal, "Investment amount"),
    start_date: date(body.start_date),
    commission_type: body.commission_type,
    rate: amount(body.rate, "agent rate from 0 to 100%", true, 100),
    manager_id: body.include_manager ? "scenario-manager" : null,
    manager_rate: body.include_manager
      ? amount(body.manager_rate, "manager rate from 0 to 100%", true, 100)
      : 0,
  };
  Object.assign(
    investment,
    normalizeTerms({ ...body, start_date: investment.start_date }),
  );
  if (!Array.isArray(body.withdrawals) || body.withdrawals.length > 100)
    fail("Provide no more than 100 withdrawals.");
  const withdrawals = body.withdrawals.map((w, i) => {
    if (!w || typeof w !== "object") fail("Enter a valid withdrawal.");
    const withdrawalDate = date(w.date);
    if (withdrawalDate < investment.start_date)
      fail("Withdrawals cannot precede the investment start date.");
    return {
      id: `scenario-${i}`,
      investment_id: investment.id,
      date: withdrawalDate,
      amount: cents(w.amount, "Withdrawal amount"),
    };
  });
  validateWithdrawals(investment, withdrawals);
  const schedule = investmentSchedule(investment, withdrawals, body.month);
  return {
    month: body.month,
    result: schedule[0],
    schedule,
    projected_total: roundMoney(
      schedule.reduce((s, r) => s + r.total_commission, 0),
    ),
    remaining_after_withdrawals: schedule[0].closing_balance,
    projected_return: roundMoney(
      schedule.reduce((s, r) => s + r.monthly_return, 0),
    ),
    projected_cash_dividends: roundMoney(
      schedule.reduce((s, r) => s + r.cash_dividend, 0),
    ),
  };
}
