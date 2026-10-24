// All dates are ISO calendar dates in UTC. Withdrawal dates remain commission-earning.
const DAY = 86_400_000;
export const roundMoney = n => Math.round((n + Number.EPSILON) * 100) / 100;
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validMonth(value) { return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
export function addMonths(month, offset) {
  const date = new Date(month + '-01T00:00:00Z'); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 7);
}
export function calculateInvestment(investment, withdrawals, month) {
  if (!validMonth(month)) throw new Error('Invalid reporting month');
  const begin = Date.parse(month + '-01T00:00:00Z');
  const end = Date.parse(addMonths(month, 1) + '-01T00:00:00Z');
  const days = (end - begin) / DAY;
  const events = withdrawals.filter(w => w.investment_id === investment.id).sort((a, b) => a.date.localeCompare(b.date));
  let weighted = 0, earningDays = 0;
  for (let t = begin; t < end; t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (date < investment.start_date) continue;
    const balance = Math.max(0, investment.principal - events.filter(w => w.date < date).reduce((sum, w) => sum + w.amount, 0));
    weighted += balance;
    if (balance > 0) earningDays++;
  }
  const averageBalance = weighted / days;
  const upfront = investment.commission_type === 'lump_sum';
  const base = upfront ? (investment.start_date.slice(0, 7) === month ? investment.principal : 0) : averageBalance / 12;
  const agentCommission = roundMoney(base * investment.rate / 100);
  const managerCommission = investment.manager_id ? roundMoney(base * investment.manager_rate / 100) : 0;
  const closingBalance = investment.start_date < addMonths(month, 1) + '-01' ? Math.max(0, investment.principal - events.filter(w => w.date < addMonths(month, 1) + '-01').reduce((sum, w) => sum + w.amount, 0)) : 0;
  return { ...investment, average_balance: roundMoney(averageBalance), closing_balance: roundMoney(closingBalance), earning_days: earningDays, days_in_month: days, agent_commission: agentCommission, manager_commission: managerCommission, total_commission: roundMoney(agentCommission + managerCommission), month_withdrawals: events.filter(w => w.date.slice(0, 7) === month) };
}
export function report(state, month) {
  const rows = state.investments.map(i => {
    const investor = state.investors.find(p => p.id === i.investor_id);
    const agent = state.agents.find(p => p.id === i.agent_id);
    const manager = state.managers.find(p => p.id === i.manager_id);
    return { ...calculateInvestment(i, state.withdrawals, month), investor_name: investor?.name ?? '', agent_name: agent?.name ?? '', manager_name: manager?.name ?? '' };
  });
  return { month, rows, summary: { agent_commission: roundMoney(rows.reduce((s, r) => s + r.agent_commission, 0)), manager_commission: roundMoney(rows.reduce((s, r) => s + r.manager_commission, 0)), total_commission: roundMoney(rows.reduce((s, r) => s + r.total_commission, 0)), invested_balance: roundMoney(rows.reduce((s, r) => s + r.closing_balance, 0)), active_investments: rows.filter(r => r.closing_balance > 0).length, earning_investments: rows.filter(r => r.total_commission > 0).length } };
}
