export type Person = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
};
export type Currency = "USD" | "CAD";
export type InvestmentTerms = {
  currency: Currency;
  return_rate: number;
  distribution_type: "cash" | "drip";
  term_months: number;
  maturity_date: string | null;
  auto_renew: boolean;
  upfront_rate: number;
  manager_upfront_rate: number;
};
export type Investment = InvestmentTerms & {
  id: string;
  name: string;
  investor_id: string;
  agent_id: string;
  manager_id: string | null;
  principal: number;
  start_date: string;
  commission_type: "trailer" | "lump_sum";
  rate: number;
  manager_rate: number;
  notes: string;
  current_balance: number;
  current_balance_date: string;
  current_maturity_date: string | null;
  renewal_count: number;
};
export type Withdrawal = {
  id: string;
  investment_id: string;
  date: string;
  amount: number;
  notes: string;
};
export type State = {
  investors: Person[];
  agents: Person[];
  managers: Person[];
  investments: Investment[];
  withdrawals: Withdrawal[];
  demo: boolean;
  public_demo?: boolean;
};
export type DistributionMonth = {
  month: string;
  average_balance: number;
  closing_balance: number;
  monthly_return: number;
  drip_amount: number;
  cash_dividend: number;
  agent_upfront_commission: number;
  agent_trailer_commission: number;
  manager_upfront_commission: number;
  manager_trailer_commission: number;
  total_commission: number;
};
export type Row = Investment &
  DistributionMonth & {
    earning_days: number;
    days_in_month: number;
    agent_commission: number;
    manager_commission: number;
    month_withdrawals: Withdrawal[];
    investor_name: string;
    agent_name: string;
    manager_name: string;
    status: "scheduled" | "active" | "withdrawn" | "matured";
    distribution_history: DistributionMonth[];
    commission_events: {
      date: string;
      type: "initial" | "renewal";
      base: number;
      agent_commission: number;
      manager_commission: number;
    }[];
  };
export type Summary = {
  agent_commission: number;
  manager_commission: number;
  total_commission: number;
  invested_balance: number;
  current_balance: number;
  monthly_return: number;
  cash_dividend: number;
  drip_amount: number;
  active_investments: number;
  earning_investments: number;
};
export type Report = {
  month: string;
  currency: Currency;
  rows: Row[];
  summary: Summary;
  trend: (Summary & { month: string })[];
};
export type Page =
  | "overview"
  | "calculator"
  | "investments"
  | "investors"
  | "agents"
  | "managers"
  | "ledger";
export type Entity = "investments" | "investors" | "agents" | "managers";
