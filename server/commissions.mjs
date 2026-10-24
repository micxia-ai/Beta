// UTC calendar dates. Capital withdrawals take effect after earning on their date.
const DAY = 86_400_000;
export const roundMoney = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
export function addMonths(month, offset) {
  const date = new Date(month + "-01T00:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function addDays(date, days) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * DAY)
    .toISOString()
    .slice(0, 10);
}
export function termMaturity(start, months) {
  if (!months) return null;
  const targetMonth = addMonths(start.slice(0, 7), months);
  const lastDay = Number(
    addDays(addMonths(targetMonth, 1) + "-01", -1).slice(8),
  );
  return addDays(
    targetMonth +
      "-" +
      String(Math.min(Number(start.slice(8)), lastDay)).padStart(2, "0"),
    -1,
  );
}
export function normalizeTerms(body) {
  const fail = (message) => {
    const e = new Error(message);
    e.status = 400;
    throw e;
  };
  const rate = (value, label) => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    )
      fail(`${label} must be between 0 and 100%.`);
    return value;
  };
  const currency = body.currency ?? "USD";
  if (!["USD", "CAD"].includes(currency)) fail("Choose USD or CAD.");
  const distribution_type = body.distribution_type ?? "cash";
  if (!["cash", "drip"].includes(distribution_type))
    fail("Choose DRIP or cash dividend payout.");
  const term_months = body.term_months ?? 0;
  if (!Number.isInteger(term_months) || term_months < 0 || term_months > 1200)
    fail("Investment term must be a whole number from 0 to 1200 months.");
  const auto_renew = body.auto_renew ?? false;
  if (![true, false, 0, 1].includes(auto_renew))
    fail("Choose whether to renew at maturity.");
  const maturity_date = body.maturity_date || null;
  if (
    maturity_date &&
    (!validDate(maturity_date) ||
      maturity_date < body.start_date ||
      maturity_date > "9998-12-31")
  )
    fail("Maturity must be a valid date on or after the start date.");
  if (auto_renew && !term_months)
    fail("Set a term in months before enabling renewal.");
  if (term_months) {
    let computed;
    try {
      computed = termMaturity(body.start_date, term_months);
    } catch {
      fail("The investment term exceeds the supported date range.");
    }
    if (!validDate(computed) || computed > "9998-12-31")
      fail("The investment term exceeds the supported date range.");
  }
  return {
    currency,
    return_rate: rate(body.return_rate ?? 0, "Annual return rate"),
    distribution_type,
    term_months,
    maturity_date,
    auto_renew: !!auto_renew,
    upfront_rate: rate(body.upfront_rate ?? 0, "Agent upfront rate"),
    manager_upfront_rate: rate(
      body.manager_upfront_rate ?? 0,
      "Manager upfront rate",
    ),
  };
}
const zeroMonth = (i, month, maturity) => ({
  month,
  average_balance: 0,
  closing_balance: 0,
  earning_days: 0,
  days_in_month: Number(addDays(addMonths(month, 1) + "-01", -1).slice(8)),
  agent_commission: 0,
  manager_commission: 0,
  agent_upfront_commission: 0,
  agent_trailer_commission: 0,
  manager_upfront_commission: 0,
  manager_trailer_commission: 0,
  total_commission: 0,
  monthly_return: 0,
  drip_amount: 0,
  cash_dividend: 0,
  cumulative_return: 0,
  cumulative_cash_dividends: 0,
  current_maturity_date: maturity,
  renewal_count: 0,
  commission_events: [],
  status: "scheduled",
});

// One timeline drives investments, scenarios, distributions, and validation.
// Returns post at completed calendar month-ends. Mid-month positions exclude
// unposted accruals; rounding occurs at distribution and payout boundaries.
export function investmentTimeline(input, withdrawals, throughDate) {
  const i = {
    ...input,
    currency: input.currency ?? "USD",
    return_rate: input.return_rate ?? 0,
    distribution_type: input.distribution_type ?? "cash",
    term_months: input.term_months ?? 0,
    auto_renew: !!input.auto_renew,
    upfront_rate: input.upfront_rate ?? 0,
    manager_upfront_rate: input.manager_upfront_rate ?? 0,
  };
  const events = withdrawals
    .filter((w) => w.investment_id === i.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map();
  for (const w of events)
    byDate.set(w.date, [...(byDate.get(w.date) || []), w]);
  let balance = i.principal,
    cumulativeReturn = 0,
    cumulativeCash = 0,
    renewals = 0;
  let maturity = i.maturity_date || termMaturity(i.start_date, i.term_months);
  const months = [];
  if (throughDate < i.start_date)
    return { months, balance: 0, maturity, renewals: 0 };
  const elapsedMonths =
    (Number(throughDate.slice(0, 4)) - Number(i.start_date.slice(0, 4))) * 12 +
    Number(throughDate.slice(5, 7)) -
    Number(i.start_date.slice(5, 7));
  if (elapsedMonths > 2400) {
    const error = new Error(
      "Choose a reporting date within 200 years of the investment start date.",
    );
    error.status = 400;
    throw error;
  }
  for (
    let month = i.start_date.slice(0, 7);
    month <= throughDate.slice(0, 7);
    month = addMonths(month, 1)
  ) {
    const lastDate = addDays(addMonths(month, 1) + "-01", -1),
      days = Number(lastDate.slice(8));
    const until = throughDate < lastDate ? throughDate : lastDate;
    let weighted = 0,
      earningDays = 0,
      agentUpfront = 0,
      managerUpfront = 0;
    const commissionEvents = [];
    for (let day = 1; day <= Number(until.slice(8)); day++) {
      const date = month + "-" + String(day).padStart(2, "0");
      if (date < i.start_date) continue;
      let cycleEvent = date === i.start_date ? "initial" : null;
      if (maturity && date > maturity && i.auto_renew && balance > 0) {
        cycleEvent = "renewal";
        renewals++;
        maturity = termMaturity(date, i.term_months);
      }
      if (cycleEvent && balance > 0) {
        const agentRate =
          i.commission_type === "lump_sum" ? i.rate : i.upfront_rate;
        const managerRate =
          i.commission_type === "lump_sum"
            ? i.manager_rate
            : i.manager_upfront_rate;
        const agentPayout = roundMoney((balance * agentRate) / 100);
        const managerPayout = i.manager_id
          ? roundMoney((balance * managerRate) / 100)
          : 0;
        agentUpfront += agentPayout;
        managerUpfront += managerPayout;
        commissionEvents.push({
          date,
          type: cycleEvent,
          base: balance,
          agent_commission: agentPayout,
          manager_commission: managerPayout,
        });
      }
      if ((!maturity || date <= maturity) && balance > 0) {
        weighted += balance;
        earningDays++;
      }
      const withdrawn = (byDate.get(date) || []).reduce(
        (s, w) => s + w.amount,
        0,
      );
      if (withdrawn > balance + 0.000001) {
        const e = new Error(
          `Withdrawal on ${date} exceeds the available ${i.currency} balance of ${balance.toFixed(2)}. Only posted DRIP returns can be withdrawn.`,
        );
        e.status = 400;
        throw e;
      }
      balance = roundMoney(Math.max(0, balance - withdrawn));
    }
    const average = weighted / days,
      earnedReturn = roundMoney((average * i.return_rate) / 100 / 12);
    // Final accrued DRIP earnings are cash after full withdrawal, preventing
    // a closed investment from being silently reopened at month-end.
    const posted = until === lastDate;
    const drip =
      posted && i.distribution_type === "drip" && balance > 0
        ? earnedReturn
        : 0;
    const cash = posted ? earnedReturn - drip : 0;
    balance = roundMoney(balance + drip);
    cumulativeReturn = roundMoney(
      cumulativeReturn + (posted ? earnedReturn : 0),
    );
    cumulativeCash = roundMoney(cumulativeCash + cash);
    const agentTrailer =
      i.commission_type === "trailer"
        ? roundMoney((average * i.rate) / 100 / 12)
        : 0;
    const managerTrailer =
      i.commission_type === "trailer" && i.manager_id
        ? roundMoney((average * i.manager_rate) / 100 / 12)
        : 0;
    const agent = roundMoney(agentUpfront + agentTrailer),
      manager = roundMoney(managerUpfront + managerTrailer);
    if (
      ![balance, agent, manager, cumulativeReturn].every(Number.isFinite) ||
      balance > 1e15
    ) {
      const e = new Error(
        "Projected balance exceeds the supported range. Use a shorter projection or lower return rate.",
      );
      e.status = 400;
      throw e;
    }
    months.push({
      month,
      average_balance: roundMoney(average),
      closing_balance: balance,
      earning_days: earningDays,
      days_in_month: days,
      agent_commission: agent,
      manager_commission: manager,
      agent_upfront_commission: roundMoney(agentUpfront),
      agent_trailer_commission: agentTrailer,
      manager_upfront_commission: roundMoney(managerUpfront),
      manager_trailer_commission: managerTrailer,
      total_commission: roundMoney(agent + manager),
      monthly_return: earnedReturn,
      drip_amount: drip,
      cash_dividend: cash,
      cumulative_return: cumulativeReturn,
      cumulative_cash_dividends: cumulativeCash,
      current_maturity_date: maturity,
      renewal_count: renewals,
      commission_events: commissionEvents,
      status:
        balance <= 0
          ? "withdrawn"
          : maturity && until >= maturity && !i.auto_renew
            ? "matured"
            : "active",
    });
  }
  return { months, balance, maturity, renewals };
}
export function investmentPosition(
  i,
  withdrawals,
  date = new Date().toISOString().slice(0, 10),
) {
  const timeline = investmentTimeline(i, withdrawals, date);
  return {
    current_balance: timeline.balance,
    current_balance_date: date,
    current_maturity_date: timeline.maturity,
    renewal_count: timeline.renewals,
  };
}
export function validateWithdrawals(i, withdrawals) {
  const latest = withdrawals
    .filter((w) => w.investment_id === i.id)
    .reduce((max, w) => (w.date > max ? w.date : max), i.start_date);
  investmentTimeline(i, withdrawals, latest);
}
export function calculateInvestment(investment, withdrawals, month) {
  if (!validMonth(month)) throw new Error("Invalid reporting month");
  const timeline = investmentTimeline(
    investment,
    withdrawals,
    addDays(addMonths(month, 1) + "-01", -1),
  );
  const row =
    timeline.months.find((r) => r.month === month) ||
    zeroMonth(investment, month, timeline.maturity);
  return {
    ...investment,
    currency: investment.currency ?? "USD",
    return_rate: investment.return_rate ?? 0,
    distribution_type: investment.distribution_type ?? "cash",
    upfront_rate: investment.upfront_rate ?? 0,
    manager_upfront_rate: investment.manager_upfront_rate ?? 0,
    ...row,
    month_withdrawals: withdrawals.filter(
      (w) => w.investment_id === investment.id && w.date.slice(0, 7) === month,
    ),
    distribution_history: timeline.months.slice(-12),
  };
}
export function investmentSchedule(investment, withdrawals, month, count = 12) {
  const endMonth = addMonths(month, count - 1);
  const timeline = investmentTimeline(
    investment,
    withdrawals,
    addDays(addMonths(endMonth, 1) + "-01", -1),
  );
  return Array.from({ length: count }, (_, index) => {
    const m = addMonths(month, index);
    return {
      ...investment,
      currency: investment.currency ?? "USD",
      ...(timeline.months.find((r) => r.month === m) ||
        zeroMonth(investment, m, timeline.maturity)),
    };
  });
}
export function report(state, month, currency = "USD") {
  const rows = state.investments
    .filter((i) => (i.currency ?? "USD") === currency)
    .map((i) => {
      const investor = state.investors.find((p) => p.id === i.investor_id),
        agent = state.agents.find((p) => p.id === i.agent_id),
        manager = state.managers.find((p) => p.id === i.manager_id);
      return {
        ...calculateInvestment(i, state.withdrawals, month),
        investor_name: investor?.name ?? "",
        agent_name: agent?.name ?? "",
        manager_name: manager?.name ?? "",
      };
    });
  const sum = (key) => roundMoney(rows.reduce((s, r) => s + (r[key] ?? 0), 0));
  return {
    month,
    currency,
    rows,
    summary: {
      agent_commission: sum("agent_commission"),
      manager_commission: sum("manager_commission"),
      total_commission: sum("total_commission"),
      invested_balance: sum("closing_balance"),
      current_balance: sum("current_balance"),
      monthly_return: sum("monthly_return"),
      cash_dividend: sum("cash_dividend"),
      drip_amount: sum("drip_amount"),
      active_investments: rows.filter((r) => r.status === "active").length,
      earning_investments: rows.filter((r) => r.total_commission > 0).length,
    },
  };
}
